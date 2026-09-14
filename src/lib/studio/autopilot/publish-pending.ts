import "server-only";

import * as Sentry from "@sentry/nextjs";
import { logAudit } from "@/lib/audit";
import { pushLineNotify } from "@/lib/line/notify";
import { publishMaster } from "@/lib/studio/publish/publish";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Publishing sweep for autopilot runs that produced a finished piece but ran out of function time before posting
 * (docs §16). The producing run stops at `timeout_before_publish` on purpose — it will not start a public post it
 * may not live long enough to record — so this cron picks the piece up a few minutes later and posts it through
 * the same `publishMaster` path, with the same privacy scan, duplicate guard and audit trail.
 *
 * Deliberately narrow: only runs that stopped at `timeout_before_publish`, only while `auto_publish` is on, only a master that
 * already has a ready video and no social post yet, and only within a day of the run.
 */

/** Same base the autopilot itself puts in its LINE notifications. */
const APP_URL = "https://detectivepulse.app";

export const PENDING_WINDOW_MS = 24 * 60 * 60_000;
const DEFAULT_LIMIT = 3;

export interface PublishSweep {
  checked: number;
  published: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function publishPendingAutopilotRuns(opts: { now?: number; limit?: number } = {}): Promise<PublishSweep> {
  const now = opts.now ?? Date.now();
  const res: PublishSweep = { checked: 0, published: 0, skipped: 0, failed: 0, errors: [] };
  const svc = createServiceClient();

  let settings;
  try {
    settings = await getStudioSettingsStrict();
  } catch (e) {
    res.errors.push(`settings: ${e instanceof Error ? e.message : String(e)}`);
    return res;
  }
  const cfg = settings.autopilot;
  // The owner may have turned posting off since the run; never post behind that switch.
  if (!cfg.enabled || !cfg.auto_publish) return res;

  const { data: runs, error } = await svc
    .from("studio_autopilot_runs")
    .select("id, master_id, stats, started_at, created_by")
    .eq("stopped_at", "timeout_before_publish")
    .eq("published", false)
    .not("master_id", "is", null)
    .gte("started_at", new Date(now - PENDING_WINDOW_MS).toISOString())
    .order("started_at", { ascending: false })
    .limit(opts.limit ?? DEFAULT_LIMIT);
  if (error) {
    res.errors.push(`load: ${error.message}`);
    return res;
  }

  for (const run of runs ?? []) {
    res.checked += 1;
    const masterId = run.master_id as string;
    try {
      const { data: master } = await svc.from("studio_content_masters").select("id, title, caption, cta, hook, status, scheduled_at").eq("id", masterId).maybeSingle();
      // Only a piece the run itself approved: anything the owner archived, reopened or already published is left alone.
      if (!master || (master.status !== "approved" && master.status !== "scheduled")) {
        res.skipped += 1;
        continue;
      }
      // The owner may have picked a time in the meantime; posting now would override their choice.
      if (master.scheduled_at && Date.parse(master.scheduled_at) > now) {
        res.skipped += 1;
        continue;
      }
      const { data: posted } = await svc.from("studio_social_posts").select("id").eq("master_id", masterId).in("status", ["queued", "scheduled", "published"]).limit(1);
      if (posted?.length) {
        await markDone(svc, run.id, run.stats, posted.length);
        res.skipped += 1;
        continue;
      }
      // Claim the run before going public: a second sweep (or a retried cron fire) must not post the piece twice.
      const { data: claimed } = await svc
        .from("studio_autopilot_runs")
        .update({ step: "กำลังโพสต์รอบตาม", stopped_at: "publishing" })
        .eq("id", run.id)
        .eq("stopped_at", "timeout_before_publish")
        .eq("published", false)
        .select("id")
        .maybeSingle();
      if (!claimed) {
        res.skipped += 1;
        continue;
      }

      const { data: video } = await svc
        .from("studio_creative_assets")
        .select("id")
        .eq("master_id", masterId)
        .eq("kind", "video")
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!video) {
        // Hand the claim back so a later sweep can try again once the render lands.
        await svc.from("studio_autopilot_runs").update({ stopped_at: "timeout_before_publish", step: "รอวิดีโอ" }).eq("id", run.id).eq("stopped_at", "publishing");
        res.skipped += 1;
        continue;
      }

      const published = await publishMaster({
        master: { id: master.id, title: master.title, caption: master.caption, cta: master.cta, hook: master.hook, scheduled_at: null },
        variants: [],
        platforms: cfg.platforms,
        assetIds: [video.id],
        scheduleAt: null,
        userId: run.created_by ?? null,
      });
      if (!published.ok) {
        res.failed += 1;
        res.errors.push(`${run.id}: ${published.code}: ${published.error}`);
        await svc.from("studio_autopilot_runs").update({ stopped_at: "publish_failed", error: `${published.code}: ${published.error}`.slice(0, 900) }).eq("id", run.id);
        await notify(`❌ โพสต์คอนเทนต์ที่ค้างจาก Autopilot ไม่สำเร็จ\n"${master.title}"\n${published.error}\n${APP_URL}/studio/content/${masterId}`);
        continue;
      }

      await logAudit({
        actorId: run.created_by ?? null,
        action: "STUDIO_SOCIAL_POST",
        entity: "studio_content_masters",
        entityId: masterId,
        metadata: { autopilot: true, run_id: run.id, recovered: "timeout_before_publish", platforms: cfg.platforms, provider_post_id: published.providerPostId },
      });
      await markDone(svc, run.id, run.stats, published.posts.length);
      const urls = published.posts.map((p) => p.post_url).filter((u): u is string => !!u);
      console.info(`[studio:autopilot-publish] run=${run.id} master=${masterId} posts=${published.posts.length}`);
      await notify(`🤖 โพสต์คอนเทนต์ที่ค้างจาก Autopilot แล้ว\n"${master.title}"\nแพลตฟอร์ม: ${cfg.platforms.join(", ")}\n${urls.slice(0, 3).join("\n") || `${APP_URL}/studio/content/${masterId}`}`);
      res.published += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Do not leave the run stuck in "publishing": record the failure so the owner sees it and the sweep moves on.
      await svc.from("studio_autopilot_runs").update({ stopped_at: "publish_failed", error: message.slice(0, 900) }).eq("id", run.id).eq("stopped_at", "publishing");
      res.failed += 1;
      res.errors.push(`${run.id}: ${message.slice(0, 200)}`);
      console.error(`[studio:autopilot-publish] run=${run.id} threw:`, message);
      Sentry.captureException(err, { tags: { module: "studio-autopilot-publish" } });
    }
  }
  return res;
}

async function markDone(svc: ReturnType<typeof createServiceClient>, runId: string, stats: unknown, posts: number): Promise<void> {
  await svc
    .from("studio_autopilot_runs")
    .update({ status: "done", published: true, step: "เสร็จแล้ว (โพสต์รอบตาม)", progress: 100, finished_at: new Date().toISOString(), stats: { ...((stats as object) ?? {}), posts, recovered: true } as never })
    .eq("id", runId)
    .eq("published", false);
}

async function notify(text: string): Promise<void> {
  try {
    await pushLineNotify(text);
  } catch (e) {
    console.error("[studio:autopilot-publish] LINE notify failed:", e instanceof Error ? e.message : e);
  }
}
