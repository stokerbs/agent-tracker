import { describe, expect, it } from "vitest";
import {
  formatCharBudget,
  NO_ACCOUNTS_REASON,
  nonSelectableReadyAssets,
  normaliseSocialStatus,
  NOT_CONNECTED_REASON,
  platformDisabledReason,
  PUBLISHED_GATE_REASON,
  publishBlockedReason,
  selectableAssets,
  selectedMediaKinds,
  sortPostsNewest,
  STATUS_GATE_REASON,
} from "./social-format";

const img = (id: string, status = "ready") => ({ id, kind: "image", mime: "image/png", status });
const vid = (id: string, status = "ready") => ({ id, kind: "video", mime: "video/mp4", status });
const aud = (id: string, status = "ready") => ({ id, kind: "audio", mime: "audio/mpeg", status });

describe("normaliseSocialStatus", () => {
  it("passes known statuses through and falls back to queued", () => {
    expect(normaliseSocialStatus("published")).toBe("published");
    expect(normaliseSocialStatus("deleted")).toBe("deleted");
    expect(normaliseSocialStatus("weird")).toBe("queued");
  });
});

describe("sortPostsNewest", () => {
  it("orders by created_at descending without mutating the input", () => {
    const posts = [{ created_at: "2026-09-01T00:00:00Z" }, { created_at: "2026-09-03T00:00:00Z" }, { created_at: "2026-09-02T00:00:00Z" }];
    const sorted = sortPostsNewest(posts);
    expect(sorted.map((p) => p.created_at.slice(8, 10))).toEqual(["03", "02", "01"]);
    expect(posts[0].created_at).toBe("2026-09-01T00:00:00Z");
  });
});

describe("asset selection", () => {
  it("only ready images/videos are selectable; ready audio is listed as non-selectable", () => {
    const assets = [img("a"), vid("b"), aud("c"), img("d", "pending"), img("e", "failed"), aud("f", "pending")];
    expect(selectableAssets(assets).map((a) => a.id)).toEqual(["a", "b"]);
    expect(nonSelectableReadyAssets(assets).map((a) => a.id)).toEqual(["c"]);
  });

  it("selectedMediaKinds keeps selection order and ignores unknown ids", () => {
    const assets = [img("a"), vid("b")];
    expect(selectedMediaKinds(assets, ["b", "zzz", "a"])).toEqual(["video", "image"]);
  });
});

describe("platformDisabledReason", () => {
  it("says not connected before checking media requirements", () => {
    expect(platformDisabledReason("instagram", ["facebook"], [])).toBe(NOT_CONNECTED_REASON);
  });
  it("delegates to platformRequirement when connected", () => {
    expect(platformDisabledReason("facebook", ["facebook"], [])).toBeNull();
    expect(platformDisabledReason("instagram", ["instagram"], [])).toMatch(/Instagram/);
    expect(platformDisabledReason("instagram", ["instagram"], ["image"])).toBeNull();
    expect(platformDisabledReason("youtube", ["youtube"], ["image"])).toMatch(/วิดีโอ/);
    expect(platformDisabledReason("youtube", ["youtube"], ["video"])).toBeNull();
  });
});

describe("publishBlockedReason", () => {
  it("mirrors the server gate order: provider → status → accounts", () => {
    expect(publishBlockedReason({ available: false, availabilityReason: "no key", status: "approved", activeCount: 2 })).toBe("no key");
    expect(publishBlockedReason({ available: false, status: "approved", activeCount: 2 })).toMatch(/provider/);
    expect(publishBlockedReason({ available: true, status: "draft", activeCount: 2 })).toBe(STATUS_GATE_REASON);
    expect(publishBlockedReason({ available: true, status: "published", activeCount: 2 })).toBe(PUBLISHED_GATE_REASON);
    expect(publishBlockedReason({ available: true, status: "approved", activeCount: 0 })).toBe(NO_ACCOUNTS_REASON);
    expect(publishBlockedReason({ available: true, status: "approved", activeCount: 1 })).toBeNull();
    expect(publishBlockedReason({ available: true, status: "scheduled", activeCount: 1 })).toBeNull();
  });
});

describe("formatCharBudget", () => {
  it("uses en-GB grouping", () => {
    expect(formatCharBudget(1234, 2200)).toBe("1,234/2,200");
  });
});
