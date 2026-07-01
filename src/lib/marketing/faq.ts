/** Frequently-asked questions for the public marketing site (TH + EN). Used for
 *  both the visible FAQ section and the FAQPage structured data (rich results).
 *  The visible list and the JSON-LD must stay in sync — both read these arrays. */
export interface QA {
  q: string;
  a: string;
}

export const FAQ_TH: QA[] = [
  {
    q: "Detective Pulse คืออะไร?",
    a: "Detective Pulse เป็นบริษัทนักสืบเอกชนมืออาชีพ ให้บริการสืบสวนและติดตามข้อมูลในหลากหลายด้านทั่วประเทศไทย",
  },
  {
    q: "Detective Pulse มีบริการอะไรบ้าง?",
    a: "เราให้บริการหลายด้าน — สืบคดีชู้สาว (ติดตามพฤติกรรมของคู่สมรสหรือผู้ที่สงสัยว่านอกใจ), สืบหาบุคคลและสืบประวัติ (หาที่อยู่บุคคล สืบพฤติกรรม หรือเช็คประวัติก่อนเข้าทำงาน), สืบทรัพย์สิน (บ้าน คอนโด รถ ที่ดิน หรือเงินในบัญชีธนาคาร), สืบยานพาหนะ (เช็คทะเบียนรถ ตรวจสอบการโจรกรรม หรือติดตามรถหาย) และสืบข้อมูลไอที (เฟซบุ๊ก ไลน์ หรือสื่อออนไลน์อื่น ๆ)",
  },
  {
    q: "ติดต่อ Detective Pulse ได้อย่างไร?",
    a: "ติดต่อได้ที่ โทรศัพท์ 096-846-1406, อีเมล detectivepluse@gmail.com หรือ LINE: @detectivepluse",
  },
  {
    q: "ความเป็นส่วนตัวของข้อมูลลูกค้าได้รับการป้องกันอย่างไร?",
    a: "เรามีมาตรการรักษาความลับของข้อมูลลูกค้าอย่างเข้มงวด ข้อมูลทุกอย่างจะถูกเก็บเป็นความลับและปลอดภัย",
  },
  {
    q: "ค่าใช้จ่ายในการใช้บริการเป็นอย่างไร?",
    a: "ค่าใช้จ่ายขึ้นอยู่กับประเภทและความซับซ้อนของงาน กรุณาติดต่อเราเพื่อปรึกษาและขอใบเสนอราคา",
  },
  {
    q: "การชำระเงินสามารถทำได้อย่างไร?",
    a: "หลังจากตกลงรายละเอียดงานและราคาแล้ว จะมีการชำระงวดแรก 50% ของราคางานก่อนเริ่มงาน และชำระงวดสุดท้ายก่อนรับข้อมูล",
  },
  {
    q: "ระยะเวลาในการดำเนินงานนานเท่าใด?",
    a: "ระยะเวลาขึ้นอยู่กับความซับซ้อนของงาน แต่เรามุ่งมั่นที่จะดำเนินการให้เสร็จภายในเวลาที่กำหนด และจะแจ้งความคืบหน้าให้คุณทราบอย่างต่อเนื่อง",
  },
  {
    q: "บริการครอบคลุมพื้นที่ใดบ้าง?",
    a: "เรารับงานทั่วราชอาณาจักร ไม่ว่าจะเป็นกรุงเทพมหานครหรือจังหวัดอื่น ๆ",
  },
  {
    q: "ฉันจะได้รับรายงานผลการสืบสวนอย่างไร?",
    a: "เราจะส่งรายงานและหลักฐานที่ได้จากการสืบสวนให้คุณผ่านช่องทางที่ตกลงกันไว้ เช่น อีเมล หรือวิธีการอื่น ๆ ที่คุณสะดวก",
  },
  {
    q: "ฉันสามารถยกเลิกบริการได้หรือไม่?",
    a: "หากยกเลิกโดยผู้ว่าจ้าง จะไม่มีการคืนเงินมัดจำ กรุณาติดต่อเราเพื่อสอบถามรายละเอียดเพิ่มเติม",
  },
];

export const FAQ_EN: QA[] = [
  {
    q: "What is Detective Pulse?",
    a: "Detective Pulse is a professional private-investigation agency providing investigation and information-tracking services across many areas, nationwide in Thailand.",
  },
  {
    q: "What services does Detective Pulse offer?",
    a: "We offer a range of services — infidelity investigation (tracking a spouse or a partner suspected of cheating), finding people and background checks (locating a person, checking behaviour, or pre-employment checks), asset investigation (house, condo, car, land, or funds in bank accounts), vehicle investigation (checking a registration, investigating theft, or tracing a missing vehicle), and cyber/IT investigation (Facebook, LINE, and other online media).",
  },
  {
    q: "How do I contact Detective Pulse?",
    a: "You can reach us by phone at +66 96-846-1406, by email at detectivepluse@gmail.com, or on LINE: @detectivepluse",
  },
  {
    q: "How is my personal data protected?",
    a: "We keep client information strictly confidential. Everything you share is stored securely and kept private.",
  },
  {
    q: "How much do your services cost?",
    a: "The cost depends on the type and complexity of the work. Please contact us for a consultation and a quote.",
  },
  {
    q: "How does payment work?",
    a: "Once the scope and price are agreed, a first instalment of 50% is paid before work begins, and the final instalment is paid before the results are handed over.",
  },
  {
    q: "How long does an investigation take?",
    a: "It depends on the complexity of the case, but we are committed to finishing within the agreed timeframe and will keep you updated on progress throughout.",
  },
  {
    q: "Which areas do you cover?",
    a: "We take on work across the whole kingdom — Bangkok and every other province.",
  },
  {
    q: "How will I receive the investigation report?",
    a: "We deliver the report and the evidence gathered through the channel you prefer — email or another method that is convenient for you.",
  },
  {
    q: "Can I cancel the service?",
    a: "If the client cancels, the deposit is non-refundable. Please contact us for further details.",
  },
];
