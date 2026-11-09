import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { GET } from "./route";

function req(auth?: string): NextRequest {
  return {
    headers: { get: (name: string) => name.toLowerCase() === "authorization" ? auth ?? null : null },
  } as unknown as NextRequest;
}

beforeEach(() => { vi.stubEnv("CRON_SECRET", "test-cron-secret"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("retired GET /api/cron/publish-article", () => {
  it.each([undefined, "", "Bearer wrong"])("rejects an unauthorized request (%s)", async (auth) => {
    const res = await GET(req(auth));
    expect(res.status).toBe(401);
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(req("Bearer "));
    expect(res.status).toBe(401);
  });

  it("returns a migration notice without making a provider or database request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected network call"));
    const res = await GET(req("Bearer test-cron-secret"));
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ ok: false, error: "article_generation_moved" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not schedule the retired paid-provider endpoint", () => {
    const config = JSON.parse(readFileSync(new URL("../../../../../vercel.json", import.meta.url), "utf8")) as {
      crons: Array<{ path: string }>;
    };
    expect(config.crons.map((cron) => cron.path)).not.toContain("/api/cron/publish-article");
  });
});
