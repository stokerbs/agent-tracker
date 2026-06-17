import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FadeUp } from "@/components/shared/motion";
import { FieldClient } from "@/components/field/field-client";
import type { Agent, Case } from "@/lib/types";

export const metadata: Metadata = { title: "Field" };
export const dynamic = "force-dynamic";

export default async function FieldPage() {
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
  if (agent) {
    const { data } = await supabase
      .from("case_agents")
      .select("cases(id,case_number,case_type,status,priority,client_name)")
      .eq("agent_id", agent.id);

    activeCases = (data ?? [])
      .map((r: any) => r.cases)
      .filter((c: any) => c && c.status !== "closed" && c.status !== "cancelled") as Case[];
  }

  return (
    <FadeUp className="mx-auto max-w-lg space-y-4 pb-8">
      <FieldClient
        agent={agent}
        activeCases={activeCases}
        noAgentMessage={t("noAgent")}
      />
    </FadeUp>
  );
}
