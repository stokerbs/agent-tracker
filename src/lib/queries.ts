import { createClient } from "@/lib/supabase/server";
import type {
  Agent,
  Case,
  EmergencyAlert,
  Expense,
  Geofence,
  TimelineEntry,
} from "@/lib/types";
import type {
  AgentLoad,
  CasesTrendPoint,
  RevenueTrendPoint,
  StatusSlice,
} from "@/components/dashboard/charts";

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
    .select("*, agents(full_name)")
    .order("expense_date", { ascending: false });
  return (data as never) ?? [];
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
  agent_id: string;
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
    .select("id, agent_id, geofence_id, event_type, occurred_at, agents(full_name), geofences(name)")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    agent_id: row.agent_id,
    geofence_id: row.geofence_id,
    event_type: row.event_type as "enter" | "exit",
    occurred_at: row.occurred_at,
    agentName: row.agents?.full_name ?? "Unknown agent",
    fenceName: row.geofences?.name ?? "Unknown zone",
  }));
}
