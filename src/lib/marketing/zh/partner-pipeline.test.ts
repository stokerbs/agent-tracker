import { describe, it, expect } from "vitest";
import { PARTNER_STAGES, PARTNER_STAGE_LABELS, PARTNER_TYPE_LABELS, PARTNER_SERVICE_LABELS, isPartnerStage } from "./partner-pipeline";
import { ZH_PARTNER_TYPES, ZH_PARTNER_SERVICES } from "./partner-schema";

describe("partner pipeline", () => {
  it("labels every stage, type and service in Thai and Chinese", () => {
    for (const s of PARTNER_STAGES) expect(PARTNER_STAGE_LABELS[s].th && PARTNER_STAGE_LABELS[s].zh).toBeTruthy();
    for (const t of ZH_PARTNER_TYPES) expect(PARTNER_TYPE_LABELS[t]?.zh, t).toBeTruthy();
    for (const s of ZH_PARTNER_SERVICES) expect(PARTNER_SERVICE_LABELS[s]?.zh, s).toBeTruthy();
  });
  it("guards unknown stages", () => {
    expect(isPartnerStage("active")).toBe(true);
    expect(isPartnerStage("won")).toBe(false);
  });
});
