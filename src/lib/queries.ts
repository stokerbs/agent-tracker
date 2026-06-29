import { createClient } from "@/lib/supabase/server";
import type {
  Agent,
  Case,
  EmergencyAlert,
  Expense,
  Geofence,
  GpsDeviceForMap,
  TimelineEntry,
} from "@/lib/types";
import type {
  AgentLoad,
  CasesTrendPoint,
  RevenueTrendPoint,
  StatusSlice,
} from "@/lib/dashboard-charts.types";

// ----------------------------------------------------------------------------
// Server-side data access helpers. All run under the caller's RLS context.
// ----------------------------------------------------------------------------

export async function getAgents(): Promise<Agent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select("*")
    .order("full_name");
  return (data as Agent[]) ?? [];
}

export async function getActiveAgents(): Promise<Agent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select("*")
    .neq("status", "offline")
    .not("current_lat", "is", null);
  return (data as Agent[]) ?? [];
}

export async function getCases(): Promise<Case[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Case[]) ?? [];
}

/** Returns only active/assigned/new cases for the dashboard mission list. */
export async function getActiveCases(limit = 5): Promise<Case[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data as Case[]) ?? [];
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const [agents, cases, alerts] = await Promise.all([
    supabase.from("agents").select("status"),
    supabase.from("cases").select("status"),
    supabase
      .from("emergency_alerts")
      .select("id")
      .eq("status", "active"),
  ]);

  const agentRows = (agents.data ?? []) as { status: Agent["status"] }[];
  const caseRows = (cases.data ?? []) as { status: Case["status"] }[];

  return {
    totalAgents: agentRows.length,
    availableAgents: agentRows.filter((a) =>
      a.status === "online" || a.status === "moving" || a.status === "idle",
    ).length,
    activeAgents: agentRows.filter((a) => a.status !== "offline").length,
    offlineAgents: agentRows.filter((a) => a.status === "offline").length,
    openCases: caseRows.filter((c) => c.status !== "closed").length,
    closedCases: caseRows.filter((c) => c.status === "closed").length,
    emergencyAlerts: (alerts.data ?? []).length,
  };
}

export async function getRecentTimeline(
  limit = 8,
): Promise<(TimelineEntry & { agents?: Agent | null; cases?: Case | null })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("timeline_entries")
    .select("*, agents(full_name, nickname), cases(case_number)")
    .is("deleted_at", null) // exclude soft-deleted entries
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as never) ?? [];
}

export async function getActiveAlerts(): Promise<EmergencyAlert[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("emergency_alerts")
    .select("*, agents(full_name, agent_code)")
    .neq("status", "resolved")
    .order("created_at", { ascending: false });
  return (data as never) ?? [];
}

export async function getChartData(): Promise<{
  casesTrend: CasesTrendPoint[];
  caseStatus: StatusSlice[];
  agentWorkload: AgentLoad[];
  revenueTrend: RevenueTrendPoint[];
}> {
  const supabase = await createClient();

  const [casesRes, caseAgentsRes, invoicesRes] = await Promise.all([
    supabase.from("cases").select("created_at, status"),
    supabase.from("case_agents").select("agent_id, agents(full_name, nickname), cases(status)"),
    supabase.from("invoices").select("issued_date, amount, status"),
  ]);

  const cases = (casesRes.data ?? []) as { created_at: string; status: string }[];
  const invoices = (invoicesRes.data ?? []) as { issued_date: string; amount: number; status: string }[];

  // ── Last 6 calendar months ─────────────────────────────────────────────
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en", { month: "short" }),
    });
  }

  const casesTrend: CasesTrendPoint[] = months.map(({ key, label }) => ({
    month: label,
    cases: cases.filter((c) => c.created_at.startsWith(key)).length,
  }));

  // ── Case status breakdown ──────────────────────────────────────────────
  const statusCount: Record<string, number> = {};
  for (const c of cases) {
    statusCount[c.status] = (statusCount[c.status] ?? 0) + 1;
  }
  const caseStatus: StatusSlice[] = Object.entries(statusCount).map(([name, value]) => ({
    name,
    value,
    color: "",
  }));

  // ── Agent workload ─────────────────────────────────────────────────────
  const agentMap = new Map<string, { name: string; cases: number }>();
  for (const row of caseAgentsRes.data ?? []) {
    const r = row as any;
    const agentId: string = r.agent_id;
    const agentName: string = r.agents?.nickname ?? r.agents?.full_name ?? "Unknown";
    const caseStatus: string = r.cases?.status ?? "";
    if (!agentMap.has(agentId)) agentMap.set(agentId, { name: agentName, cases: 0 });
    if (caseStatus === "active") agentMap.get(agentId)!.cases++;
  }
  const agentWorkload: AgentLoad[] = Array.from(agentMap.values())
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 8);

  // ── Revenue trend ──────────────────────────────────────────────────────
  const revenueTrend: RevenueTrendPoint[] = months.map(({ key, label }) => {
    const monthInvoices = invoices.filter((inv) =>
      (inv.issued_date ?? "").startsWith(key),
    );
    return {
      month: label,
      invoiced: monthInvoices.reduce((s, inv) => s + (inv.amount ?? 0), 0),
      paid: monthInvoices
        .filter((inv) => inv.status === "paid")
        .reduce((s, inv) => s + (inv.amount ?? 0), 0),
    };
  });

  return { casesTrend, caseStatus, agentWorkload, revenueTrend };
}

