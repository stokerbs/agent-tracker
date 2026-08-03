/**
 * Thai-language reply text for the LINE bot, kept in one place so tone stays
 * consistent and every state (loading/error/empty equivalents for a chat
 * bot) is named and easy to audit. Matches the tone of the pre-existing
 * webhook reply ("✅ เชื่อมต่อ Detective Pulse สำเร็จ...").
 */

const LINK_EXAMPLE = "ผูกบัญชี 0812345678";

/** Shown to an unlinked LINE user for any message that isn't a link/verify command. */
export function notLinkedHelp(lineUserId: string): string {
  return (
    `สวัสดีครับ 👋 บัญชี LINE นี้ยังไม่ได้เชื่อมต่อกับ Detective Pulse\n\n` +
    `กรุณาเชื่อมบัญชีก่อน โดยพิมพ์:\n${LINK_EXAMPLE}\n(แทนที่ด้วยเบอร์โทรศัพท์ที่ลงทะเบียนไว้กับบริษัท)\n\n` +
    `ระบบจะส่งรหัส OTP 6 หลักไปที่เบอร์โทรของคุณทาง SMS เพื่อยืนยันตัวตน\n\n` +
    `(สำหรับผู้ดูแลระบบ: LINE userId ของคุณคือ ${lineUserId})`
  );
}

/** Shown to an already-linked user for a message that matched no known command. */
export const LINKED_HELP =
  `คำสั่งที่ใช้ได้ตอนนี้:\n` +
  `• เคส <คำค้นหา> — ค้นหาเคส\n` +
  `• ไทม์ไลน์ <รหัสเคส> — ดูไทม์ไลน์ของเคส`;

export const INVALID_PHONE =
  `รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง กรุณาพิมพ์ใหม่ เช่น: ${LINK_EXAMPLE}`;

export const NO_MATCH =
  "ไม่พบข้อมูล หรือไม่สามารถยืนยันตัวตนได้ กรุณาตรวจสอบเบอร์โทรศัพท์อีกครั้ง หรือติดต่อผู้ดูแลระบบ";

export const OTP_SENT =
  "ส่งรหัส OTP ไปยังเบอร์โทรศัพท์ของคุณทาง SMS แล้ว กรุณาพิมพ์รหัส 6 หลักเพื่อยืนยัน (รหัสหมดอายุใน 10 นาที)";

export const OTP_COOLDOWN =
  "คุณเพิ่งขอรหัส OTP ไปแล้ว กรุณารอสักครู่ก่อนขอรหัสใหม่";

export const RATE_LIMITED =
  "คุณส่งคำขอบ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง";

export const SMS_FAILED =
  "ไม่สามารถส่งรหัส OTP ทาง SMS ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ";

export const ALREADY_LINKED =
  "บัญชี LINE นี้เชื่อมต่อกับ Detective Pulse อยู่แล้วครับ";

export const AGENT_ALREADY_LINKED =
  "เบอร์โทรศัพท์นี้เชื่อมต่อกับบัญชี LINE อื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ";

export const NO_PENDING_LINK =
  `ไม่พบคำขอเชื่อมบัญชีที่รอการยืนยัน กรุณาเริ่มต้นใหม่โดยพิมพ์: ${LINK_EXAMPLE}`;

export const OTP_EXPIRED =
  `รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่โดยพิมพ์: ${LINK_EXAMPLE}`;

export const OTP_INVALID =
  "รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";

export const OTP_LOCKED =
  `คุณกรอกรหัส OTP ผิดหลายครั้งเกินไป กรุณาเริ่มต้นใหม่โดยพิมพ์: ${LINK_EXAMPLE}`;

export const LINK_SUCCESS =
  "✅ เชื่อมต่อบัญชี Detective Pulse สำเร็จ! ตอนนี้คุณสามารถใช้คำสั่งค้นหาเคส/ไทม์ไลน์ผ่าน LINE ได้แล้ว";

export const GENERIC_ERROR =
  "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งในภายหลัง";

export const NOT_YET_IMPLEMENTED =
  "ฟีเจอร์นี้กำลังจะมาเร็วๆ นี้ ขออภัยในความไม่สะดวกครับ";

// ── Case lookup / timeline list (read-only) command replies ────────────────

export const CASE_LOOKUP_EMPTY_ARGS =
  "กรุณาระบุรหัสเคสหรือคำค้นหา เช่น: เคส CASE-2026-0042 หรือ เคส สมชาย ใจดี";

