/** Frequently-asked questions for the public marketing site (TH + EN). Used for
 *  both the visible FAQ section and the FAQPage structured data (rich results). */
export interface QA {
  q: string;
  a: string;
}

export const FAQ_TH: QA[] = [
  {
    q: "นักสืบเอกชนเก็บข้อมูลเป็นความลับไหม?",
    a: "ข้อมูลและตัวตนของลูกค้าทุกท่านถูกเก็บเป็นความลับอย่างเคร่งครัด เราไม่เปิดเผยต่อบุคคลที่สามไม่ว่ากรณีใด",
  },
  {
    q: "ค่าจ้างนักสืบคิดอย่างไร ราคาเท่าไหร่?",
    a: "ราคาขึ้นอยู่กับประเภทงาน พื้นที่ ระยะเวลา และความซับซ้อนของแต่ละเคส เราประเมินและแจ้งราคาให้ชัดเจนก่อนเริ่มงานเสมอ ปรึกษาเบื้องต้นฟรี",
  },
  {
    q: "หลักฐานที่ได้ใช้ในชั้นศาลได้ไหม?",
    a: "เราเก็บหลักฐาน ภาพถ่าย วิดีโอ และจัดทำรายงานอย่างเป็นระบบ ที่สามารถนำไปใช้ประกอบในชั้นศาลได้",
  },
  {
    q: "ใช้เวลาดำเนินการนานไหม?",
    a: "ขึ้นอยู่กับลักษณะของงาน บางเคสได้ข้อมูลภายในไม่กี่วัน และเราอัปเดตความคืบหน้าให้ทราบตลอดการทำงาน",
  },
  {
    q: "รับงานสืบพื้นที่ไหนบ้าง?",
    a: "รับงานสืบทั่วราชอาณาจักร ทุกจังหวัดทั่วประเทศไทย",
  },
  {
    q: "เริ่มต้นจ้างนักสืบอย่างไร?",
    a: "ทักทาง LINE หรือโทรเข้ามาปรึกษาฟรี เมื่อตกลงรายละเอียดและราคา ชำระมัดจำงวดแรก 50% แล้วเราเริ่มงานทันที",
  },
];

export const FAQ_EN: QA[] = [
  {
    q: "Is everything kept confidential?",
    a: "Every client's information and identity is kept strictly confidential. We never disclose it to any third party under any circumstances.",
  },
  {
    q: "How is the fee calculated? How much does it cost?",
    a: "Pricing depends on the type of work, the area, the duration and the complexity of each case. We assess and quote a clear price before any work begins. The initial consultation is free.",
  },
  {
    q: "Can the evidence be used in court?",
    a: "We gather evidence, photographs and video and prepare structured reports that can be used to support proceedings in court.",
  },
  {
    q: "How long does an investigation take?",
    a: "It depends on the nature of the case. Some cases produce results within a few days, and we keep you updated on progress throughout.",
  },
  {
    q: "Which areas do you cover?",
    a: "We take on investigations across the whole of Thailand, in every province.",
  },
  {
    q: "How do I get started?",
    a: "Message us on LINE or WhatsApp, or call for a free consultation. Once the details and price are agreed, pay the first 50% instalment and we begin straight away.",
  },
];
