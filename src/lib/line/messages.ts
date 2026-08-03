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
  `• ไทม์ไลน์ <รหัสเคส> — ดูไทม์ไลน์ของเคส\n` +
  `• เพิ่มไทม์ไลน์ <รหัสเคส> <ข้อความ> — เพิ่มรายการไทม์ไลน์ใหม่ (เช่น บันทึกไทม์ไลน์ CASE-2026-0042 พบเป้าหมายที่ห้างสรรพสินค้า)`;

export const INVALID_PHONE =
  `รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง กรุณาพิมพ์ใหม่ เช่น: ${LINK_EXAMPLE}`;

/**
 * Deliberately IDENTICAL reply for every terminal outcome of a "link <phone>"
 * submission whose meaning depends on whether that phone matched a real
 * agent: a unique match (OTP actually sent), zero/ambiguous matches, AND a
 * target-scoped rate-limit hit (OTP withheld — see line_otp_request_target
 * in src/lib/rate-limit.ts). `agents.phone` is sensitive PII; if any of
 * these produced a distinguishable reply, anyone could probe phone numbers
 * against the system with zero authentication. Never reintroduce a
 * match-dependent reply here — see the enumeration-resistance note in
 * handleLinkCommand (src/lib/line/router.ts) for the full reasoning,
 * including why reply latency is also normalized across these outcomes.
 */
export const LINK_REQUEST_ACK =
  "หากเบอร์นี้ลงทะเบียนในระบบ เราจะส่งรหัส OTP ไปให้ทาง SMS กรุณารอรับ SMS แล้วพิมพ์รหัส 6 หลักเพื่อยืนยัน (รหัสหมดอายุใน 10 นาที)";

export const OTP_COOLDOWN =
  "คุณเพิ่งขอรหัส OTP ไปแล้ว กรุณารอสักครู่ก่อนขอรหัสใหม่";

export const RATE_LIMITED =
  "คุณส่งคำขอบ่อยเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง";

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

// ── Add-timeline (write, Round 2) command replies ───────────────────────────

/** Shown when the "add timeline" keyword is recognized but the case number
 * and/or entry text couldn't be parsed out (e.g. missing arguments). */
export const ADD_TIMELINE_EMPTY_ARGS =
  "กรุณาระบุรหัสเคสและข้อความ เช่น: เพิ่มไทม์ไลน์ CASE-2026-0042 พบเป้าหมายที่ห้างสรรพสินค้า";

/**
 * Chat-authored timeline entries are capped well below the `entry` column's
 * unconstrained `text` type (see supabase/migrations/0001_initial_schema.sql)
 * — long enough for a genuine field note dictated over LINE, short enough to
 * keep chat replies/DB rows sane and discourage pasting an entire report
 * into a single entry. Exported so add-timeline.ts enforces the same value
 * this message advertises, rather than two constants drifting apart.
 */
export const ADD_TIMELINE_ENTRY_MAX_CHARS = 2000;

export const ADD_TIMELINE_TOO_LONG =
  `ข้อความยาวเกินไป (สูงสุด ${ADD_TIMELINE_ENTRY_MAX_CHARS} ตัวอักษร) กรุณาย่อข้อความแล้วลองใหม่อีกครั้ง`;

/**
 * Success reply for the add-timeline (write) command. `time` is the stored
 * `entry_time` value (`HH:MM:SS`, Bangkok local) — trimmed to `HH:MM` for
 * display, matching how formatTimelineList() shows times below.
 */
export function formatAddTimelineSuccess(caseNumber: string, time: string): string {
  return `✅ เพิ่มบันทึกไทม์ไลน์ให้เคส ${caseNumber} แล้ว เวลา ${time.slice(0, 5)}`;
}

// ── Attach photo/location (Round 3, stub wiring) command replies ───────────

/**
 * Shown when a photo/location message arrives but there is no open (or the
 * window has expired) pending-attachment window for this agent — i.e.
 * `line_accounts.pending_attachment_entry_id` is null or
 * `pending_attachment_expires_at` is not in the future. This is a normal
 * empty-state reply, not GENERIC_ERROR: nothing went wrong, there is simply
 * nothing to attach to right now.
 */
export const NO_PENDING_ATTACHMENT =
  "ไม่มีบันทึกไทม์ไลน์ที่รอแนบรูป/ตำแหน่งอยู่ กรุณาเพิ่มไทม์ไลน์ก่อนด้วยคำสั่ง เพิ่มไทม์ไลน์ ...";

/**
 * Success reply for the real attach-location (Round 3) command. `locationText`
 * is the exact value now stored on the entry's `timeline_entries.location`
 * column (LINE's address, or a formatted coordinate fallback — see
 * attach-location.ts). `mapsUrl` is a Google Maps link built directly from the
 * raw lat/lng LINE reported (never a re-geocoded search off `locationText`),
 * so the agent gets an immediately-precise confirmation link — see
 * attach-location.ts's module doc for why this is intentionally a separate
 * mechanism from the dashboard/report pipeline's own
 * mapsSearchLink()-from-stored-text rendering (src/app/(dashboard)/timeline/actions.ts).
 */
