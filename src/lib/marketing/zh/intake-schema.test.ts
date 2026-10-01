import { describe, it, expect } from "vitest";
import { zhIntakeSchema, intakeFromFormData } from "./intake-schema";

const valid = {
  name: "王先生",
  wechatId: "wang_88",
  email: "",
  country: "china",
  targetLocation: "bangkok",
  service: "relationship",
  knownInfo: "对方在曼谷素坤逸工作，有照片。",
  objective: "确认对方的日常生活情况。",
  preferredStart: "2026-10-15",
  estimatedDuration: "4-7_days",
  urgency: "normal",
  budgetRange: "50k-100k",
  consent: true,
};

describe("zhIntakeSchema", () => {
  it("accepts a complete submission", () => {
    expect(zhIntakeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects without explicit consent", () => {
    expect(zhIntakeSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, consent: "yes" }).success).toBe(false);
  });

  it("rejects unknown enum values (service / location / budget / country)", () => {
    expect(zhIntakeSchema.safeParse({ ...valid, service: "phone_tracking" }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, country: "中国" }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, targetLocation: "hanoi" }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, budgetRange: "1m" }).success).toBe(false);
  });

  it("requires a WeChat ID and bounded free text", () => {
    expect(zhIntakeSchema.safeParse({ ...valid, wechatId: "a" }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, knownInfo: "短" }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, knownInfo: "x".repeat(3001) }).success).toBe(false);
  });

  it("validates the optional email and date formats", () => {
    expect(zhIntakeSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, email: "a@b.co" }).success).toBe(true);
    expect(zhIntakeSchema.safeParse({ ...valid, preferredStart: "15/10/2026" }).success).toBe(false);
    expect(zhIntakeSchema.safeParse({ ...valid, preferredStart: "" }).success).toBe(true);
  });

  it("round-trips FormData (consent 'true' → true)", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valid)) fd.set(k, String(v));
    const parsed = zhIntakeSchema.safeParse(intakeFromFormData(fd));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.consent).toBe(true);
  });
});
