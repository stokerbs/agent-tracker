import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/errors";
import { isPurgeable, purgeMode, retentionCutoff, type RetentionLeadRow } from "@/lib/marketing/lead-retention";

export const maxDuration = 60;

const LEAD_FILES_BUCKET = "lead-files";
const BATCH = 200;

/**
 * GET /api/cron/purge-marketing-leads — monthly (vercel.json).
 * Deletes non-converted, dead marketing leads older than 12 months (rule in
 * lib/marketing/lead-retention.ts), including their intake attachments in the
 * private lead-files bucket (rows in marketing_lead_files cascade).
 *
 * Gated by MARKETING_LEAD_PURGE: unset → no-op; "dry" → counts only; "1" →
 * delete. Auth: fail-closed CRON_SECRET bearer. Audited with counts only.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const mode = purgeMode();
  if (mode === "off") return NextResponse.json({ ok: true, mode, purged: 0, note: "MARKETING_LEAD_PURGE not set" });

  const svc = createServiceClient();
  const now = new Date();
  const cutoff = retentionCutoff(now).toISOString();
  // Candidates: never converted and not changed within the window. The pure
  // rule decides stage / quality; we only pre-filter by age in SQL.
  const { data, error } = await svc
    .from("marketing_leads")
    .select("id, stage, lead_quality, converted_at, stage_changed_at, created_at")
    .is("converted_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    reportError(error, "cron:purge-marketing-leads:select");
    return NextResponse.json({ ok: false, error: "query_failed" }, { status: 500 });
  }
  const candidates = ((data ?? []) as RetentionLeadRow[]).filter((l) => isPurgeable(l, now));
  if (mode === "dry") {
    console.info("[cron:purge-marketing-leads] dry run", { candidates: candidates.length, cutoff });
    return NextResponse.json({ ok: true, mode, purged: 0, candidates: candidates.length, cutoff });
  }

  let purged = 0, files = 0;
  for (const l of candidates) {
    // Attachments first (storage does not cascade).
    const { data: objects } = await svc.storage.from(LEAD_FILES_BUCKET).list(l.id);
    if (objects && objects.length > 0) {
      const { error: rmErr } = await svc.storage.from(LEAD_FILES_BUCKET).remove(objects.map((o) => `${l.id}/${o.name}`));
      if (rmErr) { reportError(rmErr, "cron:purge-marketing-leads:storage"); continue; } // keep the row if its files could not be removed
      files += objects.length;
    }
    const { error: delErr } = await svc.from("marketing_leads").delete().eq("id", l.id).is("converted_at", null);
    if (delErr) { reportError(delErr, "cron:purge-marketing-leads:delete"); continue; }
    purged += 1;
  }
  await logAudit({ actorId: null, action: "LEAD_RETENTION_PURGE", entity: "marketing_leads", entityId: null, metadata: { purged, files, candidates: candidates.length, cutoff } });
  console.info("[cron:purge-marketing-leads] purged", { purged, files, candidates: candidates.length, cutoff });
  return NextResponse.json({ ok: true, mode, purged, files, candidates: candidates.length, cutoff, more: candidates.length === BATCH });
}
