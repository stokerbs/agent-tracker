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