export const TIMELINE_EMPTY_ARGS =
  "กรุณาระบุรหัสเคส เช่น: ไทม์ไลน์ CASE-2026-0042";

/**
 * Shared by both the case-lookup and timeline-list commands — deliberately
 * identical whether the case doesn't exist at all or simply isn't assigned
 * to the requesting agent, so an agent can never probe for which case
 * numbers exist in the system.
 */
export const CASE_NOT_FOUND =
  "ไม่พบเคสนี้ หรือคุณไม่มีสิทธิ์เข้าถึง กรุณาตรวจสอบรหัสเคสอีกครั้ง หรือติดต่อผู้ดูแลระบบ";

export const TIMELINE_NO_ENTRIES =
  "ยังไม่มีรายการไทม์ไลน์สำหรับเคสนี้ครับ";

const CASE_STATUS_LABEL: Record<string, string> = {
  new: "ใหม่",
  assigned: "มอบหมายแล้ว",
  active: "กำลังดำเนินการ",
  pending: "รอดำเนินการ",
  closed: "ปิดเคสแล้ว",
};

export function caseStatusLabel(status: string): string {
  return CASE_STATUS_LABEL[status] ?? status;
}

const DESCRIPTION_MAX_CHARS = 200;
const MULTI_MATCH_MAX_LINES = 5;

export type CaseSummaryInput = {
  case_number: string;
  client_name: string | null;
  target_name: string | null;
  status: string;
  case_type: string | null;
  description: string | null;
};

/** Full one-case reply for the case-lookup command. */
export function formatCaseSummary(c: CaseSummaryInput): string {
  const lines = [`📁 เคส ${c.case_number}`];
  if (c.client_name) lines.push(`ลูกค้า: ${c.client_name}`);
  if (c.target_name) lines.push(`เป้าหมาย: ${c.target_name}`);
  lines.push(`สถานะ: ${caseStatusLabel(c.status)}`);
  if (c.case_type) lines.push(`ประเภทคดี: ${c.case_type}`);
  if (c.description) {
    const desc =
      c.description.length > DESCRIPTION_MAX_CHARS
        ? `${c.description.slice(0, DESCRIPTION_MAX_CHARS)}…`
        : c.description;
    lines.push(`รายละเอียด: ${desc}`);
  }
  return lines.join("\n");
}

/** Reply when a loose search matched more than one authorized case. */
export function formatMultipleCaseMatches(cases: CaseSummaryInput[]): string {
  const shown = cases.slice(0, MULTI_MATCH_MAX_LINES);
  const lines = shown.map((c) => {
    const who = c.client_name ?? c.target_name ?? "-";
    return `• ${c.case_number} — ${who} (${caseStatusLabel(c.status)})`;
  });
  return `พบหลายเคสที่ตรงกับคำค้นหา กรุณาระบุรหัสเคสให้ชัดเจนขึ้น:\n\n${lines.join("\n")}`;
}

const TIMELINE_ENTRY_TEXT_MAX_CHARS = 150;

export type TimelineEntrySummaryInput = {
  entry_date: string;
  entry_time: string;
  entry: string;
  location: string | null;
};

/** Reply for the timeline-list command; `entries` is already the (possibly
 * truncated) slice to display, in chronological order; `totalCount` is the
 * full (non-deleted) count for that case so we can note truncation. */
export function formatTimelineList(
  caseNumber: string,
  entries: TimelineEntrySummaryInput[],
  totalCount: number,
): string {
  const lines = entries.map((e) => {
    const text =
      e.entry.length > TIMELINE_ENTRY_TEXT_MAX_CHARS
        ? `${e.entry.slice(0, TIMELINE_ENTRY_TEXT_MAX_CHARS)}…`
        : e.entry;
    const time = e.entry_time.slice(0, 5); // "HH:MM:SS" -> "HH:MM"
    const loc = e.location ? ` (${e.location})` : "";
    return `• ${e.entry_date} ${time} — ${text}${loc}`;
  });

  const header = `🕒 ไทม์ไลน์เคส ${caseNumber}`;
  const footer =
    totalCount > entries.length
      ? `\n\nแสดง ${entries.length} รายการล่าสุดจากทั้งหมด ${totalCount} รายการ`
      : "";

  return `${header}\n\n${lines.join("\n")}${footer}`;
}
