import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  insertError: null as { message: string } | null,
  allowed: true,
  denylist: [] as string[],
  settingsDown: false,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: h.allowed, remaining: 1, retryAfterMs: 0 })) }));
vi.mock("@/lib/studio/settings", () => ({
  getStudioSettingsStrict: vi.fn(async () => {
    if (h.settingsDown) throw new Error("studio settings unavailable");
    return { privacy_rules: { denylist: h.denylist, custom_patterns: [], strict_mode: false } };
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({ insert: async (row: Record<string, unknown>) => (h.inserted.push(row), { error: h.insertError }) }),
  }),
}));

beforeEach(() => {
  h.inserted = [];
  h.insertError = null;
  h.allowed = true;
  h.denylist = [];
  h.settingsDown = false;
  process.env.BIDX_KEY = "b".repeat(64);
});

describe("redactForInbox", () => {
  it("replaces phones, emails, LINE ids and plates with tokens", async () => {
    const { redactForInbox } = await import("./line-inbox");
    const out = redactForInbox("สนใจสืบแฟนค่ะ โทร 081-234-5678 หรือ mail somchai@gmail.com ไลน์ @somchai_k รถทะเบียน 1กข 1234");
    expect(out).not.toContain("081-234-5678");
    expect(out).not.toContain("somchai@gmail.com");
    expect(out).not.toContain("@somchai_k");
    expect(out).not.toContain("1กข 1234");
    expect(out).toContain("[เบอร์โทร]");
    expect(out).toContain("สนใจสืบแฟน");
  });
  it("keeps the company's own contact details", async () => {
    const { redactForInbox } = await import("./line-inbox");
    expect(redactForInbox("ติดต่อ 096-846-1406 ได้ไหม")).toContain("096-846-1406");
  });
  it("collapses whitespace and caps length", async () => {
    const { redactForInbox, MAX_LEN } = await import("./line-inbox");
    expect(redactForInbox("  a \n\n b  ")).toBe("a b");
    expect(redactForInbox("x".repeat(5000)).length).toBeLessThanOrEqual(MAX_LEN);
  });
  it("catches Thai-digit phone numbers and untitled names", async () => {
    const { redactForInbox } = await import("./line-inbox");
    const out = redactForInbox("โทร ๐๘๑๒๓๔๕๖๗๘ แฟนชื่อสมชาย อายุ 34 ปี");
    expect(out).not.toMatch(/0812345678|๐๘๑/);
    expect(out).not.toContain("สมชาย");
    expect(out).toContain("[เบอร์โทร]");
  });
  it("keeps ordinary Thai that starts with the pronoun คุณ or contains ชื่อเสียง", async () => {
    const { redactForInbox } = await import("./line-inbox");
    expect(redactForInbox("คุณรับงานต่างจังหวัดไหม")).toBe("คุณรับงานต่างจังหวัดไหม");
    expect(redactForInbox("คุณควรเตรียมรูปถ่ายและตารางชีวิตของเป้าหมาย")).toContain("เตรียมรูปถ่าย");
    expect(redactForInbox("บริษัทนี้มีชื่อเสียงดี")).toContain("ชื่อเสียง");
    expect(redactForInbox("แฟนชื่อสมชาย ทำงานที่กรุงเทพ")).not.toContain("สมชาย");
  });
  it("takes the name out of a customer's message and leaves the question readable", async () => {
    // Every branch of the name rules, including the one that ends at a space — the shape a customer
    // actually writes on LINE. The sentence has to survive: this inbox is what the FAQ mining reads.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, gone, kept] of [
      ["อยากสืบแฟนครับ ชื่อเล่นของแฟนผม บอย อยู่บางนา", "บอย", "อยากสืบแฟนครับ"],
      ["ขอเช็คประวัติ ชื่อของเป้าหมาย สมหญิง ค่ะ", "สมหญิง", "ขอเช็คประวัติ"],
    ] as const) {
      const out = redactForInbox(input);
      expect(out, input).not.toContain(gone);
      expect(out, input).toContain(kept);
      expect(out, input).toContain("[ชื่อ]");
    }
  });
  it("redacts a name that runs straight into the next word, which is how Thai is written", async () => {
    // Every earlier test put a space after the name, so a boundary check that skipped 61% of real
    // names passed them all. These are the shapes a customer actually types.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, gone] of [
      ["แฟนชื่อสมชายมาปรึกษาเราเมื่อวาน", "สมชาย"],
      ["เป้าหมายชื่อสมหญิงทำงานที่สีลม", "สมหญิง"],
      ["ชื่อว่าสมชายอยู่นนทบุรี", "สมชาย"],
      ["พบนายสมชายที่คอนโด", "สมชาย"],
      ["ชื่อเล่นของลูกค้าคือบอยอยู่บางนา", "บอย"],
    ] as const) {
      const out = redactForInbox(input);
      expect(out, input).not.toContain(gone);
      expect(out, input).toContain("[ชื่อ]");
    }
    // two names in one message: both go
    const both = redactForInbox("แฟนชื่อสมชายกับเพื่อนชื่อบอย");
    expect(both).not.toContain("สมชาย");
    expect(both).not.toContain("บอย");
  });
  it("gives up the sentence rather than the name when the finding swallowed both", async () => {
    // "ชื่อของสามี สมชาย ครับ ช่วยดูให้ได้ไหม" — the scanner's gap crosses the spaces, so its finding
    // runs past the name and over the question. We cannot tell which token in there is the name
    // (Thai has no word spaces), so the whole finding goes. Losing the question is the cheaper loss.
    const { redactForInbox } = await import("./line-inbox");
    const out = redactForInbox("ชื่อของสามี สมชาย ครับ ช่วยดูให้ได้ไหม");
    expect(out).not.toContain("สมชาย");
    expect(out).toContain("[ชื่อ]");
  });
  it("known gap: a label glued to the name is not detected at all", async () => {
    // "ชื่อของลูกค้าสมชาย ครับ" — no space between the label and the name, so the rule's name slot can
    // only land on the particle, which it refuses. The scan therefore reports nothing and the message
    // is stored as written, exactly as on main. Recorded in docs §15b: a miss, not a [ชื่อ] that lies.
    // Pinned so that a rule change which starts detecting this shape shows up here.
    const { redactForInbox } = await import("./line-inbox");
    for (const input of ["ชื่อของลูกค้าสมชาย ครับ", "ชื่อของสามีสมชาย ค่ะ"]) {
      expect(redactForInbox(input), input).toBe(input);
    }
  });
  it("keeps a plate finding intact when a name finding overlaps it", async () => {
    // The name finding is the wider one and used to be redacted first, erasing the text the plate
    // finding was still waiting to match — the row kept the digits.
    const { redactForInbox } = await import("./line-inbox");
    const out = redactForInbox("ชื่อของเป้าหมาย บอย ทะเบียน กข 1234 ครับ");
    expect(out).toContain("[ทะเบียนรถ]");
    expect(out).not.toContain("1234");
    expect(out).not.toContain("บอย");
  });
  it("leaves no orphan syllable where the length cap cut a name in half", async () => {
    // The name slot stops at ten letters, so a long name used to be replaced in part and leave its
    // last syllable behind ("แฟนชื่อ[ชื่อ]ัย"). The replacement now takes the rest of the word.
    const { redactForInbox } = await import("./line-inbox");
    // The run after the name goes with it: it is a surname often enough that leaving it stores half an
    // identity, and Thai writes no space inside a word to tell a surname from the rest of a sentence.
    expect(redactForInbox("แฟนชื่อประสิทธิ์ชัย ทำงานที่สีลม")).toBe("แฟนชื่อ[ชื่อ]");
    // And with the finding no longer running past the name, the question survives intact.
    expect(redactForInbox("ชื่อของสามี สมชาย ครับ ช่วยดูให้ได้ไหม")).toBe("[ชื่อ] ครับ ช่วยดูให้ได้ไหม");
  });
  it("handles the shapes a customer types across several lines", async () => {
    // LINE users press Enter, and the text is normalised to single spaces — so the label, a politeness
    // particle and the name each end up separated by a space. These are the security gate's own rows.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, gone] of [
      ["สวัสดีครับ อยากสืบเรื่องภรรยา\nชื่อของภรรยา ครับ\nคือ สมหญิง ศรีสุข\nช่วยดูให้ได้ไหม", "สมหญิง"],
      ["ขอปรึกษาหน่อยนะคะ\nชื่อของสามี นะคะ\nคือ ธนวัฒน์ วงศ์ทอง", "ธนวัฒน์"],
      ["ชื่อของเป้าหมาย ครับ\nสมชาย ใจดี\nอยู่บางนา", "สมชาย"],
      ["ชื่อของผู้ต้องสงสัย ครับ\nปรีชา รักไทย", "ปรีชา"],
      ["อยากให้สืบพฤติกรรมสามีครับ\nชื่อของสามี ครับ กิตติ แสนสุข\nเบอร์ 0812345678", "กิตติ"],
      ["ชื่อของลูกค้า ครับ\nคือ สมชาย\nทะเบียน กข 1234", "สมชาย"],
      // a label that contains ว่า: ผู้ว่าจ้าง is not saying anything, so the cue is the คือ after it
      ["ชื่อของ ผู้ว่าจ้าง คือ สมหญิง ครับ", "สมหญิง"],
      // and a surname the rule takes with the name
      ["ชื่อในรายงาน ค่ะ คือ สมหญิง ศรีสุข ค่ะ", "ศรีสุข"],
    ] as const) {
      const out = redactForInbox(input);
      expect(out, input).not.toContain(gone);
      expect(out, input).toContain("[ชื่อ]");
    }
    // the identifier keeps its own token even though the name finding overlaps it
    expect(redactForInbox("ชื่อของลูกค้า ครับ\nคือ สมชาย\nทะเบียน กข 1234")).toContain("[ทะเบียนรถ]");
    expect(redactForInbox("อยากให้สืบพฤติกรรมสามีครับ\nชื่อของสามี ครับ กิตติ แสนสุข\nเบอร์ 0812345678")).toContain("[เบอร์โทร]");
  });
  it("redacts the name everywhere it is mentioned, not only where it was found", async () => {
    // Naming the target and then talking about them is how these messages are actually written, and
    // redacting only the first mention leaves the name in the row next to a [ชื่อ] that says it is gone.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, gone] of [
      ["ชื่อของลูกค้าคือ สมชาย ครับ สมชายหายไป 3 วัน", "สมชาย"],
      ["ชื่อของแฟนคือ สมชาย ช่วยตามสมชายให้ด้วย", "สมชาย"],
      ["สมชาย เป็นสามีค่ะ ชื่อของสามีคือ สมชาย", "สมชาย"],
      // the คือ form captures the full name, and the later mention is usually the first name alone
      ["ชื่อของเป้าหมายคือ สมชาย ใจดี อยากรู้ว่าสมชายไปไหน", "สมชาย"],
    ] as const) {
      expect(redactForInbox(input), input).not.toContain(gone);
    }
  });
  it("takes the surname with the name, whichever rule found it", async () => {
    // A Thai surname alone identifies a family, and left beside the token it reads as redacted.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, gone] of [
      ["นายสมชาย ใจดี ครับ", "ใจดี"],
      ["คุณบอย ใจดี ครับ", "ใจดี"],
      ["แฟนชื่อสมชาย ใจดี", "ใจดี"],
      ["ชื่อของลูกค้าคือ สมชาย ประเสริฐศรีสกุลชัย ครับ", "ประเสริฐศรีสกุลชัย"],
      // A surname that begins with a word on the never-a-surname list is still a surname. As a prefix
      // test that list kept มีชัย, ที่รักษ์ and ช่วยชาติ readable next to the token.
      ["นายสมชาย มีชัย", "มีชัย"],
      ["คุณบอย มีชัย ครับ", "มีชัย"],
      ["แฟนชื่อสมชาย มีชัย", "มีชัย"],
      ["ชื่อของลูกค้าคือ สมชาย ที่รักษ์ ครับ", "ที่รักษ์"],
      ["ชื่อของลูกค้าคือ สมชาย ช่วยชาติ ครับ", "ช่วยชาติ"],
      // ชนะ/ธนะ/มานะ are among the commonest syllables in Thai surnames and each contains นะ. Testing
      // for speech anywhere inside the run vetoed all of them — 80 of 280 shapes the security gate
      // measured — so the test looks at the end of the run, where a particle actually falls.
      ["พบนายสมชาย ชนะชัย ที่คอนโด", "ชนะชัย"],
      ["คุณบอย ธนะรัตน์ โทรมาเมื่อเช้า", "ธนะรัตน์"],
      ["แฟนชื่อสมชาย มานะชัย ครับ", "มานะชัย"],
      ["ชื่อของสามีคือ สมชาย จิตรชนะ", "จิตรชนะ"],
      ["นายสมชาย นะวะมันดา", "นะวะมันดา"],
      // and the length of the surname is not what decides it, for any of the rules
      ["นายสมชาย ประเสริฐศรีสกุลชัย ครับ", "ประเสริฐศรีสกุลชัย"],
      ["คุณบอย วงศ์ทองสุวรรณชัย ครับ", "วงศ์ทองสุวรรณชัย"],
      ["แฟนชื่อสมชาย ประเสริฐศรีสกุลชัย", "ประเสริฐศรีสกุลชัย"],
    ] as const) {
      expect(redactForInbox(input), input).not.toContain(gone);
    }
  });
  it("does not eat a particle standing on its own as if it were a surname", async () => {
    // The never-a-surname list earns its place here: without it the token after the name takes a bare
    // คะ / จ้า / ค่า with it, and 199 rows of the gates' corpus lose their ending for nothing.
    const { redactForInbox } = await import("./line-inbox");
    for (const t of ["ชื่อของแฟนคือ สมชาย คะ", "ชื่อของแฟนคือ สมชาย จ้า", "ชื่อของแฟนคือ สมชาย ค่า"]) {
      expect(redactForInbox(t), t).toBe(t.replace("สมชาย", "[ชื่อ]"));
    }
  });
  it("never leaves a name it reported anywhere in the row", async () => {
    // A property, not a list of shapes: whatever the scan says the name is, none of it may survive.
    // Every earlier build passed shape tests while leaking in a shape nobody had written down.
    const { redactForInbox } = await import("./line-inbox");
    const { scrubText } = await import("./privacy/scrub");
    const messages = [
      "ชื่อของแฟนคือ สมชาย ครับ สมชาย หายไปแล้ว",
      "แฟนชื่อกิตติ ค่ะ กิตติ ไม่ยอมรับสาย",
      "นายปรีชา รักไทย ครับ ปรีชา เคยมาที่ร้าน",
      "คุณบอย ครับ บอย หายไป 3 วัน",
      "ชื่อของเป้าหมายคือ สมชาย ใจดี อยากรู้ว่าสมชายไปไหน",
      "ชื่อของภรรยา ครับ คือ สมหญิง ศรีสุข ช่วยดูให้ได้ไหม",
      "แฟนชื่อสมชายมาปรึกษาเราเมื่อวาน",
      "ชื่อเล่นของลูกค้าคือบอยอยู่บางนา",
    ];
    for (const t of messages) {
      const out = redactForInbox(t);
      for (const f of scrubText({ fields: { t }, rules: null })) {
        if (f.kind === "name" && f.name) expect(out, `${t} → ${out} (name ${f.name})`).not.toContain(f.name);
      }
    }
  });
  it("redacts a two-letter nickname even where it sits inside another word", async () => {
    // เอ is a real nickname and also the first syllable of เอกสาร, with no space between them. Skipping
    // those left บอย readable in "ผมหาบอยไม่เจอเลย" next to a token saying it was gone, so the rule is
    // the one both gates hold: when it is ambiguous, redact, and lose the word instead.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, gone] of [
      ["ชื่อเล่นว่าเอ ขอเอกสารด้วยครับ", "เอกสาร"],
      ["ชื่อเล่นของเป้าหมายคือ บอย ครับ ผมหาบอยไม่เจอเลย", "บอย"],
      ["คุณบอย ครับ ตามหาบอยด้วย", "บอย"],
    ] as const) {
      const out = redactForInbox(input);
      expect(out, input).not.toContain(gone);
      expect(out, input).toContain("[ชื่อ]");
    }
  });
  it("leaves a message with no personal name in it readable", async () => {
    const { redactForInbox } = await import("./line-inbox");
    for (const t of [
      "สวัสดีค่ะ ค่าบริการสืบพฤติกรรมเท่าไหร่ ขอบคุณค่ะ",
      "ชื่อของลูกค้า ค่ะ ต้องใส่ทุกช่องไหม",
      "ราคาประมาณเท่าไหร่ครับ",
      "ขอทราบชื่อของบริการนี้หน่อยครับ",
      "รักษาชื่อเสียงของลูกค้าไหมครับ",
    ]) {
      expect(redactForInbox(t), t).toBe(t);
    }
  });
  it("pins the two mechanisms a single mutant could still remove quietly", async () => {
    // Shapes the security gate measured for exactly this: the first-token search, and the speech test.
    const { redactForInbox } = await import("./line-inbox");
    // Only the first-token search catches the second mention here, because the surname step stops at
    // the particle instead of swallowing the rest.
    expect(redactForInbox("ชื่อของเป้าหมายคือ สมชาย ใจดี ครับ สมชายไปไหน")).not.toContain("สมชาย");
    // And only the speech test keeps this question, by refusing to read it as a surname. The gate's own
    // shape used a two-letter nickname, which this build redacts inside other words on purpose, so the
    // name here is long enough that the surname step is what decides.
    expect(redactForInbox("แฟนชื่อสมชาย ขอเอกสารด้วยครับ")).toContain("ขอเอกสารด้วยครับ");
  });
  it("does not take the sentence after an identifier with it", async () => {
    // An identifier match ends where its pattern ends, so there is no half-word to finish — extending
    // it the way a name is extended turned the whole message into one token.
    const { redactForInbox } = await import("./line-inbox");
    expect(redactForInbox("อายุ 34 ปีที่แล้วเขาหายไปจากบ้าน")).toBe("[ข้อมูลส่วนตัว]ที่แล้วเขาหายไปจากบ้าน");
    expect(redactForInbox("เขาอายุ 28 ปีทำงานที่สีลม")).toBe("เขา[ข้อมูลส่วนตัว]ทำงานที่สีลม");
    expect(redactForInbox("โทร 0812345678 ได้เลยครับ")).toBe("โทร [เบอร์โทร] ได้เลยครับ");
  });
  it("tokenises the identifier kinds a customer actually sends", async () => {
    const { redactForInbox } = await import("./line-inbox");
    expect(redactForInbox("เกิดวันที่ 12/03/2540 ครับ")).toContain("[วันที่]");
    expect(redactForInbox("เลขบัตร 1234567890123 ครับ")).toContain("[เลขบัตร]");
    expect(redactForInbox("ดูที่ https://example.com/profile ครับ")).toContain("[ลิงก์]");
    expect(redactForInbox("อีเมล somchai@example.com ครับ")).toContain("[อีเมล]");
  });
  it("returns nothing for an empty message and never exceeds the stored length", async () => {
    const { redactForInbox } = await import("./line-inbox");
    expect(redactForInbox("")).toBe("");
    expect(redactForInbox("   \n  ")).toBe("");
    // Tokens are longer than what they replace, so a long message of names can grow before it is cut.
    const long = "แฟนชื่อสมชาย ".repeat(200);
    expect(redactForInbox(long).length).toBeLessThanOrEqual(1500);
  });
  it("redacts a vocative คุณ name and the non-name kinds", async () => {
    const { redactForInbox } = await import("./line-inbox");
    expect(redactForInbox("คุณสมชาย โทรมาเมื่อเช้า")).not.toContain("สมชาย");
    expect(redactForInbox("โทร 0812345678 ได้เลยครับ")).toBe("โทร [เบอร์โทร] ได้เลยครับ");
    expect(redactForInbox("อยู่ เลขที่ 12/34 ซอยอารีย์ ครับ")).toContain("[ที่อยู่]");
  });
  it("does not put a [ชื่อ] beside a name it failed to locate", async () => {
    // A label with spaces between the cue and the name used to make the wrong word get replaced —
    // the row then read as redacted while the real name sat next to the token.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, gone] of [
      ["ชื่อของ ผู้ต้องสงสัย คือ สมชาย ครับ", "สมชาย"],
      ["ชื่อของ แฟน คือ บอย", "บอย"],
      ["ชื่อใน บัตรประชาชน คือ สมหญิง ค่ะ", "สมหญิง"],
      // No คือ/ว่า at all, and a label longer than the length cap: the cap cuts the label in half,
      // so the replacement succeeds on a word that is not the name.
      ["ชื่อของ ผู้ต้องสงสัย สมชาย ครับ", "สมชาย"],
      ["ชื่อของ บัตรประชาชน ธนวัฒน์ ครับ", "ธนวัฒน์"],
      ["ชื่อของ แฟน เก่า สมชาย ครับ", "สมชาย"],
      ["ชื่อในทะเบียนบ้าน ของ เป้าหมาย สมชาย ครับ", "สมชาย"],
      // The prefix runs into a name that contains ว่า, so no name is picked at all.
      ["ชื่อของ ผู้ต้องสงสัย คือ ว่าน ครับ", "ว่าน"],
    ] as const) {
      const out = redactForInbox(input);
      expect(out, input).not.toContain(gone);
      expect(out, input).toContain("[ชื่อ]");
    }
  });
  it("leaves a sentence alone when the scan grabbed part of a longer word", async () => {
    // Thai has no spaces inside a word, so a "name" with more letters straight after it is a fragment.
    const { redactForInbox } = await import("./line-inbox");
    for (const t of ["ชื่อที่ไม่ชัดว่าเขียนอย่างไร", "ชื่อในรายงานคือเลขคดีที่เปิดไว้", "ชื่อที่ลูกค้าให้มาคือตรงกับทะเบียนบ้าน"]) {
      expect(redactForInbox(t), t).toBe(t);
    }
  });
  it("redacts a name introduced with a label, nickname included", async () => {
    // The intro shape produces a longer excerpt than a bare cue; without stripping it, the
    // length guard reads it as a clause and the nickname is stored verbatim.
    const { redactForInbox } = await import("./line-inbox");
    for (const [input, name] of [
      ["ชื่อเล่นของลูกค้าคือบอย", "บอย"],
      ["ชื่อของลูกค้าคือสมชาย", "สมชาย"],
      ["ชื่อในโฉนดคือสมชาย", "สมชาย"],
    ] as const) {
      const out = redactForInbox(input);
      expect(out, input).not.toContain(name);
      expect(out, input).toContain("[ชื่อ]");
    }
    // an ordinary question about the service is untouched
    expect(redactForInbox("ขอทราบชื่อของบริการนี้หน่อยครับ")).toContain("บริการ");
  });
  it("applies the owner denylist", async () => {
    const { redactForInbox } = await import("./line-inbox");
    expect(redactForInbox("เคสของ Pimchanok", { denylist: ["pimchanok"], custom_patterns: [], strict_mode: false })).not.toContain("Pimchanok");
  });
});

