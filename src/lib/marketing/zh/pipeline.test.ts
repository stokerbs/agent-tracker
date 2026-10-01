import { describe, it, expect } from "vitest";
import { LEAD_STAGES, LEAD_STAGE_LABELS, isLeadStage, legacyStatusFor, funnelStep } from "./pipeline";

describe("lead pipeline", () => {
  it("has the 13 stages from the brief in order", () => {
    expect(LEAD_STAGES).toEqual([
      "new", "contacted", "qualified", "requirements_received", "quotation_sent", "follow_up",
      "payment_pending", "paid", "case_created", "investigation_active", "report_delivered", "closed", "referral",
    ]);
    for (const s of LEAD_STAGES) expect(LEAD_STAGE_LABELS[s].zh.length).toBeGreaterThan(0);
  });

  it("derives the legacy status", () => {
    expect(legacyStatusFor("new")).toBe("new");
    expect(legacyStatusFor("quotation_sent")).toBe("contacted");
    expect(legacyStatusFor("closed")).toBe("closed");
    expect(legacyStatusFor("referral")).toBe("closed");
  });

  it("maps stages onto the visitor→contact→qualified→quote→paid funnel", () => {
    expect(funnelStep("contacted")).toBe("contact");
    expect(funnelStep("requirements_received")).toBe("qualified");
    expect(funnelStep("follow_up")).toBe("quote");
    expect(funnelStep("case_created")).toBe("paid");
  });

  it("guards unknown values", () => {
    expect(isLeadStage("paid")).toBe(true);
    expect(isLeadStage("won")).toBe(false);
  });
});
