import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStudioAdmin } from "@/lib/studio/auth";
import { runRenderJob } from "@/lib/studio/video/render";

// Runs one queued template-video render job (ffmpeg) for the signed-in admin.
// The editor creates the job through a server action, then POSTs here and
// polls the job row. Long-running by design — see docs/CREATIVE_STUDIO.md §15.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const profile = await getStudioAdmin();
  if (!profile) return NextResponse.json({ ok: false, error: "ไม่มีสิทธิ์ดำเนินการ" }, { status: 401 });
  const { jobId } = await ctx.params;
  if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ ok: false, error: "รหัสงานไม่ถูกต้อง" }, { status: 400 });

  // RLS read first: the job must be visible to this admin and still queued.
  const rls = await createClient();
  const { data: job, error } = await rls.from("studio_render_jobs").select("id, status").eq("id", jobId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "โหลดงานไม่สำเร็จ" }, { status: 500 });
  if (!job) return NextResponse.json({ ok: false, error: "ไม่พบงาน render" }, { status: 404 });
  if (job.status !== "queued") return NextResponse.json({ ok: false, error: `งานนี้อยู่ในสถานะ ${job.status} แล้ว` }, { status: 409 });

  const result = await runRenderJob(jobId, { userId: profile.id });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
