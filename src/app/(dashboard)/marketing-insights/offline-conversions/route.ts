import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/errors";
import { offlineConversionsCsv, type OfflineLeadRow } from "@/lib/marketing/offline-conversions";

export const dynamic = "force-dynamic";

/**
 * Google Ads offline-conversion CSV (admin only; audited). Leads with a gclid
 * rated qualified / high_value or converted → "Qualified lead" / "Paid case"
 * rows. Optional ?days=N (default 90, max 365) bounds by lead creation date.
 * Upload at Google Ads → Goals → Conversions → Uploads (see
 * docs/seo-growth-audit/ads-offline-conversions.md).
 */
export async function GET(request: Request) {
  const profile = await requireRole(["admin"]); // redirects non-admins
  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "90");
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.trunc(daysRaw), 1), 365) : 90;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = await createClient(); // RLS: admin read policy
  const { data, error } = await supabase
    .from("marketing_leads")
    .select("gclid, created_at, stage_changed_at, converted_at, lead_quality, final_revenue, quoted_value")
    .not("gclid", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) {
    reportError(error, "marketing-insights:offline-conversions");
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const rows = (data ?? []) as OfflineLeadRow[];
  const csv = offlineConversionsCsv(rows);
  const conversions = csv.split("\r\n").length - 3; // minus parameter line, header, trailing empty
  await logAudit({ actorId: profile.id, action: "ADS_OFFLINE_CONVERSIONS_EXPORT", entity: "marketing_leads", entityId: null, metadata: { days, leads: rows.length, conversions } });
  console.info("[marketing-insights] offline conversions exported", { days, leads: rows.length, conversions });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="google-ads-offline-conversions-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
