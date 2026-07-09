import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/errors";
import { analyzeRequestSchema } from "@/lib/osint/types";
import { runPipeline } from "@/lib/osint/pipeline";
import { IngestError } from "@/lib/osint/ingest";
import { SsrfError } from "@/lib/osint/fetch-guard";

// OSINT image analysis endpoint. Staff-only. Everything runs server-side: the
// image is downloaded through the SSRF guard, hashed, EXIF-parsed, attributed,
// and summarized by Claude, then persisted. Bounded by the osint_analyze rate
// limit (outbound fetch + AI cost) and a per-request body cap.
//
// Node runtime is required (sharp + node:crypto + node:dns). Analysis can take a
// few seconds (download + AI), so we raise maxDuration.
export const runtime = "nodejs";
// ML stages (Replicate face/object inference + local OCR) add latency on top of
// the forensic pipeline, so allow a longer budget than the Phase-1 default.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const rl = await checkRateLimit("osint_analyze", profile.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // If linking to a case, verify the caller can actually access it (RLS-scoped
  // read). Never trust the client-supplied case_id past this check.
  let caseId: string | null = null;
  if (parsed.data.case_id) {
    const supabase = await createClient();
    const { data: allowed, error } = await supabase
      .from("cases")
      .select("id")
      .eq("id", parsed.data.case_id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Case lookup failed" }, { status: 500 });
    if (!allowed) return NextResponse.json({ error: "Case not found or not accessible" }, { status: 403 });
    caseId = parsed.data.case_id;
  }

  try {
    const result = await runPipeline(parsed.data, { profileId: profile.id, caseId });

    await logAudit({
      actorId: profile.id,
      action: "OSINT_IMAGE_ANALYZE",
      entity: "image_analysis",
      entityId: result.id,
      metadata: {
        source_type: result.sourceType,
        case_id: caseId,
        sha256: result.hashes?.sha256 ?? null,
        stages: result.stageStatus,
      },
    });

    return NextResponse.json({ analysis: result }, { status: 201 });
  } catch (err) {
    // Input-shaped failures → 4xx (nothing persisted). Everything else → 500.
    if (err instanceof SsrfError) {
      return NextResponse.json({ error: `Blocked or unreachable URL: ${err.message}` }, { status: 400 });
    }
    if (err instanceof IngestError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    reportError(err, "osint/image", { actorId: profile.id });
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
