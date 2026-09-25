import "server-only";

import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { scrubText } from "@/lib/studio/privacy/scrub";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import type { PrivacyRules } from "@/lib/studio/types";

/**
 * LINE OA → Studio inbox capture.
 *
 * Called from the LINE webhook router for messages sent by people who are NOT
 * linked field agents (i.e. prospective customers). Stores a PII-redacted copy
 * keyed by an HMAC of the LINE userId so recurring questions can be mined
 * later (lib/studio/faq-mining.ts). Never throws — the webhook must reply to
 * LINE no matter what happens here.
 *
 * Data-protection notes: the stored text is pseudonymous personal data
 * (redaction is best-effort; free text can still carry names/story details),
 * so rows have a hard retention cap (faq-mining.ts) and only the AI-extracted,
 * identity-free canonical questions ever reach content generation.
 */

/** Customer questions are short; a hard cap also bounds prompt size per batch. */
export const MAX_LEN = 1500;
const MIN_LEN = 2;

/** Thai digits → ASCII so `\d`-based scrub patterns catch ๐๘๑… numbers. */
export function normalizeThaiDigits(text: string): string {
  return text.replace(/[๐-๙]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0e50 + 0x30));
}

/** Replace every deterministic PII finding with a neutral token. Pure. */
export function redactForInbox(text: string, rules?: Partial<PrivacyRules> | null): string {
  const trimmed = normalizeThaiDigits(text).replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  if (!trimmed) return "";
  const findings = scrubText({ fields: { t: trimmed }, rules: rules ?? null });
  let out = trimmed;
  // Everything that is not a name first: a name finding is the widest of them, and redacting it first
  // used to erase the text a plate or phone finding was still waiting to match ("ทะเบียน กข 1234" lost
  // its plate token and kept the digits).
  for (const f of findings.filter((x) => x.kind !== "name")) {
    out = replaceAll(out, f.excerpt, TOKENS[f.kind] ?? "[ข้อมูลส่วนตัว]");
  }
  // Names come from a second read of the text we have now, not from the first scan: a name finding is
  // wide enough to overlap the identifiers above, and after those are tokenised the first scan's
  // excerpt no longer occurs in the text — matching it would silently do nothing and keep the name.
  const names = Array.from(new Set(scrubText({ fields: { t: out }, rules: rules ?? null }).filter((f) => f.kind === "name").map((f) => f.excerpt)))
    // Longest first so partial overlaps don't leave fragments behind.
    .sort((a, b) => b.length - a.length);
  for (const ex of names) {
    // A rule with a gap between the cue and the name (ชื่อของ… คือ …) cannot tell the inbox WHICH
    // token in the finding is the name: the gap can hold it. Four attempts to work it out from the
    // finding alone each shipped a row that kept the name and gained a [ชื่อ] reading as redacted,
    // which is worse than an obvious miss. So those findings go whole. The cue, title and คุณ rules
    // have no gap — the name follows the cue immediately — so there the name alone goes and the
    // customer's question survives, which is what this inbox is mined for.
    const gapless = !GAP_RULE_RE.test(ex);
    const name = gapless ? nameInsideExcerpt(ex) : "";
    out = name ? replaceAll(out, name, TOKENS.name) : replaceAll(out, ex, TOKENS.name, true);
  }
  return out.slice(0, MAX_LEN);
}

/** The rules whose match holds a gap that can contain the name: ชื่อของ/ชื่อใน/ชื่อที่ … คือ/ว่า. */
const GAP_RULE_RE = /^ชื่อ(?:เล่น)?(?:ของ|ใน|ที่|และ|หรือ|กับ)/u;

/**
 * Replace every occurrence, and take the rest of the word with it. Thai writes no space inside a word,
 * so a finding can end mid-word (the name slot is capped at ten letters) — replacing exactly what was
 * matched leaves an orphan syllable that reads as damage and is useless to the mining layer.
 */
function replaceAll(text: string, find: string, token: string, surname = false): string {
  // A Thai full name is two tokens and a rule's finding ends at the first one, so a finding taken
  // whole also takes a following token unless it is a politeness particle — otherwise "ชื่อในรายงาน
  // สมหญิง ศรีสุข" stores the surname beside the token. The cost is a word of the question when the
  // next word is not a surname, which is the cheaper way to be wrong here.
  const tail = surname ? String.raw`(?:\s(?!${PARTICLES})[ก-๙]{2,10}(?![ก-๙]))?` : "";
  const re = new RegExp(`${find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ก-๙]*${tail}`, "giu");
  return text.replace(re, token);
}

/** Politeness particles, which are never part of the name that precedes them. */
const PARTICLES = "ครับ|ค่ะ|คะ|ค่า|นะ|จ้า|จ้ะ|ด้วย|เลย|หน่อย|ขอบคุณ";

/** Cue words and labels a name rule may match before the name itself. */
const CUE_PREFIX_RE =
  /^(?:ชื่อ(?:เล่น)?(?:ของ|ใน|ที่|และ|หรือ|กับ)[ก-๙\s]{0,25}?(?:คือ|ว่า|\s)|ชื่อเล่นว่า|ชื่อเล่น|ชื่อว่า|เรียกว่า|ชื่อ|นางสาว|นาย|นาง|น\.ส\.|ดร\.|ด\.ช\.|ด\.ญ\.)\s*(?:คุณ|พี่|น้อง|นาย|นาง)?\s*/u;

/** The name part of a name finding: one token, or two when a Thai full name is written out. */
function nameInsideExcerpt(excerpt: string): string {
  // Greedy up to the LAST คือ/ว่า: the label between the cue and the name can hold spaces
  // ("ชื่อของ ผู้ต้องสงสัย คือ สมชาย"), and stopping at the first one picks the label as the name.
  const prefix = excerpt.match(/^.*(?:คือ|ว่า)\s*/u)?.[0] ?? excerpt.match(CUE_PREFIX_RE)?.[0] ?? "";
  const rest = excerpt.slice(prefix.length);
  // The trailing politeness particle is not part of the name.
  return rest.match(/^[ก-๙A-Za-z]{2,10}(?:\s(?!ครับ|ค่ะ|คะ|นะ|จ้า|ด้วย|เลย)[ก-๙A-Za-z]{2,10})?/u)?.[0] ?? "";
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
  other: "[ข้อมูลส่วนตัว]",
};

/**
 * Non-reversible sender key: HMAC-SHA256 under a purpose-specific subkey derived
 * from BIDX_KEY (domain separation — the same LINE id hashed elsewhere with the
 * raw key does not equal this value).
 */
export function hashSender(lineUserId: string): string | null {
  const key = process.env.BIDX_KEY;
  if (!key || key.length < 32) return null;
  const subkey = crypto.createHmac("sha256", Buffer.from(key, "hex")).update("studio-line-inbox:v1").digest();
  return crypto.createHmac("sha256", subkey).update(lineUserId).digest("hex").slice(0, 32);
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
    // Flood guard per (hashed) sender — excess is simply not stored.
    const rl = await checkRateLimit("line_inbox_capture", sender);
    if (!rl.allowed) {
      console.warn(`[studio:line-inbox] rate-limited sender=${sender.slice(0, 6)}…`);
      return false;
    }
    // Owner denylist (client/target/staff names) applies to the inbox too — fail closed if unavailable.
    let rules: PrivacyRules;
    try {
      rules = (await getStudioSettingsStrict()).privacy_rules;
    } catch (e) {
      console.warn("[studio:line-inbox] settings unavailable — message not captured:", e instanceof Error ? e.message : e);
      return false;
    }
    const redacted = redactForInbox(raw, rules);
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
