/** Tone refinement options for the Creative Director (shared by client + server). */
export const TONE_OPTIONS = [
  { key: "professional", label: "มืออาชีพขึ้น" },
  { key: "engaging", label: "ดึงดูดขึ้น" },
  { key: "friendly", label: "เป็นกันเองขึ้น" },
] as const;

export type ToneKey = (typeof TONE_OPTIONS)[number]["key"];
export const TONE_KEYS = TONE_OPTIONS.map((t) => t.key) as [ToneKey, ...ToneKey[]];

export const TONE_INSTRUCTIONS: Record<ToneKey, string> = {
  professional: "ปรับทุกไอเดียให้เป็นมืออาชีพขึ้น น่าเชื่อถือ สุภาพ ลดความหวือหวา ใช้ภาษาที่นักสืบผู้มีประสบการณ์จะพูดจริง",
  engaging: "ปรับทุกไอเดียให้ดึงดูดขึ้น hook แรงขึ้นใน 2 วินาทีแรก สร้างความสงสัยแบบไม่หลอกลวง แต่ยังคงความน่าเชื่อถือของแบรนด์",
  friendly: "ปรับทุกไอเดียให้เป็นกันเองขึ้น ภาษาพูดธรรมชาติเหมือนเล่าให้เพื่อนฟัง อบอุ่น เข้าใจความรู้สึกของคนที่กำลังกังวล แต่ไม่เล่นตลกกับเรื่องละเอียดอ่อน",
};
