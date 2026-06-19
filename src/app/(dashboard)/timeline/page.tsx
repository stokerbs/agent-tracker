import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { TimelineFilters } from "@/components/timeline/timeline-filters";
import { TimelineClient } from "@/components/timeline/timeline-client";
import { EmptyState } from "@/components/shared/empty-state";
import type { TimelineEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

type EntryFull = TimelineEntry & {
  agents: { full_name: string; agent_code: string } | null;
  cases: { case_number: string } | null;
};
type DateGroup = { date: string; entries: EntryFull[] };
type CaseGroup = { caseId: string; caseNumber: string; dates: DateGroup[] };

interface Props {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}

export default async function TimelinePage({ searchParams }: Props) {
  const profile = await requireProfile();
  const canEdit = isStaff(profile.role);
  const isAdmin = profile.role === "admin";
  const t = await getTranslations("timeline");
  const sp = await searchParams;
  const supabase = await createClient();

  let caseGroups: CaseGroup[] = [];

  // Scope query by role
  let caseIdFilter: string[] | null = null;

  if (profile.role !== "admin") {
    // supervisor or agent: find their agent record
    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!agentRow) {
      // No agent record — show nothing
      return renderPage(t, sp, caseGroups, canEdit, isAdmin);
    }

    const { data: caseAgents } = await supabase
      .from("case_agents")
      .select("case_id")
      .eq("agent_id", agentRow.id);

    const myCaseIds = (caseAgents ?? []).map((ca) => ca.case_id);
    if (myCaseIds.length === 0) {
      return renderPage(t, sp, caseGroups, canEdit, isAdmin);
    }
    caseIdFilter = myCaseIds;
  }

  let query = supabase
    .from("timeline_entries")
    .select("*, agents(full_name, agent_code), cases(case_number)")
    .is("deleted_at", null)
    .order("entry_date", { ascending: true })
    .order("entry_time", { ascending: true })
    .limit(500);

  if (caseIdFilter) {
    query = query.in("case_id", caseIdFilter);
  }
  if (sp.from) query = query.gte("entry_date", sp.from);
  if (sp.to) query = query.lte("entry_date", sp.to);

  const { data: rawEntries } = await query;
  let allEntries = (rawEntries ?? []) as EntryFull[];

  // In-memory search
  const search = sp.q?.toLowerCase().trim() ?? "";
  if (search) {
    allEntries = allEntries.filter(
      (e) =>
        (e.cases?.case_number ?? "").toLowerCase().includes(search) ||
        (e.entry ?? "").toLowerCase().includes(search) ||
        (e.location ?? "").toLowerCase().includes(search),
    );
  }

  // Build CaseGroup[]
  const caseMap = new Map<string, { caseNumber: string; dateMap: Map<string, EntryFull[]> }>();
  for (const entry of allEntries) {
    const caseId = entry.case_id;
    const caseNumber = entry.cases?.case_number ?? caseId;
    if (!caseMap.has(caseId)) {
      caseMap.set(caseId, { caseNumber, dateMap: new Map() });
    }
    const caseData = caseMap.get(caseId)!;
    const date = entry.entry_date;
    if (!caseData.dateMap.has(date)) {
      caseData.dateMap.set(date, []);
    }
    caseData.dateMap.get(date)!.push(entry);
  }

  caseGroups = Array.from(caseMap.entries())
    .map(([caseId, { caseNumber, dateMap }]) => ({
      caseId,
      caseNumber,
      dates: Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entries]) => ({ date, entries })),
    }))
    .sort((a, b) => a.caseNumber.localeCompare(b.caseNumber));

  return renderPage(t, sp, caseGroups, canEdit, isAdmin);
}

function renderPage(
  t: Awaited<ReturnType<typeof getTranslations<"timeline">>>,
  sp: { q?: string; from?: string; to?: string },
  caseGroups: CaseGroup[],
  canEdit: boolean,
  isAdmin: boolean,
) {
  const totalEntries = caseGroups.reduce(
    (sum, cg) => sum + cg.dates.reduce((s, dg) => s + dg.entries.length, 0),
    0,
  );
  const hasFilters = !!(sp.q || sp.from || sp.to);

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <Suspense>
        <TimelineFilters count={totalEntries} />
      </Suspense>
      {caseGroups.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title={hasFilters ? t("filters.noResults") : t("noTitle")}
          description={
            hasFilters
              ? t("filters.noResultsDescription")
              : t("noDescription")
          }
        />
      ) : (
        <TimelineClient
          caseGroups={caseGroups}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
