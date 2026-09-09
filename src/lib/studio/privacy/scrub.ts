/**
 * Deterministic privacy scan for content text (no AI, no network).
 *
 * Finds identifiers that must never appear in published Detective Pulse
 * content: phone numbers, emails, license plates, LINE ids, URLs, Thai ID
 * numbers, street addresses, explicit calendar dates and owner-defined
 * denylist terms (client/target/staff names). Findings are NEVER auto-replaced
 * with invented details — the UI asks the owner to generalise instead.
 *
 * Pure functions → unit-tested in scrub.test.ts.
 */

import type { PrivacyFinding, PrivacyRules, PrivacyStatus } from "@/lib/studio/types";

export interface ScrubInput {
  /** field name → text (hook, script, caption, cta, variant:tiktok:script …) */
  fields: Record<string, string | null | undefined>;
  rules?: Partial<PrivacyRules> | null;
}

// Thai mobile/landline: 0X-XXX-XXXX / 0XXXXXXXXX / +66 X XXXX XXXX (spaces, dashes, dots)
const PHONE_RE = /(?:\+66[\s-]?\d(?:[\s.-]?\d){7,8}|(?<!\d)0\d(?:[\s.-]?\d){7,8}(?!\d))/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Thai plates: "กข 1234", "1กข 1234", "กข-1234", optional province after
const PLATE_RE = /(?<![ก-๙A-Za-z0-9])(?:\d?[ก-ฮ]{1,2}[\s-]?\d{1,4})(?![ก-๙0-9])/g;
const LINE_ID_RE = /(?:LINE\s*(?:ID|ไอดี)?\s*[:：]?\s*@?[A-Za-z0-9._-]{4,}|@[A-Za-z][A-Za-z0-9._-]{3,})/gi;
const URL_RE = /https?:\/\/[^\s)]+|www\.[^\s)]+/gi;
const THAI_ID_RE = /(?<!\d)\d(?:[\s-]?\d){12}(?!\d)/g; // 13 digits
// House number + ซอย/ถนน/หมู่ or "เลขที่"
const ADDRESS_RE = /(?:เลขที่\s*\d+[\/\d-]*|\d+[\/\d-]*\s*(?:ซอย|ซ\.|ถนน|ถ\.|หมู่|ม\.)\s*[ก-๙A-Za-z0-9.\s-]{1,30})/g;
const DATE_RE = /\b\d{1,2}[\/.-]\d{1,2}[\/.-](?:25|20)\d{2}\b|\b(?:วันที่\s*)?\d{1,2}\s*(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(?:25|20)?\d{2}\b/g;
// Titles that usually precede a real name in Thai copy
// "คุณ" is the everyday pronoun "you" in chat, so it is NOT treated as a title
// (it swallowed whole clauses — Thai has no word spaces). Formal titles only,
// with a bounded name length so a false positive costs a few characters, not a sentence.
const NAME_TITLE_RE = /(?:นาย|นาง|นางสาว|น\.ส\.|ดร\.|ด\.ช\.|ด\.ญ\.)\s?[ก-๙]{2,10}/g;
// "คุณ" + a SHORT token followed by a space/punctuation/end is a vocative name
// ("คุณสมชาย ขับรถ"); the pronoun runs straight into a verb ("คุณรับงาน…").
const KHUN_NAME_RE = /คุณ([ก-๙]{2,5})(?=[\s,.!?…]|$)/g;
const KHUN_STOPLIST = new Set(["คะ", "ครับ", "ค่ะ", "ช่วย", "รับ", "มี", "ทำ", "ว่า", "จะ", "ได้", "ไหม", "ต้อง", "เป็น", "อยู่", "ไป", "มา", "คิด", "เอง", "ล่ะ", "นะ", "เห็น", "รู้", "บอก", "ถาม", "ลอง", "ดู", "ก็", "แล้ว", "ยัง", "เคย", "อยาก", "ควร", "ขอ", "ใช้", "เอา", "ให้", "พอ", "ลูกค้า", "ผู้ชาย", "ผู้หญิง", "ตำรวจ", "ทนาย", "หมอ", "ครู"]);
// Untitled names after cue words in chat: "แฟนชื่อสมชาย", "ชื่อเล่นว่าเอ", "เรียกว่าพี่บี"
// Compounds like ชื่อเสียง/ชื่อดัง/ชื่อบัญชี/ชื่อร้าน are not names — excluded; name length bounded.
const NAME_CUE_RE = /(?:ชื่อเล่นว่า|ชื่อเล่น|ชื่อว่า|เรียกว่า|ชื่อ(?!เสียง|ดัง|บัญชี|ร้าน|บริษัท|เรื่อง|สินค้า|โครงการ|ผู้ใช้|ไฟล์|จริง|ปลอม|เต็ม|ย่อ|นี้|นั้น))\s*(?:คุณ|พี่|น้อง|นาย|นาง)?\s*[ก-๙A-Za-z]{2,10}/g;
// Ages: "อายุ 34", "34 ปี", "5 ขวบ"
const AGE_RE = /(?:อายุ\s*\d{1,2}(?:\s*ปี)?|(?<!\d)\d{1,2}\s*(?:ปี|ขวบ)(?![ก-๙A-Za-z0-9]))/g;
// Brand handles we allow (our own CTA) — never flag these.
const ALLOWLIST = new Set(["@detectivepluse", "detectivepluse@gmail.com", "096-846-1406", "0968461406", "096 846 1406"]);
const ALLOWLIST_URL_HOSTS = ["detectivepulse.com", "lin.ee", "line.me"];

function pushFinding(list: PrivacyFinding[], f: PrivacyFinding) {
  if (!list.some((x) => x.kind === f.kind && x.excerpt === f.excerpt && x.field === f.field)) list.push(f);
}

function isAllowlisted(excerpt: string): boolean {
  const norm = excerpt.trim().toLowerCase();
  if (ALLOWLIST.has(norm)) return true;
  if (ALLOWLIST.has(norm.replace(/[\s-]/g, ""))) return true;
  return false;
}

function scanField(field: string, text: string, rules: Partial<PrivacyRules> | null | undefined, out: PrivacyFinding[]) {
  const push = (kind: PrivacyFinding["kind"], excerpt: string, reason: string, severity: PrivacyFinding["severity"]) =>
    pushFinding(out, { kind, excerpt: excerpt.trim().slice(0, 80), reason, severity, field, source: "deterministic" });

  for (const m of text.matchAll(PHONE_RE)) {
    if (!isAllowlisted(m[0])) push("phone", m[0], "พบหมายเลขโทรศัพท์ที่ไม่ใช่ช่องทางติดต่อของบริษัท", "high");
  }
  for (const m of text.matchAll(EMAIL_RE)) {
    if (!isAllowlisted(m[0])) push("email", m[0], "พบอีเมลส่วนบุคคล", "high");
  }
  for (const m of text.matchAll(THAI_ID_RE)) push("id_number", m[0], "พบเลข 13 หลักคล้ายเลขบัตรประชาชน", "high");
  for (const m of text.matchAll(PLATE_RE)) {
    // Skip things like "ก 1" false positives that are too short.
    if (m[0].replace(/\D/g, "").length >= 2) push("plate", m[0], "พบรูปแบบคล้ายทะเบียนรถ", "high");
  }
  for (const m of text.matchAll(LINE_ID_RE)) {
    if (!isAllowlisted(m[0].replace(/^LINE\s*(?:ID|ไอดี)?\s*[:：]?\s*/i, ""))) push("line_id", m[0], "พบ LINE ID / handle ที่ไม่ใช่ของบริษัท", "medium");
  }
  for (const m of text.matchAll(URL_RE)) {
    const host = m[0].replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#]/)[0].toLowerCase();
    if (!ALLOWLIST_URL_HOSTS.some((h) => host === h || host.endsWith("." + h))) push("url", m[0], "พบลิงก์ภายนอก — ตรวจสอบว่าไม่ชี้ไปยังบุคคล/บัญชีจริง", "low");
  }
  for (const m of text.matchAll(ADDRESS_RE)) push("address", m[0], "พบข้อความคล้ายที่อยู่ (บ้านเลขที่/ซอย/ถนน)", "high");
  for (const m of text.matchAll(DATE_RE)) push("date", m[0], "พบวันที่ระบุชัด — อาจเชื่อมโยงกับเคสจริงได้", "medium");
  for (const m of text.matchAll(NAME_TITLE_RE)) push("name", m[0], "พบคำนำหน้าชื่อตามด้วยชื่อ — อาจเป็นชื่อบุคคลจริง", "medium");
  for (const m of text.matchAll(KHUN_NAME_RE)) {
    if (!KHUN_STOPLIST.has(m[1])) push("name", m[0], "พบ “คุณ” ตามด้วยชื่อสั้น ๆ — อาจเป็นชื่อบุคคลจริง", "medium");
  }
  for (const m of text.matchAll(NAME_CUE_RE)) push("name", m[0], "พบคำบ่งชี้ชื่อ (ชื่อ/ชื่อเล่น/เรียกว่า) ตามด้วยชื่อ", "medium");
  for (const m of text.matchAll(AGE_RE)) push("other", m[0], "พบอายุระบุชัด — ร่วมกับรายละเอียดอื่นอาจระบุตัวตนได้", "low");

  for (const term of rules?.denylist ?? []) {
    const t = term.trim();
    if (t.length < 2) continue;
    if (text.toLowerCase().includes(t.toLowerCase())) push("denylist", t, "คำนี้อยู่ในรายการห้ามเผยแพร่ (denylist) ของสตูดิโอ", "high");
  }
  for (const pattern of rules?.custom_patterns ?? []) {
    try {
      const re = new RegExp(pattern, "giu");
      for (const m of text.matchAll(re)) push("other", m[0], `ตรงกับรูปแบบที่กำหนดเอง: ${pattern}`, "medium");
    } catch {
      // Invalid under the "giu" flags (validated on save with the same flags);
      // patterns saved by older versions may need re-saving in Settings.
      console.warn("[studio:privacy] skipping invalid custom pattern:", pattern);
    }
  }
}

export function scrubText(input: ScrubInput): PrivacyFinding[] {
  const out: PrivacyFinding[] = [];
  for (const [field, text] of Object.entries(input.fields)) {
    if (!text) continue;
    scanField(field, text, input.rules, out);
  }
  return out;
}

/** Aggregate findings into a gate status. */
export function privacyStatusFromFindings(findings: PrivacyFinding[], strict = false): PrivacyStatus {
  if (findings.length === 0) return "safe";
  if (findings.some((f) => f.severity === "high")) return "blocked";
  if (strict) return "blocked";
  return "review_required";
}

/** Human-readable reason summary for the UI. */
export function summarizeFindings(findings: PrivacyFinding[]): string {
  if (!findings.length) return "ไม่พบข้อมูลระบุตัวตนในเนื้อหา";
  const byKind = new Map<string, number>();
  for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
  const labels: Record<PrivacyFinding["kind"], string> = {
    phone: "เบอร์โทร",
    email: "อีเมล",
    plate: "ทะเบียนรถ",
    line_id: "LINE ID",
    url: "ลิงก์",
    address: "ที่อยู่",
    id_number: "เลขบัตร",
    date: "วันที่",
    denylist: "คำต้องห้าม",
    name: "ชื่อบุคคล",
    location: "สถานที่",
    company: "ชื่อบริษัท",
    photo: "รูปภาพ",
    other: "อื่น ๆ",
  };
  return Array.from(byKind.entries())
    .map(([k, n]) => `${labels[k as PrivacyFinding["kind"]] ?? k} ×${n}`)
    .join(" · ");
}
