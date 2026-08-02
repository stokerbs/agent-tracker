"use client";

/**
 * Tabular AirTag position history — adapted from the Position History tab in
 * src/app/(dashboard)/gps-devices/[id]/page.tsx (formatting conventions:
 * Bangkok-time column, monospace numeric cells, muted "no data" empty
 * state), but as a standalone client component fetching from the
 * `listAirTagPositions` server action rather than a server-rendered table.
 *
 * Unlike GPS903's Position History tab (unpaginated, hard-capped at the most
 * recent 100 rows over 48h — that data is bounded because it's pruned),
 * AirTag positions are never auto-pruned (migration 0107) and a single CSV
 * import can add up to 5,000 rows, so this view is paginated rather than
 * relying on a fixed row cap.
 *
 * Adds the two columns GPS903's table doesn't have — Source (manual vs
 * csv_import) and Entered by — since every AirTag row is human-entered and
 * that provenance matters for evidentiary review.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBangkokTime } from "@/lib/maps/shared";
import { formatSourceLabel, pageCountFor } from "./air-tag-replay-utils";
import { listAirTagPositions, type AirTagPositionRow } from "@/app/(dashboard)/air-tags/actions";

const PAGE_SIZE = 25;

export function AirTagPositionTable({ airTagId }: { airTagId: string }) {
  const t = useTranslations("airTags.table");
  const [rows, setRows] = useState<AirTagPositionRow[] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(false);
    (async () => {
      const res = await listAirTagPositions({ airTagId, page, pageSize: PAGE_SIZE });
      if (cancelled) return;
      if (!res.ok) {
        setError(true);
        return;
      }
      setRows(res.positions);
      setTotalCount(res.totalCount);
    })();
    return () => {
      cancelled = true;
    };
  }, [airTagId, page, reloadKey]);

  const pageCount = pageCountFor(totalCount, PAGE_SIZE);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {t("title")}
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {rows === null && !error ? t("loadingBadge") : t("count", { count: totalCount })}
        </Badge>
      </div>

      {/* Loading state */}
      {rows === null && !error && (
        <div className="space-y-2 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
          <p className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("loadingRows")}
          </p>
        </div>
      )}

      {/* Error state — with retry */}
      {error && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Clock className="h-6 w-6 text-destructive/40" />
          <p className="text-xs text-muted-foreground">{t("error")}</p>
          <button
            onClick={() => {
              setError(false);
              setReloadKey((k) => k + 1);
            }}
            className="rounded-md border border-border/60 px-3 py-1 text-xs hover:bg-muted"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {/* Empty state */}
      {rows && rows.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Clock className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">{t("empty")}</p>
        </div>
      )}

      {/* Data state */}
      {rows && rows.length > 0 && (
        <>
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("columns.time")}</TableHead>
                  <TableHead className="text-xs">{t("columns.lat")}</TableHead>
                  <TableHead className="text-xs">{t("columns.lng")}</TableHead>
                  <TableHead className="text-xs">{t("columns.accuracy")}</TableHead>
                  <TableHead className="text-xs">{t("columns.note")}</TableHead>
                  <TableHead className="text-xs">{t("columns.source")}</TableHead>
                  <TableHead className="text-xs">{t("columns.enteredBy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="text-xs">
                    <TableCell className="font-mono text-muted-foreground">
                      {formatBangkokTime(r.recorded_at)}
                    </TableCell>
                    <TableCell className="font-mono">{r.lat.toFixed(6)}</TableCell>
                    <TableCell className="font-mono">{r.lng.toFixed(6)}</TableCell>
                    <TableCell className="font-mono">
                      {r.accuracy_m != null ? `±${r.accuracy_m} m` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.note ?? undefined}>
                      {r.note ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.source === "csv_import" ? "outline" : "secondary"} className="text-[10px]">
                        {formatSourceLabel(r.source)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.entered_by_name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 && (
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label={t("pagination.previous")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground">
                {t("pagination.pageOf", { page, pageCount })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                aria-label={t("pagination.next")}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
