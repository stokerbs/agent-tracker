import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { FAQ_TH } from "@/lib/marketing/faq";
import type { Pillar, Platform } from "@/lib/studio/types";

/**
 * Demo / starter data for the Creative Studio.
 *
 * Two kinds of rows are inserted:
 *  1. REAL company knowledge that already lives in the repo (public FAQ) →
 *     is_demo = false, approved_for_content = true.
 *  2. Clearly labelled DEMO records (DEMO-00x cases, sample ideas/content) →
 *     is_demo = true / tag "demo". No real clients, no identifiable cases.
 *
 * Idempotent: cases dedupe on case_code, knowledge on origin_ref, questions on
 * question text, masters on the "demo" tag + title. `removeDemoData()` deletes
 * only is_demo rows and demo-tagged content.
 */

const DEMO_TAG = "demo";

interface KnowledgeSeed {
  title: string;
  content: string;
  summary?: string;
  source_type: string;
  category: string;
  tags: string[];
  sensitivity: "public" | "internal";
  origin_ref: string;
  is_demo: boolean;
}

const KNOWLEDGE: KnowledgeSeed[] = [
  {
    title: "GPS บอกอะไรได้ และบอกอะไรไม่ได้",
    summary: "GPS ระบุตำแหน่งอุปกรณ์/ยานพาหนะ ไม่ใช่ตัวบุคคล ต้องใช้การเฝ้าติดตามและหลักฐานอื่นยืนยันร่วม",
    content: `GPS ติดตามให้ข้อมูล "ตำแหน่งของอุปกรณ์" ในช่วงเวลาหนึ่ง ไม่ได้บอกว่าใครอยู่กับอุปกรณ์นั้น
สิ่งที่ GPS ทำได้ดี: รูปแบบการเดินทางซ้ำ ๆ, จุดจอดนาน, เส้นทางที่เบี่ยงจากปกติ, เวลาออก-กลับ
สิ่งที่ GPS ทำไม่ได้: ยืนยันว่าเป้าหมายอยู่ในรถ, บอกว่าพบใคร, บอกสิ่งที่เกิดขึ้นในอาคาร
ข้อจำกัดทางเทคนิค: สัญญาณหายในอาคาร/ลานจอดใต้ดิน, ความคลาดเคลื่อน 5–30 เมตรในเมือง, แบตเตอรี่, การส่งข้อมูลแบบมีช่วงเวลา (ไม่ใช่เรียลไทม์ 100%)
บทเรียนจากงานจริง: รถจอดที่เดิม แต่คนไม่ได้อยู่กับรถ — ถ้าไม่มีการเฝ้าสังเกตยืนยัน ข้อมูล GPS อย่างเดียวตีความผิดได้ง่าย
ข้อกฎหมาย: การติดอุปกรณ์ติดตามกับทรัพย์สินของผู้อื่นโดยไม่ได้รับความยินยอมมีความเสี่ยงทางกฎหมาย ควรปรึกษาก่อนเสมอ`,
    source_type: "investigator_knowledge",
    category: "gps",
    tags: ["gps", "ข้อจำกัด", "หลักฐาน"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/gps-limits",
    is_demo: true,
  },
  {
    title: "ทำไมการตามคนเองถึงพลาดง่าย",
    summary: "คนทั่วไปตามแฟน/คู่สมรสเองมักถูกจับได้ ทำให้เป้าหมายระวังตัว และหลักฐานที่ได้ใช้ต่อไม่ได้",
    content: `ข้อผิดพลาดที่พบบ่อยเมื่อลูกค้าเคยลองตามเอง:
1) ใช้รถของตัวเองที่เป้าหมายจำได้ 2) ขับตามใกล้เกินไป 3) จอดรอในจุดที่มองเห็นได้ชัด 4) ถ่ายภาพจากมุมที่ไม่ยืนยันเวลา/สถานที่ 5) เผชิญหน้าทันทีเมื่อเห็นบางอย่าง
ผลที่ตามมา: เป้าหมายเปลี่ยนพฤติกรรม ระวังตัวมากขึ้น ทำให้การสืบต่อยากขึ้นหลายเท่า และหลักฐานที่ได้มาแบบอารมณ์มักไม่ครบองค์ประกอบ
นักสืบวางแผนต่างจากคนทั่วไปอย่างไร: ศึกษาเส้นทางล่วงหน้า ใช้ทีมมากกว่าหนึ่งคนเมื่อจำเป็น เลือกจุดสังเกตที่มีเหตุผลในการอยู่ตรงนั้น บันทึกเวลาและตำแหน่งทุกครั้ง และรู้ว่าเมื่อไหร่ต้อง "ปล่อย" เพื่อไม่ให้ถูกจับได้`,
    source_type: "investigator_knowledge",
    category: "surveillance",
    tags: ["การเฝ้าติดตาม", "ข้อผิดพลาด", "นอกใจ"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/diy-mistakes",
    is_demo: true,
  },
  {
    title: "หลักฐานแบบไหนมีประโยชน์กับลูกค้าจริง",
    summary: "หลักฐานที่ดีคือหลักฐานที่ระบุเวลา สถานที่ และเชื่อมโยงกันเป็นลำดับ ไม่ใช่ภาพเดียวที่ตีความได้หลายทาง",
    content: `องค์ประกอบของหลักฐานที่ใช้ได้จริง: (1) ระบุเวลาชัด (2) ระบุสถานที่ได้ (3) เห็นความต่อเนื่องของเหตุการณ์ (4) มีบันทึกประกอบ (timeline) (5) ได้มาโดยชอบด้วยกฎหมาย
ภาพเดียวของคนสองคนเดินด้วยกัน มีน้ำหนักน้อยกว่าบันทึกต่อเนื่องที่แสดงรูปแบบซ้ำในหลายวัน
สิ่งที่ลูกค้าคาดหวังผิด: ต้องการ "ภาพเด็ด" ภาพเดียว แต่สิ่งที่ทนายและศาลให้น้ำหนักคือลำดับเหตุการณ์ที่ยืนยันซ้ำได้
วิธีที่เราส่งมอบ: รายงานตามลำดับเวลา + ภาพ/วิดีโอที่มีเวลาและตำแหน่งกำกับ + สรุปข้อสังเกต ไม่ใส่การตีความเกินข้อเท็จจริง`,
    source_type: "investigator_knowledge",
    category: "investigator_knowledge",
    tags: ["หลักฐาน", "รายงาน", "กฎหมาย"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/evidence-that-matters",
    is_demo: true,
  },
  {
    title: "สิ่งแรกที่นักสืบต้องรู้ก่อนเริ่มงาน",
    summary: "ก่อนเริ่มเฝ้าติดตาม นักสืบต้องรู้เป้าหมายของลูกค้า ข้อมูลพื้นฐานของเป้าหมาย และขอบเขตทางกฎหมาย",
    content: `คำถามที่เราถามลูกค้าก่อนรับงาน: ต้องการรู้อะไรกันแน่ (พฤติกรรม? บุคคลที่พบ? สถานที่?) จะเอาผลไปทำอะไร (ตัดสินใจส่วนตัว / ปรึกษาทนาย) มีข้อมูลพื้นฐานอะไรบ้าง (รูปแบบการใช้ชีวิต ยานพาหนะ ช่วงเวลาที่น่าสงสัย)
เหตุผล: งานสืบที่ไม่มีเป้าหมายชัดจะกินเวลาและงบประมาณโดยไม่ได้คำตอบ
ขอบเขตกฎหมายที่เราไม่ข้าม: ไม่เข้าถึงข้อมูลส่วนตัวโดยไม่ชอบ (แฮก โทรศัพท์ บัญชี) ไม่บุกรุกที่พักอาศัย ไม่แอบอ้างเจ้าหน้าที่
ลูกค้าที่เตรียมข้อมูลพื้นฐานมาดี ช่วยลดวันทำงานได้มาก`,
    source_type: "owner_experience",
    category: "owner_experience",
    tags: ["ขั้นตอน", "รับงาน", "กฎหมาย"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/before-we-start",
    is_demo: true,
  },
  {
    title: "OSINT คืออะไรในงานนักสืบ",
    summary: "OSINT คือการสืบจากข้อมูลสาธารณะ (โซเชียล เว็บ ทะเบียนสาธารณะ) อย่างเป็นระบบ ไม่ใช่การแฮก",
    content: `OSINT (Open Source Intelligence) = รวบรวมและเชื่อมโยงข้อมูลที่เปิดเผยอยู่แล้ว เช่น โปรไฟล์โซเชียล รูปที่โพสต์สาธารณะ รีวิว ประกาศ ทะเบียนธุรกิจ
ใช้ทำอะไร: ยืนยันตัวตน หาความเชื่อมโยงระหว่างบุคคล ตรวจสอบพื้นฐานก่อนคบหา/ร่วมธุรกิจ ประเมินความน่าเชื่อถือของคนที่ติดต่อมาออนไลน์
ข้อจำกัด: ข้อมูลเก่า ข้อมูลปลอม บัญชีส่วนตัวที่ปิด — OSINT ให้ "เบาะแส" ไม่ใช่ข้อสรุป ต้องตรวจสอบซ้ำ
สิ่งที่ไม่ใช่ OSINT: การเข้าถึงบัญชีผู้อื่น การซื้อข้อมูลรั่ว การหลอกถามข้อมูล (เราไม่ทำ)`,
    source_type: "osint",
    category: "osint",
    tags: ["osint", "ออนไลน์", "เช็คประวัติ"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/osint-basics",
    is_demo: true,
  },
  {
    title: "เช็คประวัติบุคคลจากชื่อ-นามสกุล ทำได้แค่ไหน",
    summary: "จากชื่อ-นามสกุลเพียงอย่างเดียว ตรวจสอบได้ระดับหนึ่งจากแหล่งสาธารณะ ยิ่งมีข้อมูลประกอบยิ่งแม่นขึ้น และต้องอยู่ในกรอบกฎหมาย",
    content: `สิ่งที่มักตรวจได้จากชื่อ-นามสกุล + ข้อมูลประกอบ (จังหวัด อายุโดยประมาณ อาชีพ): ร่องรอยออนไลน์สาธารณะ ความเชื่อมโยงทางธุรกิจที่จดทะเบียน ประวัติที่เผยแพร่สาธารณะ
สิ่งที่ตรวจไม่ได้/ไม่ทำ: ข้อมูลทางการที่ต้องใช้อำนาจรัฐ ข้อมูลสุขภาพ ข้อมูลการเงินส่วนบุคคล
ชื่อซ้ำเป็นปัญหาใหญ่ — ต้องมีตัวเชื่อมอย่างน้อยหนึ่งอย่าง (รูป จังหวัด ที่ทำงาน)
กรณีที่ลูกค้าใช้บริการบ่อย: ก่อนแต่งงาน ก่อนร่วมทุน ก่อนรับพนักงานตำแหน่งสำคัญ ตรวจคนที่ติดต่อมาขายของ/ชวนลงทุน`,
    source_type: "service",
    category: "services",
    tags: ["เช็คประวัติ", "ชื่อนามสกุล", "ก่อนแต่งงาน"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/background-check-by-name",
    is_demo: true,
  },
  {
    title: "ตามหาคนหาย / คนที่ติดต่อไม่ได้ เริ่มจากอะไร",
    summary: "การตามหาคนเริ่มจากข้อมูลสุดท้ายที่รู้ ความสัมพันธ์รอบตัว และร่องรอยดิจิทัล ระยะเวลาขึ้นกับความสดของข้อมูล",
    content: `ข้อมูลที่ช่วยได้มากที่สุด: สถานที่/เวลาที่ติดต่อได้ล่าสุด รูปถ่ายล่าสุด ยานพาหนะ ญาติ-เพื่อนที่อาจติดต่อ พฤติกรรมออนไลน์
กรณีที่พบบ่อย: ลูกหนี้หลบหนี ญาติที่ขาดการติดต่อ คู่ค้าที่หายไปหลังรับเงิน คนที่โกงออนไลน์
ความเป็นจริง: ยิ่งข้อมูลสดยิ่งเร็ว ข้อมูลเก่าหลายปีต้องใช้เวลาและอาจไม่ได้ผล เราจะประเมินโอกาสก่อนรับงานเสมอ
เมื่อพบตัวแล้ว: เราส่งมอบตำแหน่ง/ข้อมูลยืนยัน ไม่ทำการเผชิญหน้าแทนลูกค้า และแนะนำให้ดำเนินการผ่านกฎหมายเมื่อเป็นเรื่องหนี้`,
    source_type: "service",
    category: "services",
    tags: ["ตามหาคน", "คนหาย", "ลูกหนี้"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/find-people",
    is_demo: true,
  },
  {
    title: "สัญญาณเตือนการหลอกลวงออนไลน์ที่เราเห็นบ่อย",
    summary: "รูปแบบที่ซ้ำ: เร่งให้ตัดสินใจ ห้ามบอกคนอื่น โปรไฟล์สวยแต่ประวัติสั้น ขอย้ายไปคุยช่องทางส่วนตัว ขอเงินก่อนเสมอ",
    content: `สัญญาณที่เจอซ้ำในเคสที่ลูกค้าถูกหลอก: 1) เร่งรัดให้ตัดสินใจภายในวันนั้น 2) บอกให้เก็บเป็นความลับ 3) โปรไฟล์ดูดีแต่มีอายุบัญชีสั้น/เพื่อนน้อย 4) หลีกเลี่ยงวิดีโอคอลหรือนัดพบ 5) เรื่องราวเปลี่ยนไปเมื่อถามซ้ำ 6) ขอให้โอนเงิน/ซื้อของก่อนเสมอ
สิ่งที่ทำได้เอง: ค้นรูปย้อนกลับ ตรวจอายุบัญชี ถามคำถามที่ต้องใช้ความจำต่อเนื่อง
เมื่อควรใช้นักสืบ: มูลค่าความเสียหายสูง ต้องการยืนยันตัวตนคนที่ติดต่อมา หรือต้องรวบรวมหลักฐานเพื่อแจ้งความ`,
    source_type: "investigator_knowledge",
    category: "investigator_knowledge",
    tags: ["หลอกลวง", "ออนไลน์", "สัญญาณเตือน"],
    sensitivity: "public",
    origin_ref: "seed/knowledge/scam-red-flags",
    is_demo: true,
  },
];

function faqKnowledge(): KnowledgeSeed[] {
  return FAQ_TH.map((qa, i) => ({
    title: qa.q,
    content: qa.a,
    summary: undefined,
    source_type: "customer_question",
    category: "customer_questions",
    tags: ["faq", "บริการ"],
    sensitivity: "public" as const,
    origin_ref: `marketing/faq.ts#${i}`,
    is_demo: false,
  }));
}

interface CaseSeed {
  case_code: string;
  case_type: string;
  title: string;
  situation: string;
  objective: string;
  method: string;
  observations: string;
  outcome: string;
  lessons: string;
  interesting_insight: string;
  content_potential: "low" | "medium" | "high";
  anonymized_version: string;
  tags: string[];
  insights: { title: string; insight: string; lesson: string; content_angle: string; pillar: Pillar }[];
}

const CASES: CaseSeed[] = [
  {
    case_code: "DEMO-001",
    case_type: "infidelity",
    title: "รถอยู่ที่เดิม แต่คนไม่ได้อยู่กับรถ",
    situation: "ลูกค้าสงสัยคู่สมรส ติด GPS ที่รถด้วยตนเองมาก่อนแล้ว พบว่ารถจอดที่ทำงานตลอดวันจึงคิดว่าไม่มีอะไร แต่ยังรู้สึกผิดปกติ",
    objective: "ยืนยันว่าพฤติกรรมช่วงกลางวันเป็นไปตามที่เป้าหมายบอกหรือไม่",
    method: "เฝ้าสังเกตที่ทางเข้าอาคาร 3 วันทำงานในสัปดาห์เดียว โดยไม่พึ่งข้อมูล GPS เป็นหลัก",
    observations: "เป้าหมายออกจากอาคารด้วยรถของบุคคลอื่นช่วงพักกลางวัน 2 ใน 3 วัน กลับมาก่อนเวลาเลิกงาน รถของเป้าหมายไม่เคลื่อนที่",
    outcome: "ลูกค้าได้ไทม์ไลน์พร้อมภาพที่ระบุเวลา นำไปปรึกษาทนาย",
    lessons: "GPS ติดตามยานพาหนะยืนยันได้แค่ตำแหน่งรถ การเฝ้าสังเกตคือสิ่งที่ยืนยันบุคคล",
    interesting_insight: "ลูกค้าเกือบเลิกสงสัยเพราะ 'ข้อมูลบอกว่าปลอดภัย' — ข้อมูลไม่ผิด แต่ตีความผิด",
    content_potential: "high",
    anonymized_version: "ครั้งหนึ่งมีลูกค้ามั่นใจว่าคู่ของตัวเองอยู่ที่ทำงานทั้งวัน เพราะรถไม่ได้ขยับเลย ปรากฏว่าคนไม่ได้อยู่กับรถ การเฝ้าสังเกตเพียงไม่กี่วันทำให้เห็นภาพที่เครื่องมือบอกไม่ได้",
    tags: ["gps", "นอกใจ", "เฝ้าติดตาม"],
    insights: [
      {
        title: "GPS ยืนยันรถ ไม่ยืนยันคน",
        insight: "ข้อมูลตำแหน่งยานพาหนะที่นิ่งอยู่ที่เดิมทั้งวัน ไม่ได้แปลว่าบุคคลอยู่ที่นั่น การเคลื่อนที่ของคนอาจใช้ยานพาหนะของผู้อื่น",
        lesson: "อย่าสรุปจากข้อมูลเครื่องมือชิ้นเดียว ต้องมีการยืนยันด้วยการสังเกต",
        content_angle: "เปิดด้วยความมั่นใจของลูกค้า แล้วพลิกด้วยข้อจำกัดของ GPS",
        pillar: "case_story",
      },
      {
        title: "ข้อมูลไม่ผิด แต่ตีความผิด",
        insight: "ปัญหาส่วนใหญ่ไม่ใช่ข้อมูลผิด แต่คือการตีความเกินสิ่งที่ข้อมูลบอกได้",
        lesson: "ตั้งคำถามว่าข้อมูลนี้ 'ยืนยัน' อะไรได้จริง ๆ ก่อนตัดสินใจ",
        content_angle: "มุมมองนักสืบ: เราตั้งคำถามกับข้อมูลอย่างไร",
        pillar: "detective_pov",
      },
    ],
  },
  {
    case_code: "DEMO-002",
    case_type: "infidelity",
    title: "ตามเองสองสัปดาห์ จนเป้าหมายรู้ตัว",
    situation: "ลูกค้าเคยขับรถตามคู่สมรสเองหลายครั้ง เป้าหมายเริ่มเปลี่ยนเส้นทางและเวลาไม่แน่นอน",
    objective: "เก็บพฤติกรรมช่วงเย็นหลังเลิกงานโดยไม่ให้เป้าหมายรู้ตัว",
    method: "พักการติดตาม 1 สัปดาห์เพื่อให้เป้าหมายผ่อนคลาย จากนั้นใช้ทีม 2 คน 2 ยานพาหนะ สลับกันในระยะห่างที่ปลอดภัย",
    observations: "เป้าหมายกลับมาใช้เส้นทางเดิมหลังจากไม่ถูกตามระยะหนึ่ง พบการนัดพบซ้ำในสถานที่เดิมสองครั้งในสัปดาห์เดียว",
    outcome: "ได้บันทึกต่อเนื่องสองสัปดาห์ ลูกค้าตัดสินใจเรื่องครอบครัวได้บนข้อเท็จจริง",
    lessons: "การตามเองทำให้เป้าหมายระวังตัวและงานยากขึ้น การถอยเป็นส่วนหนึ่งของแผน",
    interesting_insight: "การ 'ไม่ตาม' หนึ่งสัปดาห์คือขั้นตอนที่สำคัญที่สุดของเคสนี้",
    content_potential: "high",
    anonymized_version: "เคสหนึ่งลูกค้าลองตามคู่ของตัวเองอยู่หลายสัปดาห์จนอีกฝ่ายรู้ตัวและเปลี่ยนพฤติกรรม สิ่งแรกที่ทีมทำคือหยุดทุกอย่างหนึ่งสัปดาห์ให้อีกฝ่ายผ่อนคลาย จากนั้นค่อยเริ่มใหม่ด้วยทีมและระยะที่ปลอดภัย",
    tags: ["เฝ้าติดตาม", "ข้อผิดพลาด", "นอกใจ"],
    insights: [
      {
        title: "การถอยคือส่วนหนึ่งของแผน",
        insight: "เมื่อเป้าหมายระวังตัว การหยุดติดตามชั่วคราวช่วยให้พฤติกรรมกลับสู่ปกติ และทำให้การสังเกตหลังจากนั้นได้ผลจริง",
        lesson: "ความอดทนเป็นเครื่องมือของนักสืบ ไม่ใช่การเสียเวลา",
        content_angle: "ทำไมนักสืบถึง 'หยุด' ก่อนจะเริ่ม",
        pillar: "detective_pov",
      },
      {
        title: "ทำไมตามเองแล้วพลาด",
        insight: "รถที่เป้าหมายจำได้ ระยะที่ใกล้เกินไป และการเผชิญหน้าทันที คือสามข้อผิดพลาดที่ทำให้งานยากขึ้นหลายเท่า",
        lesson: "ถ้าคิดจะตามเอง ให้รู้ว่าความเสี่ยงคือทำให้ความจริงหายาก ไม่ใช่แค่ถูกจับได้",
        content_angle: "ความรู้: 5 ข้อผิดพลาดของการตามเอง",
        pillar: "detective_knowledge",
      },
    ],
  },
  {
    case_code: "DEMO-003",
    case_type: "background_check",
    title: "เช็คประวัติก่อนแต่งงาน — ชื่อซ้ำเกือบทำให้สรุปผิด",
    situation: "ลูกค้าต้องการตรวจสอบพื้นฐานว่าที่คู่ครองซึ่งรู้จักกันไม่นาน มีเพียงชื่อ-นามสกุลและจังหวัดบ้านเกิด",
    objective: "ยืนยันตัวตน อาชีพ และความเชื่อมโยงทางธุรกิจตามที่บอกไว้",
    method: "OSINT จากแหล่งสาธารณะ + ยืนยันตัวเชื่อมด้วยรูปและที่ทำงาน ก่อนนำผลไปสรุป",
    observations: "พบบุคคลชื่อเดียวกันสองคนในจังหวัดเดียวกัน คนหนึ่งมีประวัติเชิงลบ ต้องใช้รูปและที่ทำงานเป็นตัวแยก จึงพบว่าไม่ใช่คนเดียวกับเป้าหมาย",
    outcome: "ยืนยันได้ว่าข้อมูลที่เป้าหมายบอกตรงกับความจริง ลูกค้าสบายใจ",
    lessons: "ชื่อ-นามสกุลอย่างเดียวไม่พอ ต้องมีตัวเชื่อมอย่างน้อยหนึ่งอย่างก่อนสรุป",
    interesting_insight: "ถ้ารีบสรุปจากชื่อ ลูกค้าจะได้ข้อมูลผิดที่ทำลายความสัมพันธ์โดยไม่มีมูล",
    content_potential: "high",
    anonymized_version: "เคสเช็คประวัติก่อนแต่งงานครั้งหนึ่ง เกือบสรุปผิดเพราะมีคนชื่อเดียวกันในจังหวัดเดียวกัน ทีมต้องหาตัวเชื่อม (รูป ที่ทำงาน) ก่อนยืนยัน สุดท้ายพบว่าข้อมูลที่อีกฝ่ายบอกเป็นความจริง",
    tags: ["เช็คประวัติ", "osint", "ก่อนแต่งงาน"],
    insights: [
      {
        title: "ชื่อซ้ำคือกับดักของการเช็คประวัติ",
        insight: "การค้นจากชื่ออย่างเดียวให้ผลผสมจากหลายคน ต้องมี 'ตัวเชื่อม' เช่น รูป ที่ทำงาน หรือช่วงอายุ ก่อนจะเชื่อมข้อมูลเข้ากับบุคคล",
        lesson: "ผลเช็คประวัติที่ไม่ผ่านการยืนยันตัวเชื่อม อาจทำร้ายคนบริสุทธิ์",
        content_angle: "ความรู้: เช็คประวัติจากชื่อทำได้แค่ไหน และพลาดตรงไหน",
        pillar: "detective_knowledge",
      },
    ],
  },
  {
    case_code: "DEMO-004",
    case_type: "asset_search",
    title: "ตรวจทรัพย์สินลูกหนี้ก่อนฟ้อง",
    situation: "ลูกค้าเป็นเจ้าหนี้ที่ลูกหนี้อ้างว่าไม่มีทรัพย์สิน แต่ยังใช้ชีวิตปกติ",
    objective: "หาข้อมูลทรัพย์สินที่มีอยู่จริงเพื่อประกอบการตัดสินใจฟ้อง",
    method: "เฝ้าสังเกตวิถีชีวิตในช่วงสั้น ๆ + ตรวจสอบข้อมูลสาธารณะเกี่ยวกับยานพาหนะและที่พัก",
    observations: "พบการใช้ยานพาหนะและที่พักที่ไม่สอดคล้องกับคำอ้าง แม้ชื่อผู้ถือกรรมสิทธิ์อาจไม่ใช่ลูกหนี้โดยตรง",
    outcome: "ลูกค้าตัดสินใจฟ้องโดยมีข้อมูลประกอบ ทนายใช้ข้อมูลในขั้นตอนบังคับคดี",
    lessons: "ทรัพย์สินที่ 'ไม่มีชื่อ' ไม่ได้หมายความว่าไม่มี — การใช้ชีวิตจริงบอกอะไรได้มาก",
    interesting_insight: "ข้อมูลพฤติกรรมช่วยชี้ทิศทางให้ทนายค้นต่ออย่างมีเป้าหมาย",
    content_potential: "medium",
    anonymized_version: "เจ้าหนี้รายหนึ่งถูกบอกว่าลูกหนี้ไม่มีอะไรเหลือ แต่การสังเกตวิถีชีวิตเพียงไม่นานก็เห็นความไม่สอดคล้อง ข้อมูลนั้นกลายเป็นทิศทางให้ทนายทำงานต่อได้",
    tags: ["สืบทรัพย์", "ลูกหนี้", "ฟ้อง"],
    insights: [
      {
        title: "วิถีชีวิตบอกทรัพย์สินที่ซ่อนอยู่",
        insight: "การอ้างว่าไม่มีทรัพย์สินตรวจสอบได้จากพฤติกรรมการใช้ชีวิต ซึ่งเป็นข้อมูลนำสำหรับการค้นทรัพย์อย่างเป็นทางการ",
        lesson: "ก่อนฟ้องหรือบังคับคดี ควรรู้ว่ามีอะไรให้ตามหรือไม่",
        content_angle: "บริการ: สืบทรัพย์ช่วยอะไรก่อนฟ้อง",
        pillar: "service",
      },
    ],
  },
  {
    case_code: "DEMO-005",
    case_type: "missing_person",
    title: "ตามหาญาติที่ขาดการติดต่อสิบกว่าปี",
    situation: "ลูกค้าต้องการตามหาญาติที่ขาดการติดต่อนาน มีเพียงชื่อเดิม รูปเก่า และจังหวัดที่เคยอยู่",
    objective: "หาช่องทางติดต่อปัจจุบัน",
    method: "OSINT + สอบถามเครือข่ายรอบตัวจากข้อมูลเก่า + ยืนยันด้วยรูปเปรียบเทียบ",
    observations: "เป้าหมายเปลี่ยนชื่อและย้ายภูมิภาค ร่องรอยที่ช่วยคือความเชื่อมโยงกับเพื่อนเก่าบนโซเชียล",
    outcome: "พบช่องทางติดต่อ ลูกค้าติดต่อได้เอง",
    lessons: "ข้อมูลเก่าใช้เวลานานกว่ามาก การประเมินโอกาสก่อนรับงานสำคัญ",
    interesting_insight: "ความเชื่อมโยงของ 'คนรอบตัว' มักคงอยู่นานกว่าข้อมูลของตัวบุคคล",
    content_potential: "medium",
    anonymized_version: "ครั้งหนึ่งมีลูกค้าตามหาญาติที่หายไปนานกว่าสิบปี ตัวเป้าหมายเปลี่ยนแทบทุกอย่าง แต่เครือข่ายเพื่อนเก่ายังอยู่ นั่นคือเส้นทางที่นำไปสู่การติดต่ออีกครั้ง",
    tags: ["ตามหาคน", "osint", "ญาติ"],
    insights: [
      {
        title: "คนรอบตัวคือร่องรอยที่อยู่นานที่สุด",
        insight: "เมื่อบุคคลเปลี่ยนชื่อ ที่อยู่ และช่องทางติดต่อ ความเชื่อมโยงกับคนรอบตัวมักยังคงอยู่และเป็นทางไปสู่การค้นพบ",
        lesson: "ในการตามหาคน อย่ามองแค่ตัวบุคคล ให้มองเครือข่าย",
        content_angle: "ความรู้: นักสืบตามหาคนหายเริ่มจากตรงไหน",
        pillar: "detective_knowledge",
      },
    ],
  },
  {
    case_code: "DEMO-006",
    case_type: "online_fraud",
    title: "ยืนยันตัวตนคนชวนลงทุนออนไลน์ก่อนโอน",
    situation: "ลูกค้าถูกชักชวนลงทุนจากคนที่รู้จักออนไลน์ โปรไฟล์ดูน่าเชื่อถือ กำลังจะโอนเงินก้อนใหญ่",
    objective: "ยืนยันว่าบุคคลและธุรกิจมีอยู่จริงตามที่อ้าง",
    method: "OSINT: ตรวจอายุบัญชี ค้นรูปย้อนกลับ ตรวจสอบธุรกิจที่อ้างจากแหล่งสาธารณะ",
    observations: "รูปโปรไฟล์ถูกใช้ในหลายบัญชีต่างชื่อ ธุรกิจที่อ้างไม่มีร่องรอยที่ตรวจสอบได้",
    outcome: "ลูกค้าหยุดการโอน แจ้งความด้วยข้อมูลที่รวบรวมไว้",
    lessons: "การตรวจสอบก่อนโอนใช้เวลาน้อยกว่าการตามเงินคืนมาก",
    interesting_insight: "สัญญาณที่ชัดที่สุดคือ 'ความเร่ง' — ทุกครั้งที่ลูกค้าขอเวลา อีกฝ่ายจะเพิ่มแรงกดดัน",
    content_potential: "high",
    anonymized_version: "ลูกค้ารายหนึ่งกำลังจะโอนเงินลงทุนให้คนที่รู้จักออนไลน์ การตรวจสอบสั้น ๆ พบว่ารูปโปรไฟล์ถูกใช้ในหลายบัญชี และธุรกิจที่อ้างไม่มีร่องรอยจริง สัญญาณที่ชัดที่สุดคือความเร่งให้ตัดสินใจ",
    tags: ["หลอกลวง", "osint", "ลงทุน"],
    insights: [
      {
        title: "ความเร่งคือสัญญาณเตือนอันดับหนึ่ง",
        insight: "ผู้หลอกลวงเพิ่มแรงกดดันทุกครั้งที่เหยื่อขอเวลาตรวจสอบ เพราะการตรวจสอบคือสิ่งที่พวกเขากลัวที่สุด",
        lesson: "ขอเวลา 48 ชั่วโมงก่อนโอนเงินก้อนใหญ่ให้คนที่รู้จักออนไลน์เสมอ",
        content_angle: "สัญญาณเตือน: 5 สิ่งที่เห็นซ้ำในเคสหลอกลงทุน",
        pillar: "red_flags",
      },
      {
        title: "รูปเดียวหลายบัญชี",
        insight: "การค้นรูปย้อนกลับเป็นขั้นตอนง่ายที่เปิดโปงบัญชีปลอมได้บ่อยที่สุด",
        lesson: "ทำได้เองก่อนเรียกนักสืบ",
        content_angle: "เบื้องหลัง: เครื่องมือ OSINT ที่เราใช้ในเคสหลอกลวง",
        pillar: "behind_investigation",
      },
    ],
  },
];

const QUESTIONS: { question: string; answer_hint: string; frequency: number; tags: string[] }[] = [
  { question: "ติด GPS รถแฟนได้ไหม?", answer_hint: "การติดอุปกรณ์กับทรัพย์สินของผู้อื่นโดยไม่ยินยอมมีความเสี่ยงทางกฎหมาย เราแนะนำแนวทางอื่นและให้ปรึกษาก่อน", frequency: 14, tags: ["gps", "กฎหมาย"] },
  { question: "นักสืบตามแฟนยังไง จับได้ไหม?", answer_hint: "ใช้ทีมและระยะที่ปลอดภัย วางแผนล่วงหน้า ไม่เผชิญหน้า ความเสี่ยงถูกจับได้ต่ำกว่าการตามเองมาก", frequency: 11, tags: ["เฝ้าติดตาม", "นอกใจ"] },
  { question: "ต้องใช้กี่วัน?", answer_hint: "ขึ้นกับความซับซ้อนและข้อมูลตั้งต้น เคสเฝ้าติดตามทั่วไปเริ่มที่ไม่กี่วัน ประเมินให้ก่อนเริ่ม", frequency: 18, tags: ["ระยะเวลา"] },
  { question: "ถ้ารู้แค่ทะเบียนรถ ตามได้ไหม?", answer_hint: "ทะเบียนเป็นจุดเริ่มต้นที่ดี แต่ต้องมีข้อมูลประกอบ และการเข้าถึงข้อมูลทะเบียนต้องอยู่ในกรอบกฎหมาย", frequency: 9, tags: ["ยานพาหนะ"] },
  { question: "ราคาเท่าไหร่?", answer_hint: "ขึ้นกับประเภทงานและจำนวนวัน แจ้งใบเสนอราคาหลังคุยรายละเอียด ชำระ 50% ก่อนเริ่ม", frequency: 22, tags: ["ราคา"] },
  { question: "หลักฐานที่ได้เอาไปใช้ในศาลได้ไหม?", answer_hint: "หลักฐานที่ได้มาโดยชอบและมีลำดับเวลาชัดใช้ประกอบการปรึกษาทนายได้ เราไม่รับรองผลทางคดี", frequency: 8, tags: ["หลักฐาน", "กฎหมาย"] },
  { question: "เช็คประวัติจากชื่ออย่างเดียวได้ไหม?", answer_hint: "ได้ระดับหนึ่ง แต่ชื่อซ้ำเป็นปัญหา ยิ่งมีจังหวัด/อายุ/ที่ทำงาน ยิ่งแม่น", frequency: 12, tags: ["เช็คประวัติ"] },
  { question: "อยู่ต่างจังหวัดรับงานไหม?", answer_hint: "รับงานทั่วประเทศ ค่าเดินทางคิดตามจริง", frequency: 7, tags: ["พื้นที่"] },
];

export interface SeedSummary {
  knowledge: number;
  cases: number;
  insights: number;
  questions: number;
  ideas: number;
  masters: number;
}

export async function loadDemoData(userId: string): Promise<SeedSummary> {
  const svc = createServiceClient();
  const summary: SeedSummary = { knowledge: 0, cases: 0, insights: 0, questions: 0, ideas: 0, masters: 0 };

  // ── Knowledge (dedupe on origin_ref) ─────────────────────────────────────
  const allKnowledge = [...faqKnowledge(), ...KNOWLEDGE];
  const { data: existingK } = await svc.from("studio_knowledge_sources").select("origin_ref").in("origin_ref", allKnowledge.map((k) => k.origin_ref));
  const haveK = new Set((existingK ?? []).map((r) => r.origin_ref));
  const newK = allKnowledge.filter((k) => !haveK.has(k.origin_ref));
  if (newK.length) {
    const { error } = await svc.from("studio_knowledge_sources").insert(
      newK.map((k) => ({
        title: k.title,
        content: k.content,
        summary: k.summary ?? null,
        source_type: k.source_type,
        category: k.category,
        tags: k.tags,
        sensitivity: k.sensitivity,
        approved_for_content: true,
        origin_ref: k.origin_ref,
        is_demo: k.is_demo,
        created_by: userId,
      })),
    );
    if (error) throw new Error(`knowledge seed failed: ${error.message}`);
    summary.knowledge = newK.length;
  }

  // ── Cases + insights (dedupe on case_code) ───────────────────────────────
  const { data: existingC } = await svc.from("studio_cases").select("case_code").in("case_code", CASES.map((c) => c.case_code));
  const haveC = new Set((existingC ?? []).map((r) => r.case_code));
  for (const c of CASES.filter((c) => !haveC.has(c.case_code))) {
    const { data: row, error } = await svc
      .from("studio_cases")
      .insert({
        case_code: c.case_code,
        case_type: c.case_type,
        title: c.title,
        situation: c.situation,
        objective: c.objective,
        method: c.method,
        observations: c.observations,
        outcome: c.outcome,
        lessons: c.lessons,
        interesting_insight: c.interesting_insight,
        content_potential: c.content_potential,
        sensitivity: "confidential",
        anonymized_version: c.anonymized_version,
        approved_for_content: true,
        is_demo: true,
        tags: c.tags,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(`case seed failed: ${error?.message}`);
    summary.cases += 1;
    const { error: iErr } = await svc.from("studio_case_insights").insert(
      c.insights.map((i) => ({
        case_id: row.id,
        title: i.title,
        insight: i.insight,
        lesson: i.lesson,
        content_angle: i.content_angle,
        pillar: i.pillar,
        privacy_status: "safe",
        approved_for_content: true,
        generated_by: "human",
        created_by: userId,
      })),
    );
    if (iErr) throw new Error(`insight seed failed: ${iErr.message}`);
    summary.insights += c.insights.length;
  }

  // ── Customer questions (dedupe on text) ──────────────────────────────────
  const { data: existingQ } = await svc.from("studio_customer_questions").select("question").in("question", QUESTIONS.map((q) => q.question));
  const haveQ = new Set((existingQ ?? []).map((r) => r.question));
  const newQ = QUESTIONS.filter((q) => !haveQ.has(q.question));
  if (newQ.length) {
    const { error } = await svc.from("studio_customer_questions").insert(
      newQ.map((q) => ({ ...q, source: "manual", approved_for_content: true, is_demo: true, created_by: userId })),
    );
    if (error) throw new Error(`question seed failed: ${error.message}`);
    summary.questions = newQ.length;
  }

  // ── Sample ideas + content masters (dedupe on demo tag + title) ─────────
  const { data: existingM } = await svc.from("studio_content_masters").select("title").contains("tags", [DEMO_TAG]);
  const haveM = new Set((existingM ?? []).map((r) => r.title));
  const { data: existingI } = await svc.from("studio_ideas").select("title").contains("tags", [DEMO_TAG]);
  const haveI = new Set((existingI ?? []).map((r) => r.title));

  // Look up seeded knowledge/insights for source links.
  const { data: kRows } = await svc.from("studio_knowledge_sources").select("id, origin_ref").in("origin_ref", ["seed/knowledge/gps-limits", "seed/knowledge/diy-mistakes", "seed/knowledge/evidence-that-matters"]);
  const kById = Object.fromEntries((kRows ?? []).map((r) => [r.origin_ref, r.id]));
  const { data: insRows } = await svc.from("studio_case_insights").select("id, title").in("title", ["GPS ยืนยันรถ ไม่ยืนยันคน", "การถอยคือส่วนหนึ่งของแผน"]);
  const insByTitle = Object.fromEntries((insRows ?? []).map((r) => [r.title, r.id]));

  const ideas: { title: string; hook: string; description: string; pillar: Pillar; platforms: Platform[]; format: string; origin: string; status: string; refs: { kind: string; id: string | null; label: string }[] }[] = [
    {
      title: "GPS บอกอะไรได้ และบอกอะไรไม่ได้",
      hook: "GPS บอกตำแหน่งรถได้ แต่ไม่ได้บอกว่าใครอยู่ในรถ",
      description: "อธิบายข้อจำกัดของ GPS ติดตามด้วยตัวอย่างจากงานจริง และทำไมต้องมีการเฝ้าสังเกตยืนยัน",
      pillar: "detective_knowledge",
      platforms: ["tiktok", "instagram_reel"],
      format: "short_video",
      origin: "knowledge",
      status: "generated",
      refs: [{ kind: "knowledge", id: kById["seed/knowledge/gps-limits"] ?? null, label: "GPS บอกอะไรได้ และบอกอะไรไม่ได้" }],
    },
    {
      title: "ทำไมการตามคนเองถึงพลาดง่าย",
      hook: "คนที่ตามแฟนเอง มักถูกจับได้ก่อนจะเห็นอะไร",
      description: "5 ข้อผิดพลาดที่พบบ่อยและผลที่ตามมา",
      pillar: "detective_knowledge",
      platforms: ["tiktok", "facebook"],
      format: "short_video",
      origin: "knowledge",
      status: "saved",
      refs: [{ kind: "knowledge", id: kById["seed/knowledge/diy-mistakes"] ?? null, label: "ทำไมการตามคนเองถึงพลาดง่าย" }],
    },
    {
      title: "Case Insight: รถอยู่ที่เดิม แต่คนไม่ได้อยู่กับรถ",
      hook: "ลูกค้ามั่นใจว่าแฟนอยู่ที่ทำงานทั้งวัน เพราะรถไม่ขยับเลย",
      description: "เรื่องจากเคสแบบไม่ระบุตัวตน: ข้อมูลไม่ผิด แต่ตีความผิด",
      pillar: "case_story",
      platforms: ["tiktok", "instagram_reel"],
      format: "short_video",
      origin: "case",
      status: "saved",
      refs: [{ kind: "case_insight", id: insByTitle["GPS ยืนยันรถ ไม่ยืนยันคน"] ?? null, label: "GPS ยืนยันรถ ไม่ยืนยันคน" }],
    },
    {
      title: "ทำไมนักสืบถึง 'หยุด' ก่อนจะเริ่ม",
      hook: "ขั้นตอนแรกของเคสนี้คือไม่ทำอะไรเลยหนึ่งสัปดาห์",
      description: "มุมมองนักสืบ: การถอยเป็นส่วนหนึ่งของแผน",
      pillar: "detective_pov",
      platforms: ["instagram_reel"],
      format: "short_video",
      origin: "case",
      status: "new",
      refs: [{ kind: "case_insight", id: insByTitle["การถอยคือส่วนหนึ่งของแผน"] ?? null, label: "การถอยคือส่วนหนึ่งของแผน" }],
    },
    {
      title: "หลักฐานแบบไหนมีประโยชน์กับลูกค้าจริง",
      hook: "ภาพเด็ดภาพเดียว มีน้ำหนักน้อยกว่าที่คิด",
      description: "องค์ประกอบของหลักฐานที่ใช้ได้จริง เป็น carousel 6 สไลด์",
      pillar: "detective_knowledge",
      platforms: ["instagram_carousel", "facebook"],
      format: "carousel",
      origin: "knowledge",
      status: "new",
      refs: [{ kind: "knowledge", id: kById["seed/knowledge/evidence-that-matters"] ?? null, label: "หลักฐานแบบไหนมีประโยชน์กับลูกค้าจริง" }],
    },
  ];

  const ideaIds: Record<string, string> = {};
  for (const idea of ideas.filter((i) => !haveI.has(i.title))) {
    const { data, error } = await svc
      .from("studio_ideas")
      .insert({
        title: idea.title,
        hook: idea.hook,
        description: idea.description,
        pillar: idea.pillar,
        platforms: idea.platforms,
        format: idea.format,
        origin: idea.origin,
        source_refs: idea.refs as never,
        ai_scores: { hook: 4, educational: 4, conversion: 3, originality: 3, rationale: "ตัวอย่างคะแนน (demo)" } as never,
        status: idea.status,
        tags: [DEMO_TAG, ...(idea.pillar === "case_story" ? ["เคส"] : [])],
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`idea seed failed: ${error?.message}`);
    ideaIds[idea.title] = data.id;
    summary.ideas += 1;
  }

  const gpsTitle = "GPS บอกอะไรได้ และบอกอะไรไม่ได้";
  if (!haveM.has(gpsTitle)) {
    const nextMon = new Date();
    nextMon.setDate(nextMon.getDate() + ((8 - nextMon.getDay()) % 7 || 7));
    nextMon.setHours(19, 0, 0, 0);
    const script = `[HOOK]
GPS บอกคุณได้ว่ารถอยู่ไหน
แต่มันไม่ได้บอกว่าใครอยู่ในรถ

[CONTEXT]
ลูกค้าหลายคนติด GPS เองมาก่อน
เห็นรถจอดที่ทำงานทั้งวัน ก็คิดว่าไม่มีอะไร

[INSIGHT]
เคสหนึ่ง รถไม่ขยับเลยสามวัน
แต่คนออกจากอาคารช่วงพักกลางวันด้วยรถคันอื่น

[EXPLANATION]
GPS ยืนยันได้แค่ตำแหน่งอุปกรณ์
การยืนยันคน ต้องใช้การเฝ้าสังเกต

[PAYOFF]
ข้อมูลไม่ผิด
แต่ถ้าตีความเกินสิ่งที่มันบอกได้ คุณจะสรุปผิด

[CTA]
ถ้าอยากรู้ว่าเคสของคุณควรเริ่มตรงไหน ทักมาคุยกันได้ทาง LINE`;
    const { data: master, error } = await svc
      .from("studio_content_masters")
      .insert({
        idea_id: ideaIds[gpsTitle] ?? null,
        title: gpsTitle,
        pillar: "detective_knowledge",
        status: "approved",
        hook: "GPS บอกตำแหน่งรถได้ แต่ไม่ได้บอกว่าใครอยู่ในรถ",
        script,
        caption: "GPS บอกตำแหน่งรถ ไม่ได้บอกว่าใครอยู่ในรถ\n\nข้อจำกัดข้อเดียวที่ทำให้หลายคนสรุปผิด — และวิธีที่นักสืบยืนยันความจริง\n\n#นักสืบเอกชน #GPS #DetectivePulse",
        cta: "ถ้าอยากรู้ว่าเคสของคุณควรเริ่มตรงไหน ทักมาคุยกันได้ทาง LINE @detectivepluse",
        target_duration_sec: 45,
        estimated_duration_sec: 42,
        primary_platform: "tiktok",
        creative_plan: {
          shots: [
            { start_sec: 0, end_sec: 4, voice: "GPS บอกคุณได้ว่ารถอยู่ไหน แต่มันไม่ได้บอกว่าใครอยู่ในรถ", visual: "ภาพจราจรกลางคืนในเมือง / จุดบนแผนที่กระพริบ (ไม่มีที่อยู่จริง)", text_overlay: "GPS ≠ Full Investigation" },
            { start_sec: 4, end_sec: 12, voice: "ลูกค้าหลายคนติด GPS เองมาก่อน เห็นรถจอดที่ทำงานทั้งวัน ก็คิดว่าไม่มีอะไร", visual: "ลานจอดรถทั่วไป มุมกว้าง ไม่เห็นทะเบียน", text_overlay: "รถจอดทั้งวัน = ปลอดภัย?" },
            { start_sec: 12, end_sec: 24, voice: "เคสหนึ่ง รถไม่ขยับเลยสามวัน แต่คนออกจากอาคารช่วงพักกลางวันด้วยรถคันอื่น", visual: "เงาคนเดินออกจากอาคาร / เบาะผู้โดยสาร", text_overlay: "3 วัน รถไม่ขยับ" },
            { start_sec: 24, end_sec: 34, voice: "GPS ยืนยันได้แค่ตำแหน่งอุปกรณ์ การยืนยันคน ต้องใช้การเฝ้าสังเกต", visual: "มือจดบันทึกเวลาในสมุด / กล้องบนแดชบอร์ด", text_overlay: "อุปกรณ์ ≠ บุคคล" },
            { start_sec: 34, end_sec: 42, voice: "ข้อมูลไม่ผิด แต่ถ้าตีความเกินสิ่งที่มันบอกได้ คุณจะสรุปผิด — ทักมาคุยกันได้ทาง LINE", visual: "หน้าตรง พูดกับกล้อง โทนสงบ", text_overlay: "LINE @detectivepluse" },
          ],
          broll: ["จราจรกลางคืน", "แผนที่ UI แบบไม่มีที่อยู่จริง", "ลานจอดรถมุมกว้าง", "สมุดบันทึกเวลา"],
          text_overlays: ["GPS ≠ Full Investigation", "รถจอดทั้งวัน = ปลอดภัย?", "อุปกรณ์ ≠ บุคคล"],
          subtitle_style: "ซับไทยตัวหนา ขาวขอบดำ กลางล่าง",
          voiceover_notes: "โทนสงบ ช้าในช่วง INSIGHT",
          thumbnail_concept: "จุด GPS บนแผนที่มืด + ข้อความ 'รถอยู่ คนไม่อยู่'",
          music_mood: "ambient ต่ำ ๆ ไม่มี drop",
        } as never,
        ai_notes: "ตัวอย่างคอนเทนต์ demo — ตรวจภาษาก่อนใช้จริง",
        scheduled_at: nextMon.toISOString(),
        approved_by: userId,
        approved_at: new Date().toISOString(),
        tags: [DEMO_TAG, "gps"],
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !master) throw new Error(`master seed failed: ${error?.message}`);
    summary.masters += 1;

    await svc.from("studio_content_sources").insert([
      { master_id: master.id, source_kind: "knowledge", source_id: kById["seed/knowledge/gps-limits"] ?? null, label: "GPS บอกอะไรได้ และบอกอะไรไม่ได้" },
      { master_id: master.id, source_kind: "case_insight", source_id: insByTitle["GPS ยืนยันรถ ไม่ยืนยันคน"] ?? null, label: "GPS ยืนยันรถ ไม่ยืนยันคน" },
    ]);
    await svc.from("studio_content_claims").insert([
      { master_id: master.id, claim: "GPS ยืนยันได้แค่ตำแหน่งอุปกรณ์ ไม่ยืนยันบุคคล", support_status: "supported", source_kind: "knowledge", source_id: kById["seed/knowledge/gps-limits"] ?? null },
      { master_id: master.id, claim: "ความคลาดเคลื่อนของ GPS ในเมืองอยู่ที่ประมาณ 5–30 เมตร", support_status: "partially_supported", source_kind: "knowledge", source_id: kById["seed/knowledge/gps-limits"] ?? null, note: "ตัวเลขโดยประมาณจากประสบการณ์ ไม่ใช่สเปกผู้ผลิต" },
    ]);
    await svc.from("studio_privacy_checks").insert({ master_id: master.id, status: "safe", findings: [] as never, checked_by: "deterministic", created_by: userId });
    await svc.from("studio_content_variants").insert([
      { master_id: master.id, platform: "tiktok", format: "short_video", hook: "GPS บอกตำแหน่งรถได้ แต่ไม่ได้บอกว่าใครอยู่ในรถ", script, caption: "GPS บอกตำแหน่งรถ ไม่ได้บอกว่าใครอยู่ในรถ #นักสืบเอกชน #GPS", cta: "ทักมาคุยกันได้ทาง LINE" },
      { master_id: master.id, platform: "facebook", format: "post", hook: null, script: null, caption: "หลายคนติด GPS แล้วสบายใจ เพราะรถจอดที่ทำงานทั้งวัน\n\nแต่ GPS ยืนยันได้แค่ตำแหน่งอุปกรณ์ ไม่ได้ยืนยันว่าใครอยู่กับมัน\n\nเคสหนึ่งรถไม่ขยับเลยสามวัน แต่คนออกจากอาคารช่วงกลางวันด้วยรถคันอื่น\n\nข้อมูลไม่ผิด แต่การตีความเกินสิ่งที่ข้อมูลบอกได้ต่างหากที่ทำให้สรุปผิด\n\nถ้าอยากรู้ว่าเคสของคุณควรเริ่มตรงไหน ทักมาคุยกันได้ทาง LINE @detectivepluse", cta: "ทักมาคุยกันได้ทาง LINE @detectivepluse" },
    ]);
  }

  const draftTitle = "ทำไมการตามคนเองถึงพลาดง่าย";
  if (!haveM.has(draftTitle)) {
    const { error } = await svc.from("studio_content_masters").insert({
      idea_id: ideaIds[draftTitle] ?? null,
      title: draftTitle,
      pillar: "detective_knowledge",
      status: "draft",
      hook: "คนที่ตามแฟนเอง มักถูกจับได้ก่อนจะเห็นอะไร",
      script: null,
      caption: null,
      cta: null,
      target_duration_sec: 30,
      primary_platform: "tiktok",
      tags: [DEMO_TAG],
      created_by: userId,
    });
    if (error) throw new Error(`draft seed failed: ${error.message}`);
    summary.masters += 1;
  }

  const publishedTitle = "สัญญาณเตือน 5 ข้อ ก่อนโอนเงินให้คนที่รู้จักออนไลน์";
  if (!haveM.has(publishedTitle)) {
    const publishedAt = new Date(Date.now() - 9 * 86400_000);
    const { data: pub, error } = await svc
      .from("studio_content_masters")
      .insert({
        title: publishedTitle,
        pillar: "red_flags",
        status: "published",
        hook: "ทุกครั้งที่คุณขอเวลา เขาจะเร่งคุณมากขึ้น",
        script: "[HOOK]\nทุกครั้งที่คุณขอเวลาคิด อีกฝ่ายจะเร่งคุณมากขึ้น\n\n[INSIGHT]\nนี่คือสัญญาณที่เราเห็นซ้ำที่สุดในเคสหลอกลงทุน\n\n[EXPLANATION]\nหนึ่ง เร่งให้ตัดสินใจวันนี้\nสอง ห้ามบอกใคร\nสาม โปรไฟล์ดูดีแต่บัญชีอายุสั้น\nสี่ เลี่ยงวิดีโอคอล\nห้า ขอให้โอนก่อนเสมอ\n\n[PAYOFF]\nขอเวลา 48 ชั่วโมงก่อนโอนเงินก้อนใหญ่เสมอ\nถ้าเขารับไม่ได้ นั่นคือคำตอบ",
        caption: "5 สัญญาณที่เราเห็นซ้ำในเคสหลอกลงทุนออนไลน์\n\n#หลอกลงทุน #สัญญาณเตือน #DetectivePulse",
        cta: "ถ้าไม่แน่ใจว่าคนที่คุยอยู่เป็นใครจริง ๆ ปรึกษาได้ทาง LINE @detectivepluse",
        target_duration_sec: 30,
        estimated_duration_sec: 31,
        primary_platform: "tiktok",
        published_at: publishedAt.toISOString(),
        approved_by: userId,
        approved_at: new Date(publishedAt.getTime() - 86400_000).toISOString(),
        tags: [DEMO_TAG, "หลอกลวง"],
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !pub) throw new Error(`published seed failed: ${error?.message}`);
    summary.masters += 1;
    await svc.from("studio_privacy_checks").insert({ master_id: pub.id, status: "safe", findings: [] as never, checked_by: "deterministic", created_by: userId });
    await svc.from("studio_analytics").insert({
      master_id: pub.id,
      platform: "tiktok",
      recorded_at: new Date(publishedAt.getTime() + 7 * 86400_000).toISOString(),
      views: 12400,
      likes: 610,
      comments: 48,
      shares: 92,
      saves: 133,
      avg_watch_sec: 19.4,
      completion_rate: 41.2,
      profile_visits: 210,
      dms: 6,
      leads: 2,
      qualified_leads: 1,
      conversions: 0,
      source: "manual",
      note: "ตัวเลขตัวอย่าง (demo) — ไม่ใช่ผลจริง",
      created_by: userId,
    });
  }

  console.info("[studio:seed] loaded", summary);
  return summary;
}

export async function removeDemoData(): Promise<void> {
  const svc = createServiceClient();
  // Order matters only for readability — FKs cascade.
  await svc.from("studio_content_masters").delete().contains("tags", [DEMO_TAG]);
  await svc.from("studio_ideas").delete().contains("tags", [DEMO_TAG]);
  await svc.from("studio_cases").delete().eq("is_demo", true);
  await svc.from("studio_customer_questions").delete().eq("is_demo", true);
  await svc.from("studio_knowledge_sources").delete().eq("is_demo", true);
  console.info("[studio:seed] demo data removed");
}
