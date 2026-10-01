/** Partner relationship stages (docs/china-market/13). */
export const PARTNER_STAGES = ["new", "contacted", "call_scheduled", "agreement", "active", "inactive"] as const;
export type PartnerStage = (typeof PARTNER_STAGES)[number];

export const PARTNER_STAGE_LABELS: Record<PartnerStage, { th: string; zh: string; en: string }> = {
  new:            { th: "ใหม่",            zh: "新申请",   en: "New" },
  contacted:      { th: "ติดต่อแล้ว",      zh: "已联系",   en: "Contacted" },
  call_scheduled: { th: "นัดคุยแล้ว",      zh: "已安排通话", en: "Call scheduled" },
  agreement:      { th: "ทำข้อตกลง",       zh: "签署协议",  en: "Agreement" },
  active:         { th: "ใช้งานอยู่",       zh: "合作中",   en: "Active" },
  inactive:       { th: "ไม่ได้ใช้งาน",    zh: "暂停",     en: "Inactive" },
};

export function isPartnerStage(v: unknown): v is PartnerStage {
  return typeof v === "string" && (PARTNER_STAGES as readonly string[]).includes(v);
}

export const PARTNER_TYPE_LABELS: Record<string, { th: string; zh: string }> = {
  law_firm:        { th: "สำนักงานกฎหมาย",          zh: "律师事务所" },
  chinese_company: { th: "บริษัทจีนในไทย",           zh: "在泰中资企业" },
  consultant:      { th: "ที่ปรึกษาธุรกิจ",           zh: "商业咨询 / 注册代理" },
  accounting:      { th: "สำนักงานบัญชี",            zh: "会计师事务所" },
  advisory:        { th: "ที่ปรึกษาองค์กร / M&A",     zh: "企业顾问 / 并购" },
  relocation:      { th: "บริษัทย้ายถิ่นฐาน",         zh: "移居 / 安置服务" },
  investment:      { th: "ที่ปรึกษาการลงทุน",         zh: "投资顾问" },
  risk:            { th: "บริษัทที่ปรึกษาความเสี่ยง", zh: "风险咨询" },
  lawyer:          { th: "ทนายพูดจีนในไทย",           zh: "泰国中文律师" },
  other:           { th: "อื่น ๆ",                    zh: "其他" },
};

export const PARTNER_SERVICE_LABELS: Record<string, { th: string; zh: string }> = {
  due_diligence:        { th: "ดีลิเจนซ์ธุรกิจ",       zh: "商业尽职调查" },
  company_verification: { th: "ตรวจสอบบริษัท",         zh: "公司核实" },
  on_site:              { th: "ตรวจสอบหน้างาน",        zh: "实地核实" },
  counterparty:         { th: "ตรวจสอบคู่สัญญา",        zh: "交易对手核实" },
  supplier:             { th: "ตรวจสอบซัพพลายเออร์",   zh: "供应商核实" },
  asset:                { th: "สืบทรัพย์สิน",           zh: "资产调查" },
  litigation_support:   { th: "สนับสนุนคดีความ",       zh: "诉讼支持" },
};
