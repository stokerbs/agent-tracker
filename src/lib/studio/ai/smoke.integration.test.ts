/**
 * Live smoke test for the Studio AI path (real Anthropic + real Supabase).
 * Skipped unless RUN_AI_SMOKE=1 — it costs money and needs .env.local:
 *   set -a; source .env.local; set +a; RUN_AI_SMOKE=1 npx vitest run src/lib/studio/ai/smoke
 */
import { describe, expect, it } from "vitest";

const enabled = process.env.RUN_AI_SMOKE === "1" && !!process.env.ANTHROPIC_API_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!enabled)("studio AI smoke (live)", () => {
  it("generateHooks returns structured hooks and logs a generation row", async () => {
    const { generateHooks } = await import("./actions/script");
    const res = await generateHooks({
      title: "GPS บอกอะไรได้ และบอกอะไรไม่ได้",
      pillar: "detective_knowledge",
      description: "ข้อจำกัดของ GPS ติดตามยานพาหนะ",
      userId: null,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(res, null, 2));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.hooks.length).toBeGreaterThan(0);
      expect(res.generationId).toBeTruthy();
    }
  }, 120_000);
});
