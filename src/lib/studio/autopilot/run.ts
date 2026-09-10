import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { pushLineNotify } from "@/lib/line/notify";
import { generateCreativePlan, generateIdeas, generateScript, runPrivacyCheck } from "@/lib/studio/ai";
import { generateImageAsset } from "@/lib/studio/media/generate";
import { publishMaster } from "@/lib/studio/publish/publish";
import { getStudioSettingsStrict } from "@/lib/studio/settings";
import { runRenderJob } from "@/lib/studio/video/render";
import type { AutopilotSettings, CreativePlan, Pillar, Platform, SocialPlatform } from "@/lib/studio/types";
import { buildBrief, choosePillar, shouldRun, STOP_REASON_TH, type SkipReason } from "./plan";

/**
 * Autopilot (phase 4): one cron run produces one finished post — idea →
 * script → creative plan → images → template video → privacy check →
 * approve → publish. Runs with the service client (no user session); every
 * gate that protects a human-approved publish is re-run here, and a `blocked`
 * privacy result always stops the run before anything goes public.
 */

const APP_URL = "https://detectivepulse.app";
/** Vercel gives the cron route 300 s; keep headroom so a long run still records its state. */
const RUN_BUDGET_MS = 265_000;
/** More shots = more TTS calls and a longer encode. A live run with 6 shots took 207 s end to end. */
const MAX_AUTOPILOT_SHOTS = 8;
const PLATFORM_FOR_VARIANT: Record<SocialPlatform, Platform> = {
  facebook: "facebook",
  instagram: "instagram_reel",
  tiktok: "tiktok",
  youtube: "youtube_short",
  line_oa: "line_oa",
};

export interface AutopilotResult {
  ok: boolean;
  runId: string | null;
  status: "done" | "review" | "failed" | "skipped";
  masterId?: string | null;
  stopReason?: string | null;
  error?: string;
  posts?: number;
}

type Svc = ReturnType<typeof createServiceClient>;

/** The cron has no session: every uuid column and every per-user quota needs a real admin profile. */
async function resolveActor(svc: Svc, given: string | null): Promise<string | null> {
  if (given) return given;
  const { data, error } = await svc.from("profiles").select("id").eq("role", "admin").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) console.error("[studio:autopilot] admin lookup failed:", error.message);
  return data?.id ?? null;
}

