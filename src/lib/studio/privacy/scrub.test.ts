import { describe, expect, it } from "vitest";
import { privacyStatusFromFindings, scrubText, summarizeFindings } from "./scrub";

const scan = (text: string, denylist: string[] = []) =>
  scrubText({ fields: { script: text }, rules: { denylist, custom_patterns: [], strict_mode: false } });

describe("scrubText", () => {
  it("returns nothing for generalised copy", () => {
    const f = scan("เป้าหมายออกจากบ้านช่วงเวลาเดิมทุกเช้า และรถจอดอยู่ที่เดิมแต่คนไม่ได้อยู่กับรถ");
    expect(f).toEqual([]);
  });
  it("flags Thai phone numbers but allows the company number", () => {
    expect(scan("โทร 081-234-5678").some((f) => f.kind === "phone")).toBe(true);
    expect(scan("โทร 096-846-1406").some((f) => f.kind === "phone")).toBe(false);
  });
  it("flags emails but allows the company email", () => {
    expect(scan("ติดต่อ somchai.k@gmail.com").some((f) => f.kind === "email")).toBe(true);
    expect(scan("ติดต่อ detectivepluse@gmail.com").some((f) => f.kind === "email")).toBe(false);
  });
  it("flags license plates", () => {
    expect(scan("รถทะเบียน 1กข 1234 กรุงเทพ").some((f) => f.kind === "plate")).toBe(true);
    expect(scan("ทะเบียน ขข-9876").some((f) => f.kind === "plate")).toBe(true);
  });
  it("flags LINE handles but allows @detectivepluse", () => {
    expect(scan("ทัก LINE @somchai_k").some((f) => f.kind === "line_id")).toBe(true);
    expect(scan("ปรึกษาได้ทาง LINE @detectivepluse").some((f) => f.kind === "line_id")).toBe(false);
  });
  it("flags addresses and dates", () => {
    expect(scan("บ้านเลขที่ 99/12 ซอยสุขุมวิท 49").some((f) => f.kind === "address")).toBe(true);
    expect(scan("เหตุการณ์วันที่ 12/03/2568").some((f) => f.kind === "date")).toBe(true);
    expect(scan("วันที่ 5 มี.ค. 2569").some((f) => f.kind === "date")).toBe(true);
  });
  it("flags 13-digit id numbers", () => {
    expect(scan("เลข 1-1234-56789-01-2").some((f) => f.kind === "id_number")).toBe(true);
  });
  it("flags formally titled names but not the pronoun คุณ", () => {
    expect(scan("นายสมชาย ขับรถออกจากบ้าน").some((f) => f.kind === "name")).toBe(true);
    expect(scan("คุณรับงานต่างจังหวัดไหม").some((f) => f.kind === "name")).toBe(false);
    expect(scan("แฟนชื่อสมชาย").some((f) => f.kind === "name")).toBe(true);
    expect(scan("บริษัทมีชื่อเสียงดี").some((f) => f.kind === "name")).toBe(false);
  });
  it("flags denylist terms case-insensitively", () => {
    expect(scan("ลูกค้าชื่อ Pimchanok มาปรึกษา", ["pimchanok"]).some((f) => f.kind === "denylist")).toBe(true);
  });
  it("allows company URLs, flags external ones", () => {
    expect(scan("อ่านต่อ https://detectivepulse.com/articles/x").some((f) => f.kind === "url")).toBe(false);
    expect(scan("ดู https://facebook.com/somchai.k").some((f) => f.kind === "url")).toBe(true);
  });
  it("records the field name", () => {
    const f = scrubText({ fields: { hook: "โทร 081-234-5678", caption: null } });
    expect(f[0].field).toBe("hook");
  });
});

describe("privacyStatusFromFindings", () => {
  it("safe when empty", () => expect(privacyStatusFromFindings([])).toBe("safe"));
  it("blocked on any high finding", () => {
    expect(privacyStatusFromFindings(scan("โทร 081-234-5678"))).toBe("blocked");
  });
  it("review_required on medium-only", () => {
    const f = scan("วันที่ 12/03/2568");
    expect(f.every((x) => x.severity !== "high")).toBe(true);
    expect(privacyStatusFromFindings(f)).toBe("review_required");
    expect(privacyStatusFromFindings(f, true)).toBe("blocked");
  });
});

describe("summarizeFindings", () => {
  it("summarises by kind", () => {
    expect(summarizeFindings(scan("โทร 081-234-5678 และ 089-111-2222"))).toContain("เบอร์โทร ×2");
    expect(summarizeFindings([])).toContain("ไม่พบ");
  });
});
