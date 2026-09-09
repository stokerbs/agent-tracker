"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeUp } from "@/components/shared/motion";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { createDraftOnDay, moveMasterToDay, rescheduleMaster, scheduleMasterToDay, unscheduleMaster } from "./actions";
import { CalendarToolbar } from "./calendar-toolbar";
import { DayCell, DayRow } from "./day-cell";
import {
  DEFAULT_SCHEDULE_TIME,
  THAI_WEEKDAYS_SHORT,
  buildBangkokISO,
  dayKeyInBangkok,
  isSameMonth,
  monthGrid,
  shiftToDay,
  weekDays,
  type CalendarView,
  type DayKey,
} from "./date-utils";
import { UnscheduledPanel, UnscheduledSheet } from "./unscheduled-panel";
import { itemInstant, type CalendarFilters, type CalendarItem } from "./types";

export interface DragPayload {
  id: string;
  from: "calendar" | "unscheduled";
}
export const DRAG_MIME = "application/x-studio-master";

type ItemPatch =
  | { type: "place"; item: CalendarItem; scheduled_at: string }
  | { type: "remove"; id: string };

interface Props {
  view: CalendarView;
  dateKey: DayKey;
  todayKey: DayKey;
  items: CalendarItem[];
  unscheduled: CalendarItem[];
  filters: CalendarFilters;
}

/**
 * Client island for the whole calendar. Server data comes in as props; every
 * mutation is applied optimistically via useOptimistic inside a transition,
 * so a failed action reverts on its own and a successful one is replaced by
 * the refreshed server payload.
 */
