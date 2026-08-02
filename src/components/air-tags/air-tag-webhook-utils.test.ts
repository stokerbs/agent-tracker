import { describe, it, expect } from "vitest";
import {
  WEBHOOK_TOKEN_LABEL_MAX,
  isWebhookTokenLabelValid,
  maskTokenPrefix,
  isTokenActive,
  sortWebhookTokens,
} from "./air-tag-webhook-utils";

describe("isWebhookTokenLabelValid", () => {
  it("accepts an empty label (label is optional)", () => {
    expect(isWebhookTokenLabelValid("")).toBe(true);
  });

  it("accepts a label at the max length", () => {
    expect(isWebhookTokenLabelValid("a".repeat(WEBHOOK_TOKEN_LABEL_MAX))).toBe(true);
  });

  it("rejects a label over the max length", () => {
    expect(isWebhookTokenLabelValid("a".repeat(WEBHOOK_TOKEN_LABEL_MAX + 1))).toBe(false);
  });

  it("trims surrounding whitespace before measuring length", () => {
    expect(isWebhookTokenLabelValid(`  ${"a".repeat(WEBHOOK_TOKEN_LABEL_MAX)}  `)).toBe(true);
  });
});

describe("maskTokenPrefix", () => {
  it("appends masking bullets after the display prefix", () => {
    expect(maskTokenPrefix("abcd1234")).toBe("abcd1234••••••");
  });

  it("does not throw or truncate for an unusually short prefix", () => {
    expect(maskTokenPrefix("ab")).toBe("ab••••••");
  });
});

describe("isTokenActive", () => {
  it("is true when revoked_at is null", () => {
    expect(isTokenActive({ revoked_at: null })).toBe(true);
  });

  it("is false when revoked_at is set", () => {
    expect(isTokenActive({ revoked_at: "2026-01-01T00:00:00.000Z" })).toBe(false);
  });
});

describe("sortWebhookTokens", () => {
  it("groups active tokens before revoked ones without reordering within a group", () => {
    const tokens = [
      { id: "1", revoked_at: "2026-01-01T00:00:00.000Z" },
      { id: "2", revoked_at: null },
      { id: "3", revoked_at: null },
      { id: "4", revoked_at: "2026-02-01T00:00:00.000Z" },
    ];
    expect(sortWebhookTokens(tokens).map((t) => t.id)).toEqual(["2", "3", "1", "4"]);
  });

  it("does not mutate the input array", () => {
    const tokens = [
      { id: "1", revoked_at: "2026-01-01T00:00:00.000Z" },
      { id: "2", revoked_at: null },
    ];
    const original = [...tokens];
    sortWebhookTokens(tokens);
    expect(tokens).toEqual(original);
  });

  it("is a no-op for an all-active or all-revoked list", () => {
    const allActive = [
      { id: "1", revoked_at: null },
      { id: "2", revoked_at: null },
    ];
    expect(sortWebhookTokens(allActive).map((t) => t.id)).toEqual(["1", "2"]);
  });
});
