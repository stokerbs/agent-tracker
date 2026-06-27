/**
 * App-lock PIN action tests: PIN validation, verify success/failure, no-PIN, and
 * the rate-limit lockout that forces an OTP fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPin } from "@/lib/security/pin";

const h = vi.hoisted(() => ({
  profile: { id: "u1" } as { id: string } | null,
  rl: { allowed: true, remaining: 5, retryAfterMs: 0 },
  pinRow: { data: null as { pin_hash: string } | null, error: null as unknown },
  upsertResult: { error: null as unknown },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: vi.fn(async () => h.profile) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(() => h.rl) }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "delete", "eq"]) b[m] = () => b;
      b.upsert = () => ({ then: (r: (v: unknown) => unknown) => r(h.upsertResult) });
      b.maybeSingle = () => b;
      (b as { then: unknown }).then = (r: (v: unknown) => unknown) => r(h.pinRow);
      return b;
    },
  }),
}));

async function load() {
  return import("@/app/(dashboard)/settings/security-actions");
}

beforeEach(() => {
  h.profile = { id: "u1" };
  h.rl = { allowed: true, remaining: 5, retryAfterMs: 0 };
  h.pinRow = { data: null, error: null };
  h.upsertResult = { error: null };
});

describe("setPin", () => {
  it("rejects a non-4-6-digit PIN", async () => {
    const { setPin } = await load();
    expect(await setPin("12")).toHaveProperty("error");
    expect(await setPin("abcd")).toHaveProperty("error");
  });
  it("saves a valid PIN", async () => {
    const { setPin } = await load();
    expect(await setPin("1234")).toEqual({ ok: true });
  });
});

describe("verifyPin", () => {
  it("errors when no PIN is set", async () => {
    h.pinRow = { data: null, error: null };
    const { verifyPin } = await load();
    expect(await verifyPin("1234")).toHaveProperty("error");
  });
  it("accepts the correct PIN", async () => {
    h.pinRow = { data: { pin_hash: hashPin("1234") }, error: null };
    const { verifyPin } = await load();
    expect(await verifyPin("1234")).toEqual({ ok: true });
  });
  it("rejects an incorrect PIN", async () => {
    h.pinRow = { data: { pin_hash: hashPin("1234") }, error: null };
    const { verifyPin } = await load();
    const res = await verifyPin("9999");
    expect(res).toHaveProperty("error");
    expect((res as { locked?: boolean }).locked).toBeUndefined();
  });
  it("locks (fall back to OTP) when rate-limited", async () => {
    h.rl = { allowed: false, remaining: 0, retryAfterMs: 1000 };
    const { verifyPin } = await load();
    const res = await verifyPin("1234");
    expect(res).toMatchObject({ locked: true });
  });
});
