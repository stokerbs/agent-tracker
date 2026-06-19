import type { Metadata } from "next";
import { Suspense } from "react";
import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { TimelineFilters } from "@/components/timeline/timeline-filters";
import { TimelineClient } from "@/components/timeline/timeline-client";
import { EmptyState } from "@/components/shared/empty-state";
import type { LinkedEvidence } from "@/lib/types";
import type { CaseGroup, EntryFull } from "@/app/(dashboard)/timeline/actions";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

const CASES_PER_PAGE = 7;

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
  let hasMore = false;

  // Scope query to assigned cases for non-admin roles
  let caseIdFilter: string[] | null = null;

  if (profile.role !== "admin") {
    const { data: agentRow } = await supabase
      .from("agents")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!agentRow) return renderPage(t, sp, caseGroups, hasMore, canEdit, isAdmin);

    const { data: caseAgents } = await supabase
      .from("case_agents")
      .select("case_id")
      .eq("agent_id", agentRow.id);

    const myCaseIds = (caseAgents ?? []).map((ca) => ca.case_id);
    if (myCaseIds.length === 0) return renderPage(t, sp, caseGroups, hasMore, canEdit, isAdmin);
    caseIdFilter = myCaseIds;
  }

  // Fetch newest entries first so case ordering reflects latest activity
  let query = supabase
    .from("timeline_entries")
    .select("*, agents(full_name, agent_code), cases(case_number)")
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false })
    .limit(500);

  if (caseIdFilter) query = query.in("case_id", caseIdFilter);
  if (sp.from) query = query.gte("entry_date", sp.from);
  if (sp.to) query = query.lte("entry_date", sp.to);

  const { data: rawEntries } = await query;
  let allEntries = (rawEntries ?? []) as EntryFull[];

  // In-memory search filter
  const search = sp.q?.toLowerCase().trim() ?? "";
  if (search) {
    allEntries = allEntries.filter(
      (e) =>
        (e.cases?.case_number ?? "").toLowerCase().includes(search) ||
        (e.entry ?? "").toLowerCase().includes(search) ||
        (e.location ?? "").toLowerCase().includes(search),
    );
  }

  // Group into cases. Entries are DESC-sorted, so first-seen case_id = newest activity.
  const caseOrder: string[] = [];
  const caseMap = new Map<string, { caseNumber: string; dateMap: Map<string, EntryFull[]> }>();

  for (const entry of allEntries) {
    const isNew = !caseMap.has(entry.case_id);
    // Stop collecting new cases beyond the page limit — we still scan for hasMore
    if (isNew && caseOrder.length >= CASES_PER_PAGE) {
      hasMore = true;
      break;
    }
    if (isNew) {
      caseOrder.push(entry.case_id);
      caseMap.set(entry.case_id, {
        caseNumber: entry.cases?.case_number ?? entry.case_id,
        dateMap: new Map(),
      });
    }
    const cd = caseMap.get(entry.case_id)!;
    if (!cd.dateMap.has(entry.entry_date)) cd.dateMap.set(entry.entry_date, []);
    cd.dateMap.get(entry.entry_date)!.push(entry);
  }

  // Enrich with linked evidence + signed URLs
  const cappedEntries = allEntries.filter((e) => caseMap.has(e.case_id));
  const entryIds = cappedEntries.map((e) => e.id);
  const enrichedMap = new Map<string, EntryFull>(cappedEntries.map((e) => [e.id, e]));

  if (entryIds.length > 0) {
    const { data: evidenceRows } = await supabase
      .from("evidence")
      .select("id, case_id, type, category, storage_path, file_name, file_size, mime_type, notes, uploaded_by, uploaded_at, timeline_entry_id")
      .in("timeline_entry_id", entryIds);

    if (evidenceRows && evidenceRows.length > 0) {
      const paths = evidenceRows.map((e) => e.storage_path);
      const { data: signedData } = await supabase.storage
        .from(BUCKETS.evidence)
        .createSignedUrls(paths, 3600);

      const signedUrlMap: Record<string, string> = {};
      (signedData ?? []).forEach((su, i) => { signedUrlMap[paths[i]] = su.signedUrl ?? ""; });

      const evidenceByEntry = new Map<string, LinkedEvidence[]>();
      for (const ev of evidenceRows) {
        if (!ev.timeline_entry_id) continue;
        const list = evidenceByEntry.get(ev.timeline_entry_id) ?? [];
        list.push({
          id: ev.id, case_id: ev.case_id, type: ev.type, category: ev.category,
          storage_path: ev.storage_path, file_name: ev.file_name, file_size: ev.file_size,
          mime_type: ev.mime_type, notes: ev.notes, uploaded_by: ev.uploaded_by,
          uploaded_at: ev.uploaded_at, signedUrl: signedUrlMap[ev.storage_path] ?? "",
        });
        evidenceByEntry.set(ev.timeline_entry_id, list);
      }
      cappedEntries.forEach((e) => {
        enrichedMap.set(e.id, { ...e, linked_evidence: evidenceByEntry.get(e.id) ?? [] });
      });
    }
  }

  // Build CaseGroup[] — dates ASC, entries ASC (reverse DESC-fetched order)
  caseGroups = caseOrder.map((caseId) => {
    const { caseNumber, dateMap } = caseMap.get(caseId)!;
    return {
      caseId,
      caseNumber,
      dates: Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entries]) => ({
          date,
          entries: [...entries].reverse().map((e) => enrichedMap.get(e.id) ?? e),
        })),
    };
  });

  return renderPage(t, sp, caseGroups, hasMore, canEdit, isAdmin);
}

function renderPage(
  t: Awaited<ReturnType<typeof getTranslations<"timeline">>>,
  sp: { q?: string; from?: string; to?: string },
  caseGroups: CaseGroup[],
  hasMore: boolean,
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
          hasMore={hasMore}
          filters={sp}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