describe("hashSender / looksLikeBotCommand", () => {
  it("hashes deterministically and never returns the id", async () => {
    const { hashSender } = await import("./line-inbox");
    const a = hashSender("Uabc123");
    expect(a).toBe(hashSender("Uabc123"));
    expect(a).not.toContain("Uabc");
    expect(a).toHaveLength(32);
  });
  it("returns null without BIDX_KEY", async () => {
    delete process.env.BIDX_KEY;
    const { hashSender } = await import("./line-inbox");
    expect(hashSender("U1")).toBeNull();
  });
  it("recognises bot commands and OTP codes", async () => {
    const { looksLikeBotCommand } = await import("./line-inbox");
    expect(looksLikeBotCommand("ผูกบัญชี 0812345678")).toBe(true);
    expect(looksLikeBotCommand("เคส 2026-0042")).toBe(true);
    expect(looksLikeBotCommand("123456")).toBe(true);
    expect(looksLikeBotCommand("ติด GPS รถแฟนได้ไหม")).toBe(false);
  });
});

describe("captureCustomerMessage", () => {
  it("stores a redacted row for an unlinked sender", async () => {
    const { captureCustomerMessage } = await import("./line-inbox");
    const ok = await captureCustomerMessage({ lineUserId: "U1", text: "ตามแฟนใช้กี่วัน โทรกลับ 081-234-5678", isLinkedAgent: false });
    expect(ok).toBe(true);
    expect(h.inserted).toHaveLength(1);
    expect(String(h.inserted[0].text_redacted)).not.toContain("081-234-5678");
    expect(h.inserted[0].sender_hash).toHaveLength(32);
  });
  it("skips linked agents, commands and tiny messages", async () => {
    const { captureCustomerMessage } = await import("./line-inbox");
    expect(await captureCustomerMessage({ lineUserId: "U1", text: "ราคาเท่าไหร่", isLinkedAgent: true })).toBe(false);
    expect(await captureCustomerMessage({ lineUserId: "U1", text: "ผูกบัญชี 0812345678", isLinkedAgent: false })).toBe(false);
    expect(await captureCustomerMessage({ lineUserId: "U1", text: "ก", isLinkedAgent: false })).toBe(false);
    expect(h.inserted).toHaveLength(0);
  });
  it("drops messages once the per-sender rate limit is hit", async () => {
    h.allowed = false;
    const { captureCustomerMessage } = await import("./line-inbox");
    expect(await captureCustomerMessage({ lineUserId: "U1", text: "ราคาเท่าไหร่ครับ", isLinkedAgent: false })).toBe(false);
    expect(h.inserted).toHaveLength(0);
  });
  it("uses the owner denylist from settings", async () => {
    h.denylist = ["Pimchanok"];
    const { captureCustomerMessage } = await import("./line-inbox");
    await captureCustomerMessage({ lineUserId: "U1", text: "อยากสืบ Pimchanok ค่ะ", isLinkedAgent: false });
    expect(String(h.inserted[0].text_redacted)).not.toContain("Pimchanok");
  });
  it("fails closed when the privacy settings cannot be loaded", async () => {
    h.settingsDown = true;
    const { captureCustomerMessage } = await import("./line-inbox");
    expect(await captureCustomerMessage({ lineUserId: "U1", text: "สนใจสืบทรัพย์สิน", isLinkedAgent: false })).toBe(false);
    expect(h.inserted).toHaveLength(0);
  });
  it("never throws on DB errors", async () => {
    h.insertError = { message: "boom" };
    const { captureCustomerMessage } = await import("./line-inbox");
    expect(await captureCustomerMessage({ lineUserId: "U1", text: "สนใจสืบทรัพย์สิน", isLinkedAgent: false })).toBe(false);
  });
});
