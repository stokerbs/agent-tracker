"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  listAirTagsForCase,
  type ActionResult,
  type AirTagTrackerSummary,
} from "@/app/(dashboard)/air-tags/actions";
import { Button } from "@/components/ui/button";
import { CreateAirTagDialog } from "./create-air-tag-dialog";
import { AirTagTrackerCard } from "./air-tag-tracker-card";

interface Props {
  caseId: string;
  canCreate: boolean;
  /** Server-fetched on initial page render (mirrors the GPS Devices section's prefetch pattern) so there is no extra loading flash on first paint. */
  initial: ActionResult<{ trackers: AirTagTrackerSummary[] }>;
}

/**
 * AirTags section on the case detail page. Renders from `initial` (fetched
 * server-side in cases/[id]/page.tsx via listAirTagsForCase) so the common
 * path has an instant, loading-flash-free paint; a failed initial fetch
 * surfaces an inline error with a real client-side retry (re-invokes the same
 * server action) rather than requiring a full page reload or breaking the
 * rest of the case page.
 */
export function AirTagsCaseSection({ caseId, canCreate, initial }: Props) {
  const t = useTranslations("airTags.caseSection");
  const [result, setResult] = useState(initial);
  const [pending, startTransition] = useTransition();

  // A fresh server render (e.g. after router.refresh() from the create
  // dialog) passes a new `initial` object — pick it up.
  useEffect(() => {
    setResult(initial);
  }, [initial]);

  function retry() {
    startTransition(async () => {
      const res = await listAirTagsForCase({ caseId });
      setResult(res);
    });
  }

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex justify-end">
          <CreateAirTagDialog caseId={caseId} />
        </div>
      )}

      {!result.ok ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-md border border-dashed border-destructive/30 bg-destructive/5 py-8 text-center"
        >
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="max-w-sm text-sm text-muted-foreground">{result.error}</p>
          <Button variant="outline" size="sm" onClick={retry} disabled={pending}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("retry")}
          </Button>
        </div>
      ) : result.trackers.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
          {canCreate && <p className="mt-1 text-xs text-muted-foreground/60">{t("emptyHint")}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {result.trackers.map((tr) => (
            <AirTagTrackerCard key={tr.id} tracker={tr} />
          ))}
        </div>
      )}
    </div>
  );
}
