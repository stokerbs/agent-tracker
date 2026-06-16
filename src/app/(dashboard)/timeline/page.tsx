import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  await requireProfile();
  const t = await getTranslations("timeline");
  const locale = await getLocale();
  const supabase = await createClient();
  const { data } = await supabase
    .from("timeline_entries")
    .select("*, agents(full_name), cases(case_number)")
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false })
    .limit(200);

  const entries = (data ?? []) as any[];

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

      {entries.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title={t("noTitle")}
          description={t("noDescription")}
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