export async function runAutopilot(opts: { userId: string | null; trigger?: "cron" | "manual"; now?: Date } = { userId: null }): Promise<AutopilotResult> {
  const svc = createServiceClient();
  const now = opts.now ?? new Date();
  let cfg: AutopilotSettings;
  let pillars;
  let approval;
  try {
    const settings = await getStudioSettingsStrict();
    cfg = settings.autopilot;
    pillars = settings.pillars;
    approval = settings.approval_rules;
  } catch (e) {
    console.error("[studio:autopilot] settings unavailable:", e instanceof Error ? e.message : e);
    return { ok: false, runId: null, status: "failed", error: "โหลดการตั้งค่าสตูดิโอไม่สำเร็จ" };
  }

  // Reap a run the platform killed mid-flight, otherwise the one-running-row index blocks every future run.
  await svc
    .from("studio_autopilot_runs")
    .update({ status: "failed", error: "งานหยุดกลางทาง (เกินเวลาที่เซิร์ฟเวอร์อนุญาต)", step: "ล้มเหลว", progress: 100, finished_at: new Date().toISOString() })
    .eq("status", "running")
    .lt("started_at", new Date(now.getTime() - 10 * 60_000).toISOString());

  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
  const { count: runsThisWeek } = await svc.from("studio_autopilot_runs").select("id", { count: "exact", head: true }).gte("created_at", weekAgo).in("status", ["done", "review", "running", "failed"]);
  const verdict = shouldRun(cfg, { now, runsThisWeek: runsThisWeek ?? 0 });
  if (!verdict.run) {
    console.info(`[studio:autopilot] skipped: ${verdict.reason}`);
    return { ok: true, runId: null, status: "skipped", stopReason: verdict.reason };
  }

  const actor = await resolveActor(svc, opts.userId);
  if (!actor) {
    console.error("[studio:autopilot] no admin profile to act as — refusing to run");
    return { ok: false, runId: null, status: "failed", error: "ไม่พบบัญชีแอดมินสำหรับรันอัตโนมัติ" };
  }

  const { data: run, error: rErr } = await svc
    .from("studio_autopilot_runs")
    .insert({ status: "running", step: "กำลังเลือกหัวข้อ", progress: 2, trigger: opts.trigger ?? "cron", platforms: cfg.platforms, created_by: actor })
    .select("id")
    .single();
  if (rErr || !run) {
    if (rErr?.code === "23505") return { ok: true, runId: null, status: "skipped", stopReason: "already_running" };
    console.error("[studio:autopilot] run insert failed:", rErr?.message);
    return { ok: false, runId: null, status: "failed", error: "สร้างงานอัตโนมัติไม่สำเร็จ" };
  }
  const runId = run.id;
  const step = async (progress: number, label: string) => {
    await svc.from("studio_autopilot_runs").update({ progress, step: label }).eq("id", runId);
  };
  const finish = async (patch: Record<string, unknown>): Promise<void> => {
    await svc.from("studio_autopilot_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
  };
  const stop = async (reason: string, masterId: string | null, status: "review" | "failed" = "review", detail?: string): Promise<AutopilotResult> => {
    const th = STOP_REASON_TH[reason] ?? reason;
    console.warn(`[studio:autopilot] run=${runId} stopped: ${reason}${detail ? ` (${detail})` : ""}`);
    await finish({ status, stopped_at: reason, error: detail?.slice(0, 900) ?? null, master_id: masterId, step: th, progress: 100 });
    await notify(`⏸️ Autopilot หยุดไว้: ${th}${masterId ? `\nตรวจและแก้ต่อได้ที่ ${APP_URL}/studio/content/${masterId}` : ""}`);
    return { ok: false, runId, status, masterId, stopReason: reason, error: detail };
  };

  let masterId: string | null = null;
  const deadline = Date.now() + RUN_BUDGET_MS;
  try {
    // ── 1. topic ────────────────────────────────────────────────────────────
    const publishedByPillar = await countPublishedByPillar(svc);
    const pillar = choosePillar(cfg, pillars, publishedByPillar);
    await svc.from("studio_autopilot_runs").update({ pillar }).eq("id", runId);
    const idea = await pickIdea(svc, pillar, actor);
    if (!idea) return await stop("no_idea", null, "failed");

    // ── 2. master + script ──────────────────────────────────────────────────
    await step(15, "กำลังเขียนสคริปต์");
    const primary: Platform = PLATFORM_FOR_VARIANT[cfg.platforms[0]] ?? "tiktok";
    const { data: master, error: mErr } = await svc
      .from("studio_content_masters")
      .insert({
        title: idea.title,
        pillar,
        primary_platform: primary,
        target_duration_sec: cfg.target_seconds,
        idea_id: idea.id,
        hook: idea.hook,
        status: "draft",
        tags: ["autopilot"],
        created_by: actor,
      })
      .select("id, title")
      .single();
    if (mErr || !master) throw new Error(`master insert: ${mErr?.message ?? "no row"}`);
    const mid: string = master.id;
    masterId = mid;
    await svc.from("studio_autopilot_runs").update({ master_id: masterId, idea_id: idea.id }).eq("id", runId);
    if (idea.persisted) await svc.from("studio_ideas").update({ status: "generated" }).eq("id", idea.id);

    const script = await generateScript({
      title: idea.title,
      hook: idea.hook,
      description: idea.description,
      pillar,
      platform: primary,
      targetSeconds: cfg.target_seconds,
      searchHint: idea.tags.join(" "),
      userId: actor,
    });
    if (!script.ok) return await stop("script_failed", masterId, "failed", script.error);
    await svc
      .from("studio_content_masters")
      .update({ hook: script.data.hook, script: script.data.script, caption: script.data.caption, cta: script.data.cta, ai_notes: script.data.ai_notes, estimated_duration_sec: script.data.estimated_duration_sec })
      .eq("id", masterId);
    await storeSourcesAndClaims(svc, mid, script.data);
    const unsupported = script.data.claims.filter((c) => c.support_status === "unsupported").length;
    if (unsupported > 0 && !cfg.allow_unsupported_claims) return await stop("unsupported_claims", masterId, "review", `${unsupported} claim`);

    // ── 3. creative plan ────────────────────────────────────────────────────
    await step(30, "กำลังวางแผนภาพ");
    const plan = await generateCreativePlan({ title: master.title, pillar, platform: primary, script: script.data.script, targetSeconds: cfg.target_seconds, userId: actor });
    if (!plan.ok) return await stop("plan_failed", masterId, "failed", plan.error);
    // Trim to the time budget: every extra shot costs a TTS call and encode time.
    const trimmed: CreativePlan = { ...plan.data, shots: plan.data.shots.slice(0, MAX_AUTOPILOT_SHOTS) };
    if (plan.data.shots.length > trimmed.shots.length) console.info(`[studio:autopilot] run=${runId} trimmed plan ${plan.data.shots.length} → ${trimmed.shots.length} shots`);
    await svc.from("studio_content_masters").update({ creative_plan: trimmed as never }).eq("id", masterId);

    // ── 4. images ───────────────────────────────────────────────────────────
    await step(40, "กำลังสร้างภาพ");
    const ctx = { id: mid, title: master.title, creative_plan: trimmed };
    const cover = await generateImageAsset({ master: ctx, target: { kind: "thumbnail" }, aspect: "9:16", userId: actor });
    if (!cover.ok) return await stop("image_failed", masterId, "failed", `${cover.code}: ${cover.error}`);
    let images = 1;
    for (let i = 0; i < Math.min(trimmed.shots.length, cfg.images_per_run - 1); i++) {
      // Scene images are optional polish — drop them rather than run out of function time before the video.
      if (Date.now() > deadline - 150_000) {
        console.warn(`[studio:autopilot] run=${runId} skipping remaining scene images to protect the time budget`);
        break;
      }
      const shot = await generateImageAsset({ master: ctx, target: { kind: "scene", index: i }, aspect: "9:16", userId: actor });
      if (shot.ok) images += 1;
      else console.warn(`[studio:autopilot] run=${runId} scene image ${i} skipped: ${shot.code}`);
    }

    // ── 5. video ────────────────────────────────────────────────────────────
    if (Date.now() > deadline - 110_000) return await stop("timeout", masterId, "review", "หมดเวลาก่อนเริ่มตัดต่อ");
    await step(55, "กำลังสร้างวิดีโอ");
    const { data: job, error: jErr } = await svc
      .from("studio_render_jobs")
      .insert({ master_id: masterId, status: "queued", step: "รอเริ่ม", params: { aspect: "9:16", shots: trimmed.shots.length, source: "autopilot" } as never, created_by: actor })
      .select("id")
      .single();
    if (jErr || !job) throw new Error(`render job: ${jErr?.message ?? "no row"}`);
    const render = await runRenderJob(job.id, { userId: actor });
    if (!render.ok) return await stop("video_failed", masterId, "failed", render.error);

    // ── 6. privacy (deterministic + AI: no human will read this before it goes out) ──
    await step(75, "กำลังตรวจความเป็นส่วนตัว");
    const privacy = await storePrivacyCheck(svc, mid, actor);
    if (!privacy.stored) return await stop("privacy_not_stored", masterId, "failed");
    // The regex scan alone cannot see names, places or case-identifying detail, and no human reads this —
    // a degraded (AI-unavailable) verdict must never publish.
    if (privacy.checkedBy !== "ai") return await stop("privacy_ai_unavailable", masterId, "review", privacy.aiError?.slice(0, 200));
    if (privacy.status !== "safe") {
      const allowed = privacy.status === "review_required" && cfg.publish_on_review_required && approval.allow_override;
      if (!allowed) return await stop(privacy.status === "blocked" ? "privacy_blocked" : "privacy_review", masterId, "review", `findings=${privacy.findings}`);
    }

    // ── 7. approve ──────────────────────────────────────────────────────────
    const overrode = privacy.status === "review_required";
    const { error: revErr } = await svc.from("studio_content_reviews").insert({
      master_id: masterId,
      reviewer_id: actor,
      decision: overrode ? "override_privacy" : "approve",
      note: overrode ? "Autopilot: อนุมัติทั้งที่ Privacy Check ขอให้ตรวจ (เจ้าของเปิดสวิตช์ไว้)" : "อนุมัติอัตโนมัติโดย Autopilot (ผ่าน Privacy Check)",
    });
    if (revErr) return await stop("review_not_stored", masterId, "failed", revErr.message);
    await svc.from("studio_content_masters").update({ status: "approved", approved_by: actor, approved_at: new Date().toISOString() }).eq("id", masterId);
    await logAudit({ actorId: actor, action: "STUDIO_CONTENT_APPROVE", entity: "studio_content_masters", entityId: masterId, metadata: { autopilot: true, run_id: runId, privacy: privacy.status } });

    if (!cfg.auto_publish) {
      await finish({ status: "review", stopped_at: "manual_review", step: "รอตรวจก่อนโพสต์", progress: 100, stats: { images, shots: trimmed.shots.length, video_sec: render.durationSec ?? null } as never });
      await notify(`✅ Autopilot ผลิตคอนเทนต์ใหม่แล้ว (รอคุณกดโพสต์)\n"${master.title}"\n${APP_URL}/studio/content/${masterId}`);
      return { ok: true, runId, status: "review", masterId, stopReason: "manual_review" };
    }

    // ── 8. publish ──────────────────────────────────────────────────────────
    // Never start a public post we might not live long enough to record.
    if (Date.now() > deadline - 45_000) return await stop("timeout", masterId, "review", "หมดเวลาก่อนโพสต์");
    await step(88, "กำลังโพสต์");
    const published = await publishMaster({
      master: { id: mid, title: master.title, caption: script.data.caption, cta: script.data.cta, hook: script.data.hook, scheduled_at: null },
      variants: [],
      platforms: cfg.platforms,
      assetIds: render.assetId ? [render.assetId] : [],
      scheduleAt: null,
      userId: actor,
    });
    if (!published.ok) return await stop("publish_failed", masterId, "review", `${published.code}: ${published.error}`);
    await logAudit({ actorId: actor, action: "STUDIO_SOCIAL_POST", entity: "studio_content_masters", entityId: masterId, metadata: { autopilot: true, run_id: runId, platforms: cfg.platforms, provider_post_id: published.providerPostId } });

    const urls = published.posts.map((p) => p.post_url).filter((u): u is string => !!u);
    await finish({ status: "done", published: true, step: "เสร็จแล้ว", progress: 100, stats: { images, shots: trimmed.shots.length, video_sec: render.durationSec ?? null, posts: published.posts.length } as never });
    console.info(`[studio:autopilot] run=${runId} done master=${masterId} platforms=${cfg.platforms.join(",")} images=${images}`);
    await notify(
      `🤖 Autopilot โพสต์คอนเทนต์ใหม่แล้ว\n"${master.title}"\nแพลตฟอร์ม: ${cfg.platforms.join(", ")}\n${urls.slice(0, 3).join("\n") || `${APP_URL}/studio/content/${masterId}`}`,
    );
    return { ok: true, runId, status: "done", masterId, posts: published.posts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[studio:autopilot] run=${runId} threw:`, message);
    Sentry.captureException(err, { tags: { module: "studio-autopilot" } });
    await finish({ status: "failed", error: message.slice(0, 900), master_id: masterId, step: "ล้มเหลว", progress: 100 });
    await notify(`❌ Autopilot ล้มเหลว: ${message.slice(0, 200)}${masterId ? `\n${APP_URL}/studio/content/${masterId}` : ""}`);
    return { ok: false, runId, status: "failed", masterId, error: message };
  }
}

// ─── internals ───────────────────────────────────────────────────────────────

async function notify(text: string): Promise<void> {
  try {
    await pushLineNotify(text);
  } catch (e) {
    console.error("[studio:autopilot] LINE notify failed:", e instanceof Error ? e.message : e);
  }
}

async function countPublishedByPillar(svc: Svc): Promise<Record<string, number>> {
  const { data } = await svc.from("studio_content_masters").select("pillar").eq("status", "published").limit(500);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.pillar] = (out[r.pillar] ?? 0) + 1;
  return out;
}

interface PickedIdea {
  id: string | null;
  title: string;
  hook: string | null;
  description: string | null;
  tags: string[];
  persisted: boolean;
}

/** Oldest saved idea for the pillar, else generate a fresh batch from real customer questions. */
async function pickIdea(svc: Svc, pillar: Pillar, userId: string | null): Promise<PickedIdea | null> {
  const { data: saved } = await svc
    .from("studio_ideas")
    .select("id, title, hook, description, tags")
    .eq("status", "saved")
    .eq("pillar", pillar)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (saved) return { id: saved.id, title: saved.title, hook: saved.hook, description: saved.description, tags: saved.tags ?? [], persisted: true };

  // Only owner-approved questions may steer generation (0109 invariant): these rows are customer-authored.
  const { data: questions } = await svc
    .from("studio_customer_questions")
    .select("question, frequency")
    .is("superseded_by", null)
    .eq("approved_for_content", true)
    .order("frequency", { ascending: false })
    .limit(20);
  const res = await generateIdeas({ brief: buildBrief(pillar, questions ?? []), count: 3, pillar, userId });
  if (!res.ok || !res.data.ideas.length) {
    console.error("[studio:autopilot] idea generation failed:", res.ok ? "empty" : res.error);
    return null;
  }
  const rows = res.data.ideas.map((i) => ({
    title: i.title,
    hook: i.hook ?? null,
    description: i.description ?? null,
    pillar,
    platforms: i.platforms ?? [],
    format: i.format ?? null,
    origin: "ai",
    ai_scores: (i.ai_scores ?? null) as never,
    source_refs: (i.source_refs ?? []) as never,
    status: "saved",
    tags: i.tags ?? [],
    generation_id: res.generationId,
    created_by: userId,
  }));
  const { data: inserted, error } = await svc.from("studio_ideas").insert(rows).select("id, title, hook, description, tags");
  if (error || !inserted?.length) {
    console.error("[studio:autopilot] idea insert failed:", error?.message);
    const first = res.data.ideas[0];
    return { id: null, title: first.title, hook: first.hook ?? null, description: first.description ?? null, tags: first.tags ?? [], persisted: false };
  }
  const first = inserted[0];
  return { id: first.id, title: first.title, hook: first.hook, description: first.description, tags: first.tags ?? [], persisted: true };
}

async function storeSourcesAndClaims(svc: Svc, masterId: string, script: { source_refs: { kind: string; id: string | null; label: string }[]; claims: { claim: string; support_status: string; source: { kind: string; id: string | null; label: string } | null }[] }): Promise<void> {
  if (script.source_refs.length) {
    await svc.from("studio_content_sources").insert(
      script.source_refs.slice(0, 12).map((s) => ({ master_id: masterId, source_kind: s.kind, source_id: s.id, label: s.label.slice(0, 300) })),
    );
  }
  if (script.claims.length) {
    await svc.from("studio_content_claims").insert(
      script.claims.slice(0, 20).map((c) => ({ master_id: masterId, claim: c.claim.slice(0, 1000), support_status: c.support_status, source_label: c.source?.label?.slice(0, 300) ?? null, source_id: c.source?.id ?? null })),
    );
  }
}

async function storePrivacyCheck(svc: Svc, masterId: string, userId: string | null): Promise<{ status: string; checkedBy: string; findings: number; stored: boolean; aiError?: string }> {
  const { data: master } = await svc.from("studio_content_masters").select("title, hook, script, caption, cta").eq("id", masterId).maybeSingle();
  const result = await runPrivacyCheck({
    fields: { title: master?.title ?? "", hook: master?.hook, script: master?.script, caption: master?.caption, cta: master?.cta },
    useAi: true,
    userId,
    masterId,
  });
  const { error } = await svc.from("studio_privacy_checks").insert({ master_id: masterId, status: result.status, findings: result.findings as never, checked_by: result.checked_by, model: result.model, created_by: userId });
  if (error) console.error("[studio:autopilot] privacy insert failed:", error.message);
  console.info(`[studio:autopilot] privacy master=${masterId} status=${result.status} by=${result.checked_by} findings=${result.findings.length}`);
  return { status: result.status, checkedBy: result.checked_by, findings: result.findings.length, stored: !error, aiError: result.ai_error };
}

export type { SkipReason };
