import type { Metadata } from "next";
import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Timeline" };
export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("timeline_entries")
    .select("*, agents(full_name), cases(case_number)")
    .order("entry_date", { ascending: false })
    .order("entry_time", { ascending: false })
    .limit(200);

  const entries = (data ?? []) as any[];

  // Group by date.
  const groups = entries.reduce<Record<string, any[]>>((acc, e) => {
    (acc[e.entry_date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline Reporting"
        description="Chronological surveillance log across all cases."
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title="No timeline entries"
          description="Field observations submitted by agents will appear here."
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([date, items]) => (
            <div key={date}>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">
                {new Date(date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <Card>
                <CardContent className="divide-y p-0">
                  {items.map((e) => (
                    <div key={e.id} className="flex gap-4 p-4">
                      <div className="w-14 shrink-0 text-sm font-medium text-muted-foreground">
                        {e.entry_time?.slice(0, 5)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{e.entry}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <Link
                            href={`/cases/${e.case_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {e.cases?.case_number ?? "Case"}
                          </Link>
                          <span>{e.agents?.full_name ?? "Agent"}</span>
                          {e.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {e.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
