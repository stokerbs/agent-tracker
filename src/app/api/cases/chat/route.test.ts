import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// isStaff is the real pure check; getCurrentProfile is stubbed.
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: vi.fn(),
  isStaff: (r: string) => r === "admin" || r === "supervisor",
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// Decryption is server-only; stub it to a passthrough so the route imports cleanly.
vi.mock("@/lib/security/encryption", () => ({ decryptField: (v: string) => `dec:${v}` }));

import { POST } from "./route";
import { getCurrentProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const UUID = "11111111-1111-1111-1111-111111111111";
const okBody = { caseId: UUID, messages: [{ role: "user", content: "สรุปคดี" }] };

// Supabase stub. `dataFor` returns the rows per table for chains that resolve
// directly (await) or via maybeSingle/limit. `signed` is the signed URL returned
// by storage.createSignedUrls (null = none).
function supa(opts: {
  caseRow: unknown;
  photos?: unknown[];
  evidence?: unknown[];
  signed?: string | null;
}) {
  const dataFor = (table: string): unknown[] => {
    if (table === "target_photos") return opts.photos ?? [];
    if (table === "evidence") return opts.evidence ?? [];
    return []; // timeline_entries, target_locations/vehicles/relationships, vehicle_photos
  };
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b, eq: () => b, order: () => b, like: () => b,
      limit: async () => ({ data: dataFor(table) }),
      maybeSingle: async () => ({ data: table === "cases" ? opts.caseRow : null }),
      then: (res: (v: unknown) => unknown) => res({ data: dataFor(table) }),
    });
    return b;
  };
  const storage = {
    from: () => ({
      createSignedUrls: async (paths: string[]) => ({ data: paths.map(() => ({ signedUrl: opts.signed ?? null })) }),
    }),
  };
  return { from, storage };
}

const call = (body: unknown) =>
  POST({ json: async () => body } as unknown as Parameters<typeof POST>[0]);

const caseRow = { case_number: "C-1", case_type: "x", status: "active", client_name: "ACME" };

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "admin" } as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 39, retryAfterMs: 0 } as never);
  vi.mocked(createClient).mockResolvedValue(supa({ caseRow }) as never);
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text: "คำตอบ" }] }) }) as Response));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("POST /api/cases/chat — auth & branch ladder", () => {
  it("401 when not authenticated", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(null as never);
    expect((await call(okBody)).status).toBe(401);
  });

  it("403 for non-staff (agent)", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue({ id: "u1", role: "agent" } as never);
    expect((await call(okBody)).status).toBe(403);
  });

  it("429 when rate-limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfterMs: 1000 } as never);
    expect((await call(okBody)).status).toBe(429);
  });

  it("400 on invalid payload", async () => {
    expect((await call({ caseId: "not-a-uuid", messages: [] })).status).toBe(400);
  });

  it("404 when the case is not visible (RLS)", async () => {
    vi.mocked(createClient).mockResolvedValue(supa({ caseRow: null }) as never);
    expect((await call(okBody)).status).toBe(404);
  });

  it("returns a friendly reply (200) when no API key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await call(okBody);
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toContain("ยังไม่ได้ตั้งค่า");
  });

  it("200 with the model reply and no images by default", async () => {
    const res = await call(okBody);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe("คำตอบ");
    expect(json.images).toBe(0);
  });

  it("502 when the AI request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as Response));
    expect((await call(okBody)).status).toBe(502);
  });
});

describe("POST /api/cases/chat — evidence vision", () => {
  it("attaches the case's images as base64 vision blocks", async () => {
    vi.mocked(createClient).mockResolvedValue(
      supa({ caseRow, photos: [{ storage_path: "target/p.jpg" }], signed: "https://signed/p.jpg" }) as never,
    );
    // Anthropic call returns text; image fetches return bytes.
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes("anthropic.com")) {
        return { ok: true, json: async () => ({ content: [{ text: "เห็นรถสีขาว" }] }) } as Response;
      }
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await call(okBody);
    const json = await res.json();
    expect(json.images).toBe(1);
    expect(json.reply).toBe("เห็นรถสีขาว");

    // The Anthropic request carried an image content block.
    const anthropicCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("anthropic.com"));
    const sentBody = JSON.parse((anthropicCall?.[1] as { body: string }).body);
    const firstUser = sentBody.messages[0];
    expect(Array.isArray(firstUser.content)).toBe(true);
    expect(firstUser.content[0]).toMatchObject({ type: "image", source: { type: "base64" } });
  });

  it("sends no image blocks when images can't be signed", async () => {
    vi.mocked(createClient).mockResolvedValue(
      supa({ caseRow, photos: [{ storage_path: "target/p.jpg" }], signed: null }) as never,
    );
    const res = await call(okBody);
    expect((await res.json()).images).toBe(0);
  });
});
