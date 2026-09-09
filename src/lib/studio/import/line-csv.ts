/**
 * Parser for LINE Official Account Manager chat-history CSV exports.
 *
 * File shape (UTF-8 with BOM, CRLF, quoted multi-line cells):
 *   ชื่อบัญชี,<account name>
 *   ไทม์โซน,'+07:00
 *   วันดาวน์โหลด,2026/06/13 02:24
 *   ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ
 *   Account,ข้อความตอบกลับอัตโนมัติ,2026/06/02,07:28:41,"…"
 *   User,<customer display name>,2026/06/02,07:29:10,"…"
 *
 * Pure functions — no I/O, no network. Redaction happens in the importer.
 */

export interface LineChatMessage {
  side: "user" | "account";
  sender: string;
  /** ISO timestamp built from the file's timezone. */
  at: string;
  text: string;
  /** LINE OA auto-reply / greeting bot messages (not the owner speaking). */
  isAutoReply: boolean;
}

export interface LineChatExport {
  accountName: string | null;
  timezone: string;
  downloadedAt: string | null;
  messages: LineChatMessage[];
  /** Distinct customer display names seen in the file (for per-file redaction). */
  customerNames: string[];
}

const AUTO_REPLY_SENDERS = new Set(["ข้อความตอบกลับอัตโนมัติ", "ข้อความทักทาย", "Auto-reply", "Greeting message", "Response message"]);

/** Minimal RFC-4180 parser: handles quoted fields with embedded commas, quotes ("") and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.length)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((f) => f.length)) rows.push(row);
  }
  return rows;
}

function toIso(date: string, time: string, tz: string): string | null {
  const d = date.replace(/\//g, "-");
  const t = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const offset = /^[+-]\d{2}:\d{2}$/.test(tz) ? tz : "+07:00";
  const parsed = new Date(`${d}T${t}${offset}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseLineOaCsv(text: string): LineChatExport {
  const rows = parseCsv(text);
  let accountName: string | null = null;
  let timezone = "+07:00";
  let downloadedAt: string | null = null;
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const [k, v] = rows[i];
    if (k === "ชื่อบัญชี") accountName = v ?? null;
    else if (k === "ไทม์โซน") timezone = (v ?? "").replace(/^'/, "") || "+07:00";
    else if (k === "วันดาวน์โหลด") downloadedAt = v ?? null;
    else if (k === "ประเภทผู้ส่ง" || k === "Sender type") {
      headerIdx = i;
      break;
    }
  }
  const messages: LineChatMessage[] = [];
  const customers = new Set<string>();
  if (headerIdx >= 0) {
    for (const r of rows.slice(headerIdx + 1)) {
      if (r.length < 5) continue;
      const [type, sender, date, time, ...rest] = r;
      const body = rest.join(",").trim();
      if (!body) continue;
      const side: LineChatMessage["side"] = /^user$/i.test(type) ? "user" : "account";
      const isAutoReply = side === "account" && AUTO_REPLY_SENDERS.has(sender.trim());
      const at = toIso(date, time, timezone);
      if (!at) continue; // unparsable timestamp → not a message row
      if (side === "user" && sender.trim()) customers.add(sender.trim());
      messages.push({ side, sender: sender.trim(), at, text: body, isAutoReply });
    }
  }
  return { accountName, timezone, downloadedAt, messages, customerNames: Array.from(customers) };
}

/** Non-text payloads LINE exports as placeholders — nothing to learn from them. */
const PLACEHOLDER_RE = /^\[(?:สติกเกอร์|รูปภาพ|วิดีโอ|ไฟล์|ตำแหน่ง|เสียง|Sticker|Photo|Video|File|Location|Voice|Audio)[^\]]*\]$/i;

export function isPlaceholderMessage(text: string): boolean {
  return PLACEHOLDER_RE.test(text.trim());
}

export interface TranscriptWindow {
  index: number;
  text: string;
  messageCount: number;
  userCount: number;
  accountCount: number;
  from: string;
  to: string;
}

/**
 * Turn a conversation into AI-sized windows: "ลูกค้า:" / "นักสืบ:" lines, skipping
 * auto-replies and placeholders. `redact` is applied per message (caller passes
 * the PII redactor with the per-file denylist). Windows split on size only —
 * a conversation never splits mid-message.
 */
export function buildTranscriptWindows(
  messages: LineChatMessage[],
  redact: (text: string) => string,
  maxChars = 12_000,
): TranscriptWindow[] {
  const windows: TranscriptWindow[] = [];
  let lines: string[] = [];
  let chars = 0;
  let userCount = 0;
  let accountCount = 0;
  let from = "";
  let to = "";

  const flush = () => {
    if (!lines.length) return;
    windows.push({ index: windows.length, text: lines.join("\n"), messageCount: lines.length, userCount, accountCount, from, to });
    lines = [];
    chars = 0;
    userCount = 0;
    accountCount = 0;
  };

  for (const m of messages) {
    if (m.isAutoReply || isPlaceholderMessage(m.text)) continue;
    const clean = redact(m.text).replace(/\s+/g, " ").trim();
    if (clean.length < 2) continue;
    const month = m.at.slice(0, 7); // YYYY-MM — coarse on purpose (exact dates are identifying)
    const line = `${m.side === "user" ? "ลูกค้า" : "นักสืบ"} (${month}): ${clean}`;
    if (chars + line.length > maxChars && lines.length) flush();
    if (!lines.length) from = m.at;
    to = m.at;
    lines.push(line);
    chars += line.length + 1;
    if (m.side === "user") userCount += 1;
    else accountCount += 1;
  }
  flush();
  return windows;
}
