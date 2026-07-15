import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/errors";
import { contactRequestSchema } from "@/lib/contact/types";
import { runContactPipeline } from "@/lib/contact/pipeline";

// OSINT Contact Intelligence endpoint. Staff-only. The identifier is PII — it is
// encrypted before persistence and every lookup is audited (the audit trail is
// the PDPA record). Node runtime (node:crypto for encryption).
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const rl = await checkRateLimit("contact_lookup", profile.id);
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

  const parsed = contactRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  // Optional case link — verify the caller can access it (RLS-scoped read).
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
    const result = await runContactPipeline(parsed.data, { profileId: profile.id, caseId });

    // Audit the lookup — NEVER log the raw identifier (PII); type + ids only.
    await logAudit({
      actorId: profile.id,
      action: "CONTACT_LOOKUP",
      entity: "contact_analysis",
      entityId: result.id,
      metadata: { input_type: result.inputType, case_id: caseId, stages: result.stageStatus },
    });

    return NextResponse.json({ analysis: result }, { status: 201 });
  } catch (err) {
    reportError(err, "osint/contact", { actorId: profile.id });
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