export async function getExpenses(): Promise<Expense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*, agents(full_name), cases(case_number), profiles!expenses_paid_by_fkey(full_name)")
    .is("deleted_at", null)
    .order("expense_date", { ascending: false });
  // Flatten paid_by profile name onto the object for convenience
  return ((data ?? []) as any[]).map((e) => ({
    ...e,
    paid_by_name: (e.profiles as { full_name: string | null } | null)?.full_name ?? null,
  })) as never;
}

export async function getGeofences(): Promise<Geofence[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("geofences")
    .select("*")
    .eq("active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data as Geofence[]) ?? [];
}

export async function getActiveEmergencyAlerts(): Promise<EmergencyAlert[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("emergency_alerts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return (data as EmergencyAlert[]) ?? [];
}

export interface GeofenceEventFeed {
  id: string;
  agent_id: string | null;
  geofence_id: string;
  event_type: "enter" | "exit";
  occurred_at: string;
  agentName: string;
  fenceName: string;
}

export async function getRecentGeofenceEvents(limit = 20): Promise<GeofenceEventFeed[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("geofence_events")
    .select("id, agent_id, gps_device_id, geofence_id, event_type, occurred_at, agents(full_name), gps_devices(notes, gps903_device_id), geofences(name)")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    agent_id: row.agent_id,
    geofence_id: row.geofence_id,
    event_type: row.event_type as "enter" | "exit",
    occurred_at: row.occurred_at,
    // Agent crossings show the agent; device crossings show the device label.
    agentName:
      row.agents?.full_name ??
      (row.gps_devices
        ? (row.gps_devices.notes ?? `GPS903-${row.gps_devices.gps903_device_id ?? "?"}`)
        : "Unknown agent"),
    fenceName: row.geofences?.name ?? "Unknown zone",
  }));
}

/**
 * Shared query skeleton for "active" GPS devices (at least one position fix,
 * not soft-deleted), newest-seen first. The `select` string is supplied by the
 * caller because the projected embeds differ per use site.
 */
function activeGpsDevicesQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  select: string,
) {
  return supabase
    .from("gps_devices")
    .select(select)
    .not("last_lat", "is", null)
    .is("deleted_at", null)
    .order("last_seen_at", { ascending: false });
}

/** GPS devices that have received at least one position fix, with their case number. */
export async function getActiveGpsDevices(): Promise<GpsDeviceForMap[]> {
  const supabase = await createClient();
  const { data } = await activeGpsDevicesQuery(supabase, "*, cases(case_number)");

  return ((data ?? []) as unknown as Array<GpsDeviceForMap & { cases: { case_number: string } | null }>).map((row) => ({
    ...row,
    case_number: row.cases?.case_number ?? null,
  }));
}

type GpsRawRow = GpsDeviceForMap & {
  cases: { case_number: string } | null;
  gps903_credentials: { device_name: string | null; imei: string | null; phone_number: string | null; provider: string | null } | null;
};

export function flattenGpsRow(row: GpsRawRow): GpsDeviceForMap {
  return {
    ...row,
    case_number:   row.cases?.case_number ?? null,
    cred_name:     row.gps903_credentials?.device_name  ?? null,
    cred_imei:     row.gps903_credentials?.imei         ?? null,
    cred_phone:    row.gps903_credentials?.phone_number ?? null,
    cred_provider: row.gps903_credentials?.provider     ?? null,
  };
}

/**
 * GPS Monitor: returns GPS devices visible to the current user (RLS-scoped).
 * Admins see all; supervisors see their access-granted devices;
 * agents see devices on their assigned cases (migration 0047 RLS policy).
 * Includes credential metadata for popup display.
 */
export async function getGpsMonitorDevices(): Promise<GpsDeviceForMap[]> {
  const supabase = await createClient();
  const { data } = await activeGpsDevicesQuery(
    supabase,
    "*, cases(case_number), gps903_credentials(device_name, imei, phone_number, provider)",
  );

  return ((data ?? []) as unknown as GpsRawRow[]).map(flattenGpsRow);
}
