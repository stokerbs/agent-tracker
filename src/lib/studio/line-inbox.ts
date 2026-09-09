import "server-only";

import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { scrubText } from "@/lib/studio/privacy/scrub";

/**
 * LINE OA → Studio inbox capture.
 *
 * Called from the LINE webhook router for messages sent by people who are NOT
 * linked field agents (i.e. prospective customers). Stores a PII-redacted copy
 * keyed by an HMAC of the LINE userId so recurring questions can be mined
 * later (lib/studio/faq-mining.ts). Never throws — the webhook must reply to
 * LINE no matter what happens here.
 */

const MAX_LEN = 4000;
const MIN_LEN = 2;

/** Replace every deterministic PII finding with a neutral token. Pure. */
export function redactForInbox(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  if (!trimmed) return "";
  const findings = scrubText({ fields: { t: trimmed } });
  // Longest excerpts first so partial overlaps don't leave fragments behind.
  const excerpts = Array.from(new Set(findings.map((f) => f.excerpt))).sort((a, b) => b.length - a.length);
  let out = trimmed;
  for (const ex of excerpts) {
    const kind = findings.find((f) => f.excerpt === ex)?.kind ?? "other";
    const token = TOKENS[kind] ?? "[ข้อมูลส่วนตัว]";
    out = out.split(ex).join(token);
  }
  return out;
}

const TOKENS: Record<string, string> = {
  phone: "[เบอร์โทร]",
  email: "[อีเมล]",
  plate: "[ทะเบียนรถ]",
  line_id: "[LINE ID]",
  url: "[ลิงก์]",
  address: "[ที่อยู่]",
  id_number: "[เลขบัตร]",
  date: "[วันที่]",
  name: "[ชื่อ]",
  denylist: "[ชื่อ]",
};

/** Non-reversible sender key (HMAC-SHA256 with the server-side BIDX_KEY). */
export function hashSender(lineUserId: string): string | null {
  const key = process.env.BIDX_KEY;
  if (!key || key.length < 32) return null;
  return crypto.createHmac("sha256", Buffer.from(key, "hex")).update(lineUserId).digest("hex").slice(0, 32);
}

/** True for text that is plainly a bot command attempt, not a customer question. */
export function looksLikeBotCommand(text: string): boolean {
  // `\b` is ASCII-only in JS, so use an explicit whitespace/end lookahead for Thai keywords.
  return /^(?:link|ผูกบัญชี|ผูก|เชื่อมบัญชี|เชื่อมต่อบัญชี|verify|ยืนยัน|case|เคส|timeline|ไทม์ไลน์|ไทม์ไลน|add.?timeline|เพิ่มไทม์ไลน์|บันทึกไทม์ไลน์|intel|ข่าวกรอง)(?=\s|$)/iu.test(text.trim()) || /^\d{6}$/.test(text.trim());
}

export interface CaptureInput {
  lineUserId: string;
  text: string;
  /** Linked field agents are never captured. */
  isLinkedAgent: boolean;
}

/** Fire-and-forget capture. Returns true when a row was stored. */
export async function captureCustomerMessage(input: CaptureInput): Promise<boolean> {
  try {
    if (input.isLinkedAgent) return false;
    const raw = input.text ?? "";
    if (raw.trim().length < MIN_LEN || looksLikeBotCommand(raw)) return false;
    const sender = hashSender(input.lineUserId);
    if (!sender) {
      console.warn("[studio:line-inbox] BIDX_KEY missing — message not captured");
      return false;
    }
    const redacted = redactForInbox(raw);
    if (redacted.length < MIN_LEN) return false;
    const svc = createServiceClient();
    const { error } = await svc.from("studio_line_inbox").insert({ sender_hash: sender, text_redacted: redacted });
    if (error) {
      console.error("[studio:line-inbox] insert failed:", error.message);
      return false;
    }
    console.info(`[studio:line-inbox] captured sender=${sender.slice(0, 6)}… chars=${redacted.length}`);
    return true;
  } catch (e) {
    console.error("[studio:line-inbox] capture threw:", e instanceof Error ? e.message : e);
    return false;
  }
}
