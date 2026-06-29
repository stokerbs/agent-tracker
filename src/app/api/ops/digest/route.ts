import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile, isStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  buildOpsDigest,
  summarizeOps,
  type DigestPeriod,
  type OpsRaw,
} from "@/lib/ops/digest";

export const dynamic = "force-dynamic";

/**
 * GET /api/ops/digest?period=day|week — AI operations digest for the owner /
 * supervisor. Staff-only; aggregates with the user-session client so RLS scopes
 * what each staffer can see. Rate-limited (report bucket). Returns the AI (or
 * template-fallback) digest plus the structured summary it was built from.
 */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isStaff(profile.role)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const rl = await checkRateLimit("report", profile.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const period: DigestPeriod = request.nextUrl.searchParams.get("period") === "week" ? "week" : "day";
  const supabase = await createClient();

  // Pull a generous window once (7 days) and let summarizeOps slice per period.
  const sinceWeek = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

  const [casesRes, tlRes, geoRes, alertsRes, expRes, agentsRes, devRes] = await Promise.all([
    supabase.from("cases").select("case_number, status, priority, case_type, client_name, created_at, updated_at"),
    supabase.from("timeline_entries").select("case_id, created_at").is("deleted_at", null).gte("created_at", sinceWeek),
    supabase.from("geofence_events").select("event_type, occurred_at, geofences(name)").gte("occurred_at", sinceWeek),
    supabase.from("emergency_alerts").select("status, created_at, notes, lat, lng"),
    supabase.from("expenses").select("amount, category, expense_date").is("deleted_at", null).gte("expense_date", sinceWeek.slice(0, 10)),
    supabase.from("agents").select("status"),
    supabase.from("gps_devices").select("last_seen_at").is("deleted_at", null),
  ]);

  const raw: OpsRaw = {
    cases: (casesRes.data ?? []) as OpsRaw["cases"],
    timeline: (tlRes.data ?? []) as OpsRaw["timeline"],
    geofence: ((geoRes.data ?? []) as unknown[]).map((row) => {
      const g = row as { event_type: "enter" | "exit"; occurred_at: string; geofences: { name: string | null } | { name: string | null }[] | null };
      const fence = Array.isArray(g.geofences) ? g.geofences[0] : g.geofences;
      return { event_type: g.event_type, occurred_at: g.occurred_at, zone: fence?.name ?? null };
    }),
    alerts: (alertsRes.data ?? []) as OpsRaw["alerts"],
    expenses: (expRes.data ?? []) as OpsRaw["expenses"],
    agents: (agentsRes.data ?? []) as OpsRaw["agents"],
    devices: (devRes.data ?? []) as OpsRaw["devices"],
  };

  const summary = summarizeOps(raw, period);
  const { digest, ai } = await buildOpsDigest(summary);

  return NextResponse.json({ digest, ai, summary });
}
