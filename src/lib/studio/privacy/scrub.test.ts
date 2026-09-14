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
    // social captions drop the @ (Ayrshare error 159): our handle stays allowed, a stranger's is still flagged
    expect(scan("ปรึกษาได้ทาง LINE detectivepluse").some((f) => f.kind === "line_id")).toBe(false);
    expect(scan("ทัก LINE somchai_k").some((f) => f.kind === "line_id")).toBe(true);
    expect(scan("ติดต่อ @somchai_real99").some((f) => f.kind === "line_id")).toBe(true);
  });
  it("does not read an email's @domain as a LINE handle", () => {
    // company email in a strict-mode caption/CTA must not be blocked at publish/approval
    expect(privacyStatusFromFindings(scan("อีเมล detectivepluse@gmail.com"), true)).toBe("safe");
    expect(privacyStatusFromFindings(scan("ปรึกษาได้ทาง LINE @detectivepluse หรืออีเมล detectivepluse@gmail.com"), true)).toBe("safe");
    // a foreign email is reported once, by the email rule only
    expect(scan("ติดต่อ somchai.k@gmail.com").map((f) => f.kind)).toEqual(["email"]);
    // a real handle right after an email is still flagged
    const f = scan("a@b.com @somchai_k");
    expect(f.filter((x) => x.kind === "line_id").map((x) => x.excerpt)).toEqual(["@somchai_k"]);
    expect(f.some((x) => x.kind === "email" && x.excerpt === "a@b.com")).toBe(true);
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
    expect(scan("คุณควรเตรียมรูปถ่ายและตารางชีวิตของเป้าหมาย").some((f) => f.kind === "name")).toBe(false);
    expect(scan("คุณสมชาย ขับรถออกจากบ้าน").find((f) => f.kind === "name")?.excerpt).toBe("คุณสมชาย");
    expect(scan("ขอบคุณค่ะ").some((f) => f.kind === "name")).toBe(false);
    expect(scan("ขอบคุณมาก ครับ").some((f) => f.kind === "name")).toBe(false);
    expect(scan("คุณพ่อ ทำงานที่บ้าน").some((f) => f.kind === "name")).toBe(false);
    for (const t of ["ขอบคุณนะคะ", "ขอบคุณจ้า", "ขอบคุณมากๆ", "ขอบพระคุณมาก ครับ", "อยากสืบคุณสามี ว่าไปไหน", "คุณภาพ ดีไหม", "คุณค่า ของงาน", "คุณลูก ไปโรงเรียน"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
    expect(scan("แฟนชื่อสมชาย").some((f) => f.kind === "name")).toBe(true);
    expect(scan("บริษัทมีชื่อเสียงดี").some((f) => f.kind === "name")).toBe(false);
  });
  it("does not read ชื่อ inside another word as a name — Thai has no word spaces", () => {
    // เชื่อ (believe) contains ชื่อ, so these everyday words were being reported as a person's name
    // on the gate that decides whether a piece may be published at all.
    for (const t of [
      "ความน่าเชื่อถือของบริการสำคัญกว่าราคา",
      "พบความเชื่อมโยงใหม่ระหว่างสองเคส",
      "เชื่อใจได้ว่างานจะเสร็จตามกำหนด",
      "ชื่อในทะเบียนราษฎร์ตรงกับที่แจ้งไว้",
      "ชื่อที่ให้มาสะกดไม่ตรงกับเอกสาร",
      "ชื่อของบริการนี้คือการตรวจสอบประวัติ",
      "หนังสือรับรองบริษัท",
    ]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
    // and the cue still works where a name really follows it
    expect(scan("เป้าหมายชื่อสมชาย").some((f) => f.kind === "name")).toBe(true);
    expect(scan("ชื่อเล่นว่าเอ").some((f) => f.kind === "name")).toBe(true);
  });
  it("does not read a title inside a longer word as a name", () => {
    for (const t of [
      "แนะนำให้ปรึกษาทนายความ",
      "ทนายความประจำบริษัท",
      "งานนายหน้าไม่ใช่งานนักสืบ",
      "นายหน้าอสังหาฯ ติดต่อมา",
      "นายจ้างเรียกเข้าพบ",
      "นายทุนรายใหญ่",
      "นางแบบในงานอีเวนต์",
      "นายกรัฐมนตรีแถลงข่าว",
    ]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
  });
  it("still finds a titled name in the middle of a sentence — Thai glues it to the word before", () => {
    // The trap: with no word spaces a title almost never starts a "word", so a position-based rule
    // would silently stop detecting real names everywhere except the start of a field.
    for (const t of [
      "ลูกค้าพบนายสมชาย ที่ห้างเมื่อคืน",
      "ได้รับแจ้งจากนางสาวสมหญิง ว่ามีคนตาม",
      "เป้าหมายเดินทางกับนายอนุชา",
      "ผู้ว่าจ้างคือนายสมชาย ใจดี",
      "รายงานโดยดร.สมศักดิ์",
      "เจอนายสมชายที่ร้าน",
      "นายสมชาย เดินทางออกจากบ้าน",
      "นางสาวสมหญิง ทำงานที่นั่น",
    ]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
  });
  it("keeps a title's exclusions to that title — นางเอก must not silence นายเอกชัย", () => {
    // เอก/ฟ้า/แบบ/สนาม belong to นาง; they are also the first syllable of very common men's names.
    for (const t of ["นายเอกชัย สุขใจ", "พบนายเอกพงษ์", "ดร.เอกชัย", "ด.ช.เอกภพ", "นายฟ้าลิขิต", "นายสนามชัย", "นางสาวฟ้าใส"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
    // …and a lawyer with a name is a name; only ทนายความ is the profession
    for (const t of ["ทนายสมชาย ยืนยันว่า", "ปรึกษาทนายสมหญิง", "ทนายอนุชาเป็นคนแจ้ง"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
    for (const t of ["แนะนำให้ปรึกษาทนายความ", "นายกสมาคมกล่าวว่า", "นายกเทศมนตรีลงพื้นที่", "นายกฯ แถลง"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
    // the excerpt must be the longest title, not นาง + สาว…
    expect(scan("นางสาวสมหญิง ทำงานที่นั่น").find((f) => f.kind === "name")?.excerpt).toBe("นางสาวสมหญิง");
  });
  it("keeps names that start with ก — the นายก exclusion must be compounds, not a letter class", () => {
    for (const t of ["พบนายกิตติศักดิ์ ที่ร้าน", "นายกมล ใจดี", "นายกฤษณะ", "นายกานต์", "นายก้องภพ", "นายกอบชัย", "นายกำธร"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
    for (const t of ["นายกรัฐมนตรีแถลง", "นายกสมาคมกล่าว", "นายกเทศมนตรีลงพื้นที่", "นายกฯ แถลง", "นายกอบต.ประชุม"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
  });
  it("finds a name that follows the label with a space, not only after คือ/ว่า", () => {
    for (const t of ["ชื่อของลูกค้า สมชาย ใจดี", "ชื่อในรายงาน สมหญิง ศรีสุข", "ชื่อและนามสกุล สมชาย ใจดี", "ชื่อที่ลูกค้าให้มา สมชาย"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
  });
  it("does not let the gap skip a rejected คือ and grab the next ว่า", () => {
    for (const t of [
      "ชื่อของบริการนี้คือการสืบที่ว่ายากมาก",
      "ชื่อของเคสนี้คือรหัสที่ว่ากันว่าลับ",
      "ชื่อและนามสกุลคือข้อมูลส่วนบุคคล",
      "ชื่อของทีมคือทีมสืบสวนพิเศษ",
      "ชื่อของรายงานคือสรุปผลการสืบ",
    ]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
  });
  it("does not let the ชื่อของ/ใน/ที่ rule reopen the เชื่อ bug it was added next to", () => {
    for (const t of [
      "ความเชื่อของลูกค้าคือหลักฐานต้องชัด",
      "เราเชื่อในทีมงานคือหัวใจของบริการ",
      "เชื่อที่เห็นมากับตาว่าจริง",
      "ชื่อในรายงานคือรหัสเคสเท่านั้น",
      "ชื่อของแพ็กเกจนี้คือบริการสืบทรัพย์",
    ]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
    // a real introduction still flags, including across a longer gap and other particles
    for (const t of ["ชื่อและนามสกุลของผู้เสียหายคือสมชาย", "ชื่อที่ปรากฏในเอกสารสัญญาฉบับนี้คือสมชาย"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
  });
  it("keeps catching the shapes an over-eager exclusion list would silence", () => {
    // Every entry below is one someone might be tempted to add to the ชื่อ(?!…) list; each is a real name.
    for (const t of ["สามีชื่อนายสมชาย", "ชื่อเอ", "ชื่อบี", "เป้าหมายชื่อจากใบสมัคร", "ลูกค้าชื่อใหม่ที่ติดต่อมา"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
  });
  it("finds a name introduced as ชื่อของ/ชื่อใน/ชื่อที่ … คือ", () => {
    for (const t of ["ชื่อของลูกค้าคือสมชาย ใจดี", "ชื่อในบัตรประชาชนคือสมหญิง", "ชื่อที่ใช้สมัครคือสมชาย"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(true);
    }
    // …but the same particles introducing a thing are still not a person
    for (const t of ["ชื่อของบริการนี้คือการตรวจสอบประวัติ", "ชื่อในทะเบียนราษฎร์ตรงกับที่แจ้งไว้"]) {
      expect(scan(t).some((f) => f.kind === "name"), t).toBe(false);
    }
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