export function CalendarBoard({ view, dateKey, todayKey, items, unscheduled, filters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [overDay, setOverDay] = useState<DayKey | null>(null);

  const [optItems, patchItems] = useOptimistic(items, (state: CalendarItem[], patch: ItemPatch) => {
    if (patch.type === "remove") return state.filter((i) => i.id !== patch.id);
    const next: CalendarItem = { ...patch.item, scheduled_at: patch.scheduled_at, status: "scheduled" };
    const idx = state.findIndex((i) => i.id === patch.item.id);
    if (idx === -1) return [...state, next];
    const copy = state.slice();
    copy[idx] = next;
    return copy;
  });
  const [optUnscheduled, patchUnscheduled] = useOptimistic(unscheduled, (state: CalendarItem[], patch: ItemPatch) => {
    if (patch.type === "remove") return state.filter((i) => i.id !== patch.id);
    if (state.some((i) => i.id === patch.item.id)) return state;
    return [{ ...patch.item, scheduled_at: null, status: "approved" }, ...state];
  });

  const days = useMemo(() => (view === "week" ? weekDays(dateKey) : monthGrid(dateKey)), [view, dateKey]);
  const itemsByDay = useMemo(() => {
    const map = new Map<DayKey, CalendarItem[]>();
    for (const item of optItems) {
      const instant = itemInstant(item);
      if (!instant) continue;
      const key = dayKeyInBangkok(instant);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => (itemInstant(a) ?? "").localeCompare(itemInstant(b) ?? ""));
    return map;
  }, [optItems]);

  const run = useCallback(
    (
      work: () => Promise<{ ok: true } | { ok: false; error: string }>,
      optimistic: () => void,
      successMessage: string,
    ) => {
      startTransition(async () => {
        optimistic();
        const res = await work();
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(successMessage);
        router.refresh();
      });
    },
    [router],
  );

  // ─── Drag & drop ──────────────────────────────────────────────────────────
  const onDragStart = useCallback((payload: DragPayload, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.setData("text/plain", payload.id);
    setDragging(payload);
  }, []);

  const onDragEnd = useCallback(() => {
    setDragging(null);
    setOverDay(null);
  }, []);

  const onDropOnDay = useCallback(
    (day: DayKey, e: React.DragEvent) => {
      e.preventDefault();
      setOverDay(null);
      let payload = dragging;
      if (!payload) {
        try {
          payload = JSON.parse(e.dataTransfer.getData(DRAG_MIME)) as DragPayload;
        } catch {
          payload = null;
        }
      }
      setDragging(null);
      if (!payload) return;

      if (payload.from === "unscheduled") {
        const source = optUnscheduled.find((i) => i.id === payload!.id);
        if (!source) return;
        const iso = buildBangkokISO(day, DEFAULT_SCHEDULE_TIME);
        run(
          () => scheduleMasterToDay(source.id, day, DEFAULT_SCHEDULE_TIME),
          () => {
            patchUnscheduled({ type: "remove", id: source.id });
            patchItems({ type: "place", item: source, scheduled_at: iso });
          },
          `ตั้งเวลา "${source.title}" แล้ว (${DEFAULT_SCHEDULE_TIME})`,
        );
        return;
      }

      const source = optItems.find((i) => i.id === payload!.id);
      if (!source?.scheduled_at) return;
      if (dayKeyInBangkok(source.scheduled_at) === day) return;
      const iso = shiftToDay(source.scheduled_at, day);
      run(
        () => moveMasterToDay(source.id, day),
        () => patchItems({ type: "place", item: source, scheduled_at: iso }),
        `ย้าย "${source.title}" แล้ว`,
      );
    },
    [dragging, optItems, optUnscheduled, patchItems, patchUnscheduled, run],
  );

  // ─── Card menu + create popover handlers ──────────────────────────────────
  const onEditTime = useCallback(
    (item: CalendarItem, day: DayKey, time: string) => {
      const iso = buildBangkokISO(day, time);
      run(
        () => rescheduleMaster(item.id, iso),
        () => patchItems({ type: "place", item, scheduled_at: iso }),
        `เปลี่ยนเวลาเป็น ${time} แล้ว`,
      );
    },
    [patchItems, run],
  );

  const onUnschedule = useCallback(
    (item: CalendarItem) => {
      run(
        () => unscheduleMaster(item.id),
        () => {
          patchItems({ type: "remove", id: item.id });
          patchUnscheduled({ type: "place", item, scheduled_at: "" });
        },
        `เอา "${item.title}" ออกจากปฏิทินแล้ว`,
      );
    },
    [patchItems, patchUnscheduled, run],
  );

  const onScheduleExisting = useCallback(
    (item: CalendarItem, day: DayKey, time: string) => {
      const iso = buildBangkokISO(day, time);
      run(
        () => scheduleMasterToDay(item.id, day, time),
        () => {
          patchUnscheduled({ type: "remove", id: item.id });
          patchItems({ type: "place", item, scheduled_at: iso });
        },
        `ตั้งเวลา "${item.title}" แล้ว (${time})`,
      );
    },
    [patchItems, patchUnscheduled, run],
  );

  const onCreateDraft = useCallback(
    (day: DayKey, time: string, title: string) => {
      startTransition(async () => {
        const res = await createDraftOnDay({ day, time, title: title || undefined });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("สร้างร่างแล้ว — กำลังเปิดตัวแก้ไข");
        router.push(`/studio/content/${res.data.id}`);
      });
    },
    [router],
  );

  const cellProps = {
    todayKey,
    pending,
    unscheduled: optUnscheduled,
    dragging,
    onDragStart,
    onDragEnd,
    onDragEnter: setOverDay,
    onDrop: onDropOnDay,
    onEditTime,
    onUnschedule,
    onScheduleExisting,
    onCreateDraft,
  };

  const visibleDays = view === "week" ? days : days.filter((d) => isSameMonth(d, dateKey));
  const monthHasItems = visibleDays.some((d) => (itemsByDay.get(d)?.length ?? 0) > 0);
  const hasFilters = !!(filters.platform || filters.status || filters.pillars.length);

  return (
    <div className="space-y-4">
      <FadeUp>
        <PageHeader title="ปฏิทินคอนเทนต์" description="ลากการ์ดเพื่อเลื่อนวัน · คลิกวันว่างเพื่อวางคอนเทนต์ · เวลาเป็นเวลาไทย (Asia/Bangkok)">
          <UnscheduledSheet items={optUnscheduled} pending={pending} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        </PageHeader>
      </FadeUp>

      <FadeUp delay={0.04}>
        <CalendarToolbar view={view} dateKey={dateKey} todayKey={todayKey} filters={filters} />
      </FadeUp>

      <FadeUp delay={0.08} className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {/* Desktop / tablet grid */}
          <div className={cn("hidden overflow-hidden rounded-xl border border-border/60 bg-card md:block", pending && "cursor-progress")}>
            <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30 text-center text-[11px] font-medium text-muted-foreground">
              {THAI_WEEKDAYS_SHORT.map((w, i) => (
                <div key={w} className={cn("py-2", i >= 5 && "text-muted-foreground/70")}>
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => (
                <DayCell
                  key={day}
                  dayKey={day}
                  inMonth={view === "week" || isSameMonth(day, dateKey)}
                  expanded={view === "week"}
                  isOver={overDay === day}
                  items={itemsByDay.get(day) ?? []}
                  {...cellProps}
                />
              ))}
            </div>
          </div>

          {/* Phone: stacked day list */}
          <div className="space-y-2 md:hidden">
            {visibleDays.map((day) => (
              <DayRow key={day} dayKey={day} items={itemsByDay.get(day) ?? []} {...cellProps} />
            ))}
          </div>

          {!monthHasItems && (
            <div className="mt-3 rounded-xl border border-dashed border-border/60">
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" />}
                title={hasFilters ? "ไม่มีคอนเทนต์ที่ตรงกับตัวกรองในช่วงนี้" : "ยังไม่มีคอนเทนต์ในช่วงนี้"}
                description={
                  hasFilters
                    ? "ลองล้างตัวกรอง หรือเปลี่ยนเดือน"
                    : "คลิกวันว่างเพื่อวางคอนเทนต์ที่อนุมัติแล้ว หรือลากจากรายการ “ยังไม่ตั้งเวลา” ทางขวา"
                }
              />
            </div>
          )}
        </div>

        <UnscheduledPanel items={optUnscheduled} pending={pending} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      </FadeUp>
    </div>
  );
}
