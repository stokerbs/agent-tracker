/**
 * Auth/authorization/rate-limit/response-contract tests for the public,
 * unauthenticated-by-session AirTag webhook ping endpoint — the one write
 * path in the app with no Supabase session and no RLS in front of it, so
 * every rejection branch (missing header, unknown/revoked token, deleted
 * tracker) is exercised, plus the server-derived-not-client-derived
 * air_tag_id/entered_by/source contract and the never-log-the-plaintext-
 * token requirement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));

import { POST } from "./route";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

const TOKEN = "aVeryLongRandomBase64UrlEncodedTokenValueThatIsSecret_1234567890";
const TOKEN_HASH = createHash("sha256").update(TOKEN).digest("hex");
const TOKEN_ID = "44444444-4444-4444-4444-444444444444";
const AIR_TAG_ID = "11111111-1111-1111-1111-111111111111";
const CREATED_BY = "55555555-5555-5555-5555-555555555555";

type TokenLookup = {
  id: string;
  air_tag_id: string;
  created_by: string;
  revoked_at: string | null;
  air_tag_trackers: { deleted_at: string | null } | null;
};

function svc({
  tokenRow = null as TokenLookup | null,
  lookupError = null as unknown,
  insertError = null as unknown,
  touchError = null as unknown,
} = {}) {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  let updatedWith: unknown;
  const selectChain = {
    eq: () => selectChain,
    maybeSingle: async () => ({ data: tokenRow, error: lookupError }),
  };
  const updateChain = {
    eq: async () => ({ error: touchError }),
  };
  const client = {
    from: (table: string) => {
      if (table === "air_tag_webhook_tokens") {
        return {
          select: () => selectChain,
          update: (vals: unknown) => {
            updatedWith = vals;
            return updateChain;
          },
        };
      }
      // air_tag_positions
      return { insert };
    },
  };
  return {
    client,
    insert,
    get updatedWith() {
      return updatedWith;
    },
  };
}

function req(
  body: unknown,
  { authHeader = `Bearer ${TOKEN}`, ip = "9.9.9.9", badJson = false }: { authHeader?: string | null; ip?: string; badJson?: boolean } = {},
): NextRequest {
  const headers = new Map<string, string>();
  if (authHeader !== null) headers.set("authorization", authHeader);
  headers.set("x-forwarded-for", ip);
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => {
      if (badJson) throw new Error("bad json");
      return body;
    },
  } as unknown as NextRequest;
}

const validBody = { lat: 13.7, lng: 100.5, accuracyM: 5, note: "at the office" };

const activeTokenRow: TokenLookup = {
  id: TOKEN_ID,
  air_tag_id: AIR_TAG_ID,
  created_by: CREATED_BY,
  revoked_at: null,
  air_tag_trackers: { deleted_at: null },
};

beforeEach(() => {
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 100, retryAfterMs: 0 } as never);
  vi.mocked(createServiceClient).mockReturnValue(svc({ tokenRow: activeTokenRow }).client as never);
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/air-tags/webhook/ping — auth", () => {
  it("401 with no Authorization header", async () => {
    const res = await POST(req(validBody, { authHeader: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("401 with a malformed Authorization header (no Bearer prefix)", async () => {
    const res = await POST(req(validBody, { authHeader: TOKEN }));
    expect(res.status).toBe(401);
  });

  it("401 with an empty Bearer token", async () => {
    const res = await POST(req(validBody, { authHeader: "Bearer " }));
    expect(res.status).toBe(401);
  });

  it("401 with an unknown token — identical response to a revoked/deleted-tracker token", async () => {
    const s = svc({ tokenRow: null });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("401 with a revoked token — same status/body as unknown token", async () => {
    const s = svc({ tokenRow: { ...activeTokenRow, revoked_at: "2026-01-01T00:00:00.000Z" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("401 when the token's tracker has been soft-deleted — same status/body as unknown/revoked", async () => {
    const s = svc({
      tokenRow: { ...activeTokenRow, air_tag_trackers: { deleted_at: "2026-01-01T00:00:00.000Z" } },
    });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(s.insert).not.toHaveBeenCalled();
  });
});

describe("POST /api/air-tags/webhook/ping — rate limiting", () => {
  it("429 when the coarse per-IP bucket is exceeded (checked before the token lookup)", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (bucket) =>
      bucket === "air_tag_webhook_ip"
        ? { allowed: false, remaining: 0, retryAfterMs: 5000 }
        : { allowed: true, remaining: 10, retryAfterMs: 0 },
    );
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });

  it("429 when the per-token bucket is exceeded for an otherwise-valid token", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (bucket) =>
      bucket === "air_tag_webhook_ping"
        ? { allowed: false, remaining: 0, retryAfterMs: 2000 }
        : { allowed: true, remaining: 10, retryAfterMs: 0 },
    );
    const s = svc({ tokenRow: activeTokenRow });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(s.insert).not.toHaveBeenCalled();
  });
});

describe("POST /api/air-tags/webhook/ping — validation", () => {
  it("400 on malformed JSON", async () => {
    const res = await POST(req(null, { badJson: true }));
    expect(res.status).toBe(400);
  });

  it("400 on an out-of-bounds lat (reuses parsePosition)", async () => {
    const s = svc({ tokenRow: activeTokenRow });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ lat: 999, lng: 0 }));
    expect(res.status).toBe(400);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("400 on a future recordedAt (reuses parsePosition's future-timestamp rejection)", async () => {
    const s = svc({ tokenRow: activeTokenRow });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const res = await POST(req({ lat: 13.7, lng: 100.5, recordedAt: future }));
    expect(res.status).toBe(400);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it("defaults recordedAt to now when omitted", async () => {
    const s = svc({ tokenRow: activeTokenRow });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req({ lat: 13.7, lng: 100.5 }));
    expect(res.status).toBe(200);
    expect(s.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recorded_at: expect.any(String) }),
    );
  });
});

describe("POST /api/air-tags/webhook/ping — success + server-derived fields", () => {
  it("200 and inserts with air_tag_id/entered_by/source taken from the token, never the request body", async () => {
    const s = svc({ tokenRow: activeTokenRow });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);

    const res = await POST(
      req({
        ...validBody,
        // Attempted spoofing — must be ignored; server always derives these
        // from the token, never the request body.
        air_tag_id: "attacker-controlled-tag-id",
        airTagId: "attacker-controlled-tag-id",
        entered_by: "attacker-controlled-user-id",
        source: "manual",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(s.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        air_tag_id: AIR_TAG_ID,
        entered_by: CREATED_BY,
        source: "shortcuts_webhook",
        lat: 13.7,
        lng: 100.5,
        accuracy_m: 5,
        note: "at the office",
      }),
    );
  });

  it("bumps last_used_at on the token after a successful insert", async () => {
    const s = svc({ tokenRow: activeTokenRow });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    await POST(req(validBody));
    expect(s.updatedWith).toMatchObject({ last_used_at: expect.any(String) });
  });

  it("still returns 200 when the best-effort last_used_at update fails", async () => {
    const s = svc({ tokenRow: activeTokenRow, touchError: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("500 when the position insert fails", async () => {
    const s = svc({ tokenRow: activeTokenRow, insertError: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(500);
  });

  it("500 when the token lookup query itself errors", async () => {
    const s = svc({ tokenRow: null, lookupError: { message: "db down" } });
    vi.mocked(createServiceClient).mockReturnValue(s.client as never);
    const res = await POST(req(validBody));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/air-tags/webhook/ping — never logs the plaintext token", () => {
  it("does not include the raw bearer token in any console.log/warn/error call, across every branch", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Exercise several branches: missing header, unknown token, revoked
    // token, successful ping, and a failed insert.
    await POST(req(validBody, { authHeader: null }));

    const unknownSvc = svc({ tokenRow: null });
    vi.mocked(createServiceClient).mockReturnValue(unknownSvc.client as never);
    await POST(req(validBody));

    const revokedSvc = svc({ tokenRow: { ...activeTokenRow, revoked_at: "2026-01-01T00:00:00.000Z" } });
    vi.mocked(createServiceClient).mockReturnValue(revokedSvc.client as never);
    await POST(req(validBody));

    const okSvc = svc({ tokenRow: activeTokenRow });
    vi.mocked(createServiceClient).mockReturnValue(okSvc.client as never);
    await POST(req(validBody));

    const failSvc = svc({ tokenRow: activeTokenRow, insertError: { message: "boom" } });
    vi.mocked(createServiceClient).mockReturnValue(failSvc.client as never);
    await POST(req(validBody));

    const allLoggedArgs = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map((a) => (typeof a === "string" ? a : JSON.stringify(a)));
    for (const line of allLoggedArgs) {
      expect(line).not.toContain(TOKEN);
      expect(line).not.toContain(TOKEN_HASH); // hash isn't secret, but keep logs to id/prefix only regardless
    }

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
