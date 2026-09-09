"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTENT_STATUS_META, PILLARS, PILLAR_META, PLATFORMS, PLATFORM_META } from "@/lib/studio/constants";
import type { Pillar, Platform } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { addDays, addMonths, formatThaiMonth, formatThaiWeekRange, type CalendarView, type DayKey } from "./date-utils";
import type { CalendarFilters } from "./types";

const STATUS_OPTIONS = ["scheduled", "approved", "published", "draft", "review"] as const;
const ALL = "__all";

interface Props {
  view: CalendarView;
  dateKey: DayKey;
  todayKey: DayKey;
  filters: CalendarFilters;
}

/** Navigation + view toggle + filters. All state lives in the URL. */
export function CalendarToolbar({ view, dateKey, todayKey, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const step = (dir: -1 | 1) => push({ date: view === "week" ? addDays(dateKey, dir * 7) : addMonths(dateKey, dir) });
  const togglePillar = (p: Pillar) => {
    const next = filters.pillars.includes(p) ? filters.pillars.filter((x) => x !== p) : [...filters.pillars, p];
    push({ pillar: next.join(",") });
  };
  const hasFilters = !!(filters.platform || filters.status || filters.pillars.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(-1)} aria-label="ก่อนหน้า">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label="ถัดไป">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => push({ date: todayKey })} disabled={dateKey === todayKey}>
            วันนี้
          </Button>
        </div>

        <h2 className="min-w-[10rem] text-base font-semibold tracking-tight">
          {view === "week" ? formatThaiWeekRange(dateKey) : formatThaiMonth(dateKey)}
        </h2>

        <div className="ml-auto inline-flex rounded-md border border-border/60 bg-muted/30 p-0.5 text-xs">
          {(["month", "week"] as CalendarView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => push({ view: v })}
              className={cn(
                "rounded px-3 py-1 font-medium transition-colors",
                view === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={view === v}
            >
              {v === "month" ? "เดือน" : "สัปดาห์"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.platform ?? ALL} onValueChange={(v) => push({ platform: v === ALL ? null : v })}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="ทุกแพลตฟอร์ม" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกแพลตฟอร์ม</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {PLATFORM_META[p as Platform].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status ?? ALL} onValueChange={(v) => push({ status: v === ALL ? null : v })}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="ทุกสถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>ทุกสถานะ</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {CONTENT_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap items-center gap-1">
          {PILLARS.map((p) => {
            const m = PILLAR_META[p];
            const active = filters.pillars.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePillar(p)}
                aria-pressed={active}
                title={m.description}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active ? m.badge : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
                {m.label}
              </button>
            );
          })}
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => push({ platform: null, status: null, pillar: null })}>
            <X className="h-3 w-3" /> ล้างตัวกรอง
          </Button>
        )}
      </div>
    </div>
  );
}
