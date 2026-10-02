/**
 * Public, clearly-labelled SAMPLE report for the marketing site — mirrors the
 * structure the ops app prints (header → dated chronological observations
 * with photo slots and a public-place location → "End of Report"), with every
 * identifying value replaced by a redaction placeholder. It is a template
 * demonstration, not a real case, and says so on every screen and print.
 * No real client, subject, place, plate, time-of-day pattern or photo is used.
 */
export type SampleLang = "th" | "en";

export interface SampleEntry { time: string; text: string; photos: number; location: string }
export interface SampleDay { label: string; entries: SampleEntry[] }
export interface SampleReport {
  watermark: string;
  title: string;
  notice: string;
  headerLines: string[];
  days: SampleDay[];
  photoCaption: string;
  locationLabel: string;
  endLine: string;
  footerLines: string[];
  legend: { title: string; items: string[] };
  backLabel: string;
  printLabel: string;
}

const R = "█████"; // visual redaction

export const SAMPLE_REPORT: Record<SampleLang, SampleReport> = {
  th: {
    watermark: "ตัวอย่าง · SAMPLE",
    title: "ตัวอย่างรายงานการเฝ้าสังเกต (ปกปิดข้อมูล)",
    notice: "เอกสารนี้เป็นตัวอย่างโครงสร้างรายงานเท่านั้น ไม่ใช่เคสจริง ชื่อ สถานที่ ยานพาหนะ เวลา และภาพถ่ายถูกแทนด้วยช่องปกปิด รายงานจริงมีรายละเอียดครบตามเหตุการณ์",
    headerLines: [
      "DETECTIVE PULSE — รายงานการเฝ้าสังเกตการณ์",
      `เลขที่เคส: DP-${R}    ผู้ว่าจ้าง: ${R}`,
      `ช่วงเวลา: ${R} ถึง ${R}    พื้นที่: ${R} (กรุงเทพมหานคร)`,
      "วิธีการ: เฝ้าสังเกตในที่สาธารณะ บันทึกเฉพาะสิ่งที่เห็นโดยตรง ไม่มีการตีความ",
    ],
    days: [
      {
        label: `=== วันที่ 1 — ${R} ===`,
        entries: [
          { time: "08:4█", text: `บุคคลเป้าหมายออกจากอาคารที่พัก ${R} สวมเสื้อสี${R} ขับรถยนต์ ${R} ทะเบียน ${R} ออกจากซอยไปทางถนน${R}`, photos: 2, location: `หน้าอาคาร ${R}` },
          { time: "09:1█", text: `รถของเป้าหมายจอดที่อาคารสำนักงาน ${R} เป้าหมายเดินเข้าอาคารทางประตูหลัก`, photos: 1, location: `ลานจอดรถสาธารณะ ${R}` },
          { time: "12:0█", text: `เป้าหมายออกจากอาคารพร้อมบุคคลไม่ทราบชื่อ 1 คน (เพศ${R} สวมเสื้อสี${R}) เดินไปร้านอาหาร ${R} นั่งโต๊ะริมหน้าต่าง`, photos: 3, location: `ร้านอาหาร ${R} (พื้นที่สาธารณะ)` },
          { time: "13:2█", text: `ทั้งสองออกจากร้าน แยกย้าย เป้าหมายกลับเข้าอาคารสำนักงาน ${R}`, photos: 1, location: `หน้าอาคารสำนักงาน ${R}` },
          { time: "18:3█", text: `เป้าหมายขับรถออกจากอาคารสำนักงานกลับถึงอาคารที่พัก ${R} เวลา 19:0█ ไม่พบการแวะระหว่างทาง`, photos: 2, location: `หน้าอาคารที่พัก ${R}` },
        ],
      },
      {
        label: `=== วันที่ 2 — ${R} ===`,
        entries: [
          { time: "08:5█", text: `เป้าหมายออกจากอาคารที่พักด้วยรถคันเดิม มุ่งหน้าเส้นทางเดียวกับวันที่ 1`, photos: 1, location: `หน้าอาคาร ${R}` },
          { time: "17:4█", text: `เป้าหมายออกจากอาคารสำนักงาน ขับรถไปยัง ${R} จอดรถและเดินเข้า${R} พร้อมบุคคลเดียวกับวันที่ 1`, photos: 3, location: `ลานจอดรถ ${R} (พื้นที่สาธารณะ)` },
          { time: "21:1█", text: `ทั้งสองออกมาและขึ้นรถของเป้าหมาย รถออกจากพื้นที่ไปทาง${R} สิ้นสุดการเฝ้าสังเกตประจำวันตามแผน`, photos: 2, location: `ทางออกลานจอดรถ ${R}` },
        ],
      },
    ],
    photoCaption: "ภาพถ่ายจากที่สาธารณะ พร้อมเวลาและพิกัด (ปกปิดในตัวอย่าง)",
    locationLabel: "📍 สถานที่ (ลิงก์แผนที่ในรายงานจริง)",
    endLine: "— สิ้นสุดรายงาน / End of Report —",
    footerLines: [
      "รายงานนี้บันทึกเฉพาะข้อเท็จจริงที่สังเกตได้โดยตรงในที่สาธารณะ ไม่มีการตีความหรือสรุปพฤติกรรม",
      "ภาพถ่ายและวิดีโอต้นฉบับพร้อมข้อมูลเวลาส่งมอบแยกต่างหากผ่านช่องทางที่ผู้ว่าจ้างเลือก",
      "ข้อมูลผู้ว่าจ้างและเป้าหมายเป็นความลับ ใช้เพื่อวัตถุประสงค์ที่ตกลงในใบเสนอราคาเท่านั้น",
    ],
    legend: {
      title: "สิ่งที่คุณจะเห็นในรายงานจริง",
      items: [
        "ส่วนหัว: เลขที่เคส ช่วงเวลา พื้นที่ และวิธีการ",
        "รายการตามลำดับเวลา: เวลา เหตุการณ์ที่เห็น ภาพประกอบ และสถานที่พร้อมลิงก์แผนที่",
        "ไม่มีการตีความ ไม่มีคำว่า \"น่าจะ\" หรือ \"ดูเหมือน\" — ทนายและคุณเป็นผู้ประเมิน",
        "ท้ายรายงานจบที่บรรทัด End of Report ไม่มีข้อสรุปหรือคำแนะนำปะปนกับข้อเท็จจริง",
      ],
    },
    backLabel: "กลับหน้าขั้นตอนการทำงาน",
    printLabel: "พิมพ์ / บันทึกเป็น PDF",
  },
  en: {
    watermark: "SAMPLE · NOT A REAL CASE",
    title: "Sample surveillance report (redacted)",
    notice: "This document shows the structure of our reports only. It is not a real case: names, places, vehicles, times and photographs are replaced with redaction marks. A real report carries the full detail of each event.",
    headerLines: [
      "DETECTIVE PULSE — SURVEILLANCE REPORT",
      `Case no.: DP-${R}    Client: ${R}`,
      `Period: ${R} to ${R}    Area: ${R} (Bangkok)`,
      "Method: observation in public places; directly observed facts only, no interpretation",
    ],
    days: [
      {
        label: `=== Day 1 — ${R} ===`,
        entries: [
          { time: "08:4█", text: `Subject left the residential building ${R} wearing a ${R} top, driving a ${R} vehicle, plate ${R}, and exited the soi towards ${R} Road.`, photos: 2, location: `Outside building ${R}` },
          { time: "09:1█", text: `Subject's vehicle parked at office building ${R}; subject entered through the main entrance.`, photos: 1, location: `Public car park ${R}` },
          { time: "12:0█", text: `Subject left the building with one unidentified person (${R}, ${R} top) and walked to restaurant ${R}; both sat at a window table.`, photos: 3, location: `Restaurant ${R} (public area)` },
          { time: "13:2█", text: `Both left the restaurant and separated; subject returned to office building ${R}.`, photos: 1, location: `Outside office building ${R}` },
          { time: "18:3█", text: `Subject drove from the office building and arrived at the residential building ${R} at 19:0█; no stops observed en route.`, photos: 2, location: `Outside residential building ${R}` },
        ],
      },
      {
        label: `=== Day 2 — ${R} ===`,
        entries: [
          { time: "08:5█", text: `Subject left the residential building in the same vehicle, following the same route as Day 1.`, photos: 1, location: `Outside building ${R}` },
          { time: "17:4█", text: `Subject left the office building and drove to ${R}; parked and entered ${R} together with the same person as on Day 1.`, photos: 3, location: `Car park ${R} (public area)` },
          { time: "21:1█", text: `Both came out and got into the subject's vehicle, which left the area towards ${R}. Daily observation ended as planned.`, photos: 2, location: `Car park exit ${R}` },
        ],
      },
    ],
    photoCaption: "Photographs from public places with time and location (redacted in this sample)",
    locationLabel: "📍 Location (map link in the real report)",
    endLine: "— End of Report —",
    footerLines: [
      "This report records only facts directly observed in public places; it contains no interpretation or assessment of behaviour.",
      "Original photographs and video with timestamps are delivered separately through the channel the client chooses.",
      "Client and subject details are confidential and used only for the purpose agreed in the written quote.",
    ],
    legend: {
      title: "What a real report contains",
      items: [
        "Header: case number, period, area and method",
        "Chronological entries: time, what was seen, photographs and the location with a map link",
        "No interpretation — no \"appeared\" or \"seemed\"; you and your lawyer draw the conclusions",
        "The report ends at the End of Report line, with no summary or advice mixed into the facts",
      ],
    },
    backLabel: "Back to how it works",
    printLabel: "Print / save as PDF",
  },
};
