import { describe, expect, it } from "vitest";
import { buildTranscriptWindows, isPlaceholderMessage, parseCsv, parseLineOaCsv } from "./line-csv";

const SAMPLE =
  "﻿ชื่อบัญชี,Detective+\r\n" +
  "ไทม์โซน,'+07:00\r\n" +
  "วันดาวน์โหลด,2026/06/13 02:24\r\n" +
  "ประเภทผู้ส่ง,ชื่อผู้ส่ง,วันส่ง,เวลาส่ง,ข้อความ\r\n" +
  'Account,ข้อความตอบกลับอัตโนมัติ,2026/06/02,07:28:41,"สวัสดีครับ\r\n\r\nรบกวนแจ้งรายละเอียด"\r\n' +
  'User,Lek,2026/06/02,07:29:10,"อยากสืบแฟนค่ะ โทร 081-234-5678, ใช้เวลากี่วัน"\r\n' +
  "User,Lek,2026/06/02,07:29:30,[สติกเกอร์]\r\n" +
  'Account,Detective+,2026/06/02,07:35:02,"ปกติ 3-5 วันครับ ขึ้นกับพฤติกรรม ""เป้าหมาย"""\r\n';

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas and CRLF newlines", () => {
    const rows = parseCsv('a,"b, c","say ""hi""\r\nline2"\r\nx,y,z\r\n');
    expect(rows).toEqual([["a", "b, c", 'say "hi"\r\nline2'], ["x", "y", "z"]]);
  });
});

describe("parseLineOaCsv", () => {
  it("reads metadata, sides, auto-reply flag and timestamps in the file timezone", () => {
    const ex = parseLineOaCsv(SAMPLE);
    expect(ex.accountName).toBe("Detective+");
    expect(ex.timezone).toBe("+07:00");
    expect(ex.messages).toHaveLength(4);
    expect(ex.messages[0]).toMatchObject({ side: "account", isAutoReply: true });
    expect(ex.messages[1]).toMatchObject({ side: "user", sender: "Lek", isAutoReply: false });
    expect(ex.messages[1].at).toBe("2026-06-02T00:29:10.000Z");
    expect(ex.messages[3].text).toContain('"เป้าหมาย"');
    expect(ex.customerNames).toEqual(["Lek"]);
  });
});

describe("buildTranscriptWindows", () => {
  it("skips auto-replies and placeholders, labels sides, applies redaction", () => {
    const ex = parseLineOaCsv(SAMPLE);
    const w = buildTranscriptWindows(ex.messages, (t) => t.replace(/081-234-5678/g, "[เบอร์โทร]"));
    expect(w).toHaveLength(1);
    expect(w[0].text).toContain("ลูกค้า (2026-06-02): อยากสืบแฟนค่ะ โทร [เบอร์โทร]");
    expect(w[0].text).toContain("นักสืบ (2026-06-02): ปกติ 3-5 วันครับ");
    expect(w[0].text).not.toContain("สวัสดีครับ");
    expect(w[0]).toMatchObject({ userCount: 1, accountCount: 1 });
  });
  it("splits on size without breaking a message", () => {
    const msgs = Array.from({ length: 30 }, (_, i) => ({ side: (i % 2 ? "account" : "user") as "user" | "account", sender: "x", at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`, text: "ก".repeat(400), isAutoReply: false }));
    const w = buildTranscriptWindows(msgs, (t) => t, 2000);
    expect(w.length).toBeGreaterThan(5);
    expect(w.every((x) => x.text.length <= 2000 + 60)).toBe(true);
    expect(w.reduce((n, x) => n + x.messageCount, 0)).toBe(30);
  });
  it("detects placeholders", () => {
    expect(isPlaceholderMessage("[สติกเกอร์]")).toBe(true);
    expect(isPlaceholderMessage("[รูปภาพ]")).toBe(true);
    expect(isPlaceholderMessage("ราคาเท่าไหร่")).toBe(false);
  });
});