export function formatAttachLocationSuccess(locationText: string, mapsUrl: string): string {
  return `✅ บันทึกตำแหน่งลงไทม์ไลน์แล้ว: ${locationText}\n(Maps: ${mapsUrl})`;
}

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

// ── Attach photo (Round 3, real implementation) command replies ────────────

/**
 * Shown when a photo follow-up arrives within an open pending-attachment
 * window, but the re-authorization check (case_agents membership for
 * (agentId, pendingCaseId) at attach time — see attach-photo.ts's module
 * doc for the TOCTOU rationale) fails. Deliberately generic/non-enumerating,
 * same principle as CASE_NOT_FOUND: an agent whose case_agents assignment
 * changed between opening the window and sending the photo must not be able
 * to distinguish "no longer assigned" from any other failure mode.
 */
export const ATTACH_PHOTO_UNAUTHORIZED =
  "ไม่สามารถแนบรูปภาพนี้ได้ กรุณาตรวจสอบว่าคุณยังได้รับมอบหมายเคสนี้อยู่ หรือติดต่อผู้ดูแลระบบ";

/** Shown when downloadLineContent() fails to retrieve the photo bytes from
 * LINE's Content API (network/API failure, not a validation rejection). */
export const ATTACH_PHOTO_DOWNLOAD_FAILED =
  "ไม่สามารถดาวน์โหลดรูปภาพจาก LINE ได้ กรุณาลองส่งรูปภาพใหม่อีกครั้ง";

/** Mirrors file-validation.ts's ALLOWED_IMAGE_TYPES — kept as prose here
 * rather than interpolating the MIME list, since agents don't think in MIME
 * types; the dashboard's own upload UI takes the same approach. */
export const ATTACH_PHOTO_INVALID_TYPE =
  "ไม่รองรับไฟล์นี้ กรุณาส่งเป็นรูปภาพ JPEG, PNG หรือ WebP เท่านั้น";

/** `sizeMb` should be derived from file-validation.ts's MAX_IMAGE_SIZE
 * constant by the caller, never a second hardcoded limit here. */
export function formatAttachPhotoTooLarge(sizeMb: number): string {
  return `ไฟล์รูปภาพมีขนาดใหญ่เกินไป (สูงสุด ${sizeMb}MB) กรุณาลองใหม่อีกครั้ง`;
}

/**
 * Success reply for a real (non-stub) photo attach. Deliberately does NOT
 * include the case number/entry details the way formatAddTimelineSuccess()
 * includes the entry time: doing so would require an extra query to resolve
 * `cases.case_number` from `pendingCaseId` purely for display, and an agent
 * sending a follow-up photo already has that context from the "add timeline"
 * confirmation they just received. Kept as a plain constant rather than a
 * `format...()` function for the same reason — no dynamic content to inject.
 */
export const ATTACH_PHOTO_SUCCESS =
  "✅ แนบรูปภาพเข้ากับบันทึกไทม์ไลน์เรียบร้อยแล้ว ส่งรูปเพิ่มเติมได้หากต้องการ";

// ── Attach location (Round 3, real implementation) command replies ─────────

/**
 * Shown when a location follow-up arrives within an open pending-attachment
 * window, but the re-authorization check (case_agents membership for
 * (agentId, pendingCaseId) at attach time — see attach-location.ts's module
 * doc for the TOCTOU rationale) fails. Deliberately mirrors
 * ATTACH_PHOTO_UNAUTHORIZED's exact tone/structure (same non-enumeration
 * principle as CASE_NOT_FOUND) rather than reusing that photo-worded string
 * verbatim, since its text names "รูปภาพ" (photo) specifically.
 */
export const ATTACH_LOCATION_UNAUTHORIZED =
  "ไม่สามารถแนบตำแหน่งนี้ได้ กรุณาตรวจสอบว่าคุณยังได้รับมอบหมายเคสนี้อยู่ หรือติดต่อผู้ดูแลระบบ";

// ── Target intelligence (Round 4, stub wiring only) command replies ────────

/**
 * Temporary placeholder reply for the "ข่าวกรอง <รหัสเคส>" / "intel <case>"
 * command while it is still a stub (src/lib/line/commands/intel.ts) — see
 * that file's module doc for the handoff contract the real implementation
 * must follow. Replace once the real target-intelligence query/decrypt/
 * photo-fetching logic lands.
 */
export const INTEL_COMMAND_STUB =
  "🔒 คำสั่งข่าวกรองเป้าหมายกำลังอยู่ระหว่างการพัฒนา ยังไม่พร้อมใช้งานในขณะนี้";
