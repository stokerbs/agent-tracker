"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useLocale } from "next-intl";
import { TimelineEntryCard } from "@/components/cases/timeline-entry-card";
import { TimelineEvidenceGallery } from "@/components/timeline/timeline-evidence-gallery";
import { ObservationUploader } from "@/components/timeline/observation-uploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LinkedEvidence, TimelineEntry } from "@/lib/types";

type EntryWithAgent = TimelineEntry & {
  agents?: { full_name: string; nickname?: string | null } | null;
  linked_evidence?: LinkedEvidence[];
};

export interface DateGroup {
  date: string;
  entries: EntryWithAgent[];
}

interface Props {
  caseId: string;
  dateGroups: DateGroup[];
  canInsert: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  todayBangkok: string;
}

function fmtDate(dateStr: string, locale: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(
    locale === "th" ? "th-TH" : "en-US",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  );
}

export function CaseTimelineClient({
  caseId,
  dateGroups,
  canInsert,
  canEdit,
  isAdmin,
  todayBangkok,
}: Props) {
  const locale = useLocale();

  // Only today is open by default. Empty dict = use todayBangkok as initial open state.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (dateGroups.some((dg) => dg.date === todayBangkok)) {
      init[todayBangkok] = true;
    } else if (dateGroups.length > 0) {
      // No entries today — open the most recent day instead
      init[dateGroups[0].date] = true;
    }
    return init;
  });

  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    function onFab(e: Event) {
      if ((e as CustomEvent<{ tab: string }>).detail?.tab === "timeline") setAddOpen(true);
    }
    document.addEventListener("case:fab", onFab);
    return () => document.removeEventListener("case:fab", onFab);
  }, []);

  function toggle(date: string) {
    setExpanded((prev) => ({ ...prev, [date]: !prev[date] }));
  }

  return (
    <>
      <div className="space-y-2">
        {dateGroups.map((dg) => {
          const isOpen = !!expanded[dg.date];
          const isToday = dg.date === todayBangkok;

          return (
            <div key={dg.date} className="rounded-lg border bg-card">
              {/* Date header */}
              <div className="sticky top-0 z-10 flex min-h-[44px] items-center gap-2 rounded-lg bg-background/95 px-3 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => toggle(dg.date)}
                  className="flex min-h-[44px] flex-1 items-center gap-1.5 text-left transition-colors hover:text-foreground"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      isToday
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {fmtDate(dg.date, locale)}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {dg.entries.length === 1
                      ? "1 entry"
                      : `${dg.entries.length} entries`}
                  </span>
                </button>

                {/* Add Observation button — only in the open section, staff only */}
                {isOpen && canInsert && (
                  <>
                    {/* Desktop inline button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddOpen(true)}
                      className="hidden h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground sm:flex"
                    >
                      <Plus className="h-3 w-3" /> Add Observation
                    </Button>
                  </>
                )}
              </div>

              {/* Entries */}
              {isOpen && (
                <div className="px-4 pb-4">
                  <div className="relative space-y-0 pl-5">
                    <div className="absolute inset-y-0 left-[7px] w-px bg-border/50" />
                    {dg.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="group relative flex gap-4 pb-4 last:pb-0"
                      >
                        <div className="absolute -left-[13px] mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
                          <div className="h-2 w-2 rounded-full border-2 border-border bg-card ring-4 ring-background transition-colors group-hover:border-primary group-hover:bg-primary/20" />
                        </div>
                        <span className="mt-3 shrink-0 font-mono text-xs text-muted-foreground/70">
                          {entry.entry_time?.slice(0, 5)}
                        </span>
                        {canEdit ? (
                          <TimelineEntryCard
                            entry={entry}
                            canEdit
                            isAdmin={isAdmin}
                            linkedEvidence={entry.linked_evidence}
                          />
                        ) : (
                          <div className="flex-1 rounded-lg border border-border/50 bg-card p-2 sm:p-3">
                            <p className="text-sm leading-snug">{entry.entry}</p>
                            {entry.location && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                📍 {entry.location}
                              </p>
                            )}
                            {entry.linked_evidence && entry.linked_evidence.length > 0 && (
                              <TimelineEvidenceGallery items={entry.linked_evidence} />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Mobile: Add Observation inside open section */}
                  {canInsert && (
                    <button
                      type="button"
                      onClick={() => setAddOpen(true)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:hidden"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Observation
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Observation dialog (shared by both mobile and desktop triggers) */}
      {canInsert && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-sm gap-0 p-0">
            <DialogHeader className="px-4 pb-2 pt-4">
              <DialogTitle className="text-base">Add Observation</DialogTitle>
            </DialogHeader>
            <div className="px-4 pb-4">
              <ObservationUploader
                caseId={caseId}
                defaultDate={todayBangkok}
                onSuccess={() => setAddOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
