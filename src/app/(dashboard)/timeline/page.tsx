import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Clock, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { TimelineFilters } from "@/components/timeline/timeline-filters";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string; agent_id?: string; from?: string; to?: string }>;
}

export default async function TimelinePage({ searchParams }: Props) {
  await requireProfile();
  const t = await getTranslations("timeline");
  const locale = await getLocale();
  const sp = await searchParams;
  const supabase = await createClient();

  const [agentsResult, entriesResult] = await Promise.all([
    supabase.from("agents").select("id, full_name, agent_code").order("full_name"),
    (() => {
      let q = supabase
        .from("timeline_entries")
        .select("*, agents(full_name), cases(case_number)")
        .order("entry_date", { ascending: false })
        .order("entry_time", { ascending: false })
        .limit(200);
      if (sp.agent_id) q = q.eq("agent_id", sp.agent_id);
      if (sp.from) q = q.gte("entry_date", sp.from);
      if (sp.to) q = q.lte("entry_date", sp.to);
      return q;
    })(),
  ]);

  const agents = (agentsResult.data ?? []) as { id: string; full_name: string; agent_code: string }[];

  // Case number search is in-memory (joined column).
  const search = sp.q?.toLowerCase().trim() ?? "";
  const allEntries = (entriesResult.data ?? []) as any[];
  const entries = search
    ? allEntries.filter((e) =>
        (e.cases?.case_number ?? "").toLowerCase().includes(search) ||
        (e.entry ?? "").toLowerCase().includes(search),
      )
    : allEntries;

  const groups = entries.reduce<Record<string, any[]>>((acc, e) => {
    (acc[e.entry_date] ??= []).push(e);
    return acc;
  }, {});

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === "th" ? "th-TH" : "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Suspense>
        <TimelineFilters agents={agents} count={entries.length} />
      </Suspense>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title={search || sp.agent_id || sp.from || sp.to ? t("filters.noResults") : t("noTitle")}
          description={search || sp.agent_id || sp.from || sp.to ? t("filters.noResultsDescription") : t("noDescription")}
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([date, items]) => (
            <div key={date}>
              {/* Date header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                  {fmtDate(date)}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              {/* Timeline entries */}
              <div className="relative pl-5">
                {/* Vertical connector */}
                <div className="absolute inset-y-0 left-[7px] w-px bg-border/50" />

                <div className="space-y-0">
                  {items.map((e, i) => (
                    <div key={e.id} className="group relative flex gap-4 pb-4 last:pb-0">
                      {/* Timeline node */}
                      <div className="absolute -left-[13px] mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                        <div className="h-2 w-2 rounded-full border-2 border-border bg-card ring-4 ring-background transition-colors group-hover:border-primary group-hover:bg-primary/20" />
                      </div>

                      {/* Content card */}
                      <div className="ml-2 flex-1 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm leading-snug text-foreground/90">{e.entry}</p>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground/70">
                            {e.entry_time?.slice(0, 5)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <Link
                            href={`/cases/${e.case_id}`}
                            className="font-mono font-medium text-primary hover:underline"
                          >
                            {e.cases?.case_number ?? "—"}
                          </Link>
                          <span className="text-muted-foreground">{e.agents?.full_name ?? "—"}</span>
                          {e.location && (
                            <span className="flex items-center gap-1 text-muted-foreground/70">
                              <MapPin className="h-3 w-3" />
                              {e.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
