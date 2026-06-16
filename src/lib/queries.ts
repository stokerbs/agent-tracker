import { createClient } from "@/lib/supabase/server";
import type {
  Agent,
  Case,
  EmergencyAlert,
  Expense,
  TimelineEntry,
} from "@/lib/types";

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
    availableAgents: agentRows.filter((a) => a.status === "available").length,
    activeAgents: agentRows.filter(
      (a) => a.status !== "offline",
    ).length,
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

export async function getExpenses(): Promise<Expense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*, agents(full_name)")
    .order("expense_date", { ascending: false });
  return (data as never) ?? [];
}
