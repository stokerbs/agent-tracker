import { describe, it, expect } from "vitest";
import { zhPartnerSchema, generateReferralSlug, REFERRAL_SLUG_PATTERN, referralLink } from "./partner-schema";

const valid = {
  orgName: "Siam Legal Partners",
  partnerType: "law_firm",
  contactName: "李律师",
  wechatId: "siamlegal",
  email: "",
  phone: "",
  city: "曼谷",
  country: "thailand",
  orgWebsite: "",
  services: ["due_diligence", "litigation_support"],
  expectedVolume: "monthly_1_3",
  message: "",
  consent: true,
};

describe("zhPartnerSchema", () => {
  it("accepts a complete application", () => {
    expect(zhPartnerSchema.safeParse(valid).success).toBe(true);
  });
  it("requires at least one contact channel and one service", () => {
    expect(zhPartnerSchema.safeParse({ ...valid, wechatId: "" }).success).toBe(false);
    expect(zhPartnerSchema.safeParse({ ...valid, wechatId: "", email: "a@b.co" }).success).toBe(true);
    expect(zhPartnerSchema.safeParse({ ...valid, services: [] }).success).toBe(false);
    expect(zhPartnerSchema.safeParse({ ...valid, services: ["phone_tracking"] }).success).toBe(false);
  });
  it("rejects unknown types, bad urls and missing consent", () => {
    expect(zhPartnerSchema.safeParse({ ...valid, partnerType: "bank" }).success).toBe(false);
    expect(zhPartnerSchema.safeParse({ ...valid, orgWebsite: "not a url" }).success).toBe(false);
    expect(zhPartnerSchema.safeParse({ ...valid, orgWebsite: "https://example.com" }).success).toBe(true);
    expect(zhPartnerSchema.safeParse({ ...valid, orgWebsite: "javascript:alert(1)" }).success).toBe(false);
    expect(zhPartnerSchema.safeParse({ ...valid, orgWebsite: "data:text/html,x" }).success).toBe(false);
    expect(zhPartnerSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
});

describe("referral slug", () => {
  it("is URL-safe, keeps a Latin org hint, drops CJK, and matches the pattern", () => {
    const s = generateReferralSlug("Siam Legal Partners 曼谷", () => 0);
    expect(s).toBe("partner-siam-legal-partners-222222");
    expect(REFERRAL_SLUG_PATTERN.test(s)).toBe(true);
    expect(generateReferralSlug("律师事务所", () => 0)).toBe("partner-222222");
    expect(generateReferralSlug("A".repeat(40), () => 0.99)).toMatch(/^partner-a{24}-[a-z0-9]{6}$/);
    // Default randomness is crypto-backed and never repeats across a sample.
    const sample = new Set(Array.from({ length: 50 }, () => generateReferralSlug("x")));
    expect(sample.size).toBe(50);
    for (const v of sample) expect(REFERRAL_SLUG_PATTERN.test(v)).toBe(true);
  });
  it("builds the public link with utm attribution", () => {
    expect(referralLink("partner-x-222222")).toBe("https://detectivepulse.com/zh?utm_source=partner-x-222222&utm_medium=referral");
  });
});
