import { describe, expect, it } from "vitest";
import { effectivePrivacy, worstPrivacy } from "./gate";

const row = (status: string, checked_by: string, created_at: string) => ({ status, checked_by, created_at });

describe("effectivePrivacy", () => {
  it("is null with no checks", () => {
    expect(effectivePrivacy([]).status).toBeNull();
  });
  it("uses the latest deterministic scan when no AI/human verdict exists", () => {
    const r = effectivePrivacy([row("review_required", "deterministic", "2"), row("safe", "deterministic", "1")]);
    expect(r.status).toBe("review_required");
    expect(r.verdict).toBeNull();
  });
  it("keeps a stricter AI verdict even after a newer safe re-scan (matches the server gate)", () => {
    const r = effectivePrivacy([row("safe", "deterministic", "3"), row("review_required", "ai", "2"), row("safe", "deterministic", "1")]);
    expect(r.status).toBe("review_required");
    expect(r.verdictGoverns).toBe(true);
  });
  it("lets a newer AI check clear an older one", () => {
    const r = effectivePrivacy([row("safe", "ai", "3"), row("review_required", "ai", "2")]);
    expect(r.status).toBe("safe");
    expect(r.verdictGoverns).toBe(false);
  });
  it("a fresh deterministic block always wins", () => {
    const r = effectivePrivacy([row("blocked", "deterministic", "3"), row("safe", "ai", "2")]);
    expect(r.status).toBe("blocked");
  });
});

describe("worstPrivacy", () => {
  it("orders safe < review_required < blocked", () => {
    expect(worstPrivacy("safe", "review_required")).toBe("review_required");
    expect(worstPrivacy("blocked", "review_required")).toBe("blocked");
    expect(worstPrivacy("safe", "safe")).toBe("safe");
  });
});
