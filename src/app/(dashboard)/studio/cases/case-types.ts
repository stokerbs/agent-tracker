/**
 * Case Insights — display metadata local to this module (studio_cases.case_type
 * is free text in the schema; these are the values the UI offers).
 */
export const CASE_TYPE_META: Record<string, { label: string }> = {
  infidelity: { label: "ชู้สาว / พฤติกรรมคู่สมรส" },
  surveillance: { label: "เฝ้าติดตาม" },
  background_check: { label: "เช็คประวัติบุคคล" },
  missing_person: { label: "คนหาย" },
  asset_search: { label: "สืบทรัพย์" },
  vehicle: { label: "ติดตามยานพาหนะ" },
  online_fraud: { label: "หลอกลวงออนไลน์" },
  address_verification: { label: "ตรวจสอบที่อยู่" },
  other: { label: "อื่น ๆ" },
};
export const CASE_TYPES = Object.keys(CASE_TYPE_META);

export const POTENTIAL_META: Record<string, { label: string; badge: string }> = {
  low: { label: "ศักยภาพต่ำ", badge: "bg-muted text-muted-foreground border-border" },
  medium: { label: "ศักยภาพกลาง", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  high: { label: "ศักยภาพสูง", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
};

/** Text fields of a studio case that go through the privacy scan. */
export const CASE_TEXT_FIELDS = [
  "title",
  "situation",
  "objective",
  "method",
  "observations",
  "outcome",
  "lessons",
  "interesting_insight",
  "anonymized_version",
] as const;
export type CaseTextField = (typeof CASE_TEXT_FIELDS)[number];

export const CASE_FIELD_LABELS: Record<CaseTextField, string> = {
  title: "ชื่อเคส",
  situation: "สถานการณ์",
  objective: "วัตถุประสงค์",
  method: "วิธีสืบ",
  observations: "สิ่งที่พบ",
  outcome: "ผลลัพธ์",
  lessons: "บทเรียน",
  interesting_insight: "จุดที่น่าสนใจ",
  anonymized_version: "เวอร์ชันไม่ระบุตัวตน",
};

export const PRIVACY_NOTE = "บันทึกเฉพาะข้อมูลที่ generalise แล้ว — ห้ามใส่ชื่อ เบอร์ ทะเบียน ที่อยู่";
