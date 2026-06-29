import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FadeUp } from "@/components/shared/motion";
import { FieldClient } from "@/components/field/field-client";
import type { Agent, Case } from "@/lib/types";

export const metadata: Metadata = { title: "On Duty" };
export const dynamic = "force-dynamic";

export interface IntelCounts {
  photos: number;
  vehicles: number;
  locations: number;
}

/**
 * On-duty operational screen — GPS ping, status toggle, evidence capture, and
 * the agent's active cases. Previously the /field home; moved here when /field
 * became the card-menu launcher. Reached from the "แอปภาคสนาม" card.
 */
export default async function FieldDutyPage() {
  const profile = await requireProfile();
  const t = await getTranslations("field");
  const supabase = await createClient();

  const { data: agentRaw } = await supabase
    .from("agents")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const agent = agentRaw as Agent | null;

  let activeCases: Case[] = [];
  const intelCounts: Record<string, IntelCounts> = {};

  if (agent) {
    const { data } = await supabase
      .from("case_agents")
      .select("cases(id,case_number,case_type,status,priority,client_name)")
      .eq("agent_id", agent.id);

    activeCases = (data ?? [])
      .map((r: any) => r.cases)
      .filter((c: any) => c && c.status !== "closed" && c.status !== "cancelled") as Case[];

    if (activeCases.length > 0) {
      const caseIds = activeCases.map((c) => c.id);
      const [{ data: photos }, { data: vehicles }, { data: locations }] = await Promise.all([
        supabase.from("target_photos").select("case_id").in("case_id", caseIds),
        supabase.from("target_vehicles").select("case_id").in("case_id", caseIds),
        supabase.from("target_locations").select("case_id").in("case_id", caseIds),
      ]);

      for (const c of activeCases) {
        intelCounts[c.id] = {
          photos:    (photos    ?? []).filter((p) => p.case_id === c.id).length,
          vehicles:  (vehicles  ?? []).filter((v) => v.case_id === c.id).length,
          locations: (locations ?? []).filter((l) => l.case_id === c.id).length,
        };
      }
    }
  }

  return (
    <FadeUp className="mx-auto max-w-lg space-y-4 pb-8">
      <FieldClient
        agent={agent}
        activeCases={activeCases}
        intelCounts={intelCounts}
        noAgentMessage={t("noAgent")}
      />
    </FadeUp>
  );
}
