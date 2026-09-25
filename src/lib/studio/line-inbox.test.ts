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
      ["ชื่อของสามี สมชาย ครับ ช่วยดูให้ได้ไหม", "สมชาย", "ช่วยดูให้ได้ไหม"],
      ["ขอเช็คประวัติ ชื่อของเป้าหมาย สมหญิง ค่ะ", "สมหญิง", "ขอเช็คประวัติ"],
      ["ชื่อในรายงาน สมหญิง ศรีสุข", "ศรีสุข", "ชื่อในรายงาน"],
    ] as const) {
      const out = redactForInbox(input);
      expect(out, input).not.toContain(gone);
      expect(out, input).toContain(kept);
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
