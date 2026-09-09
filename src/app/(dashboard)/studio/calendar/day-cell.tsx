"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DragPayload } from "./calendar-board";
import { ContentCard } from "./content-card";
import { CreateOnDayContent } from "./create-popover";
import { THAI_WEEKDAYS_SHORT, formatThaiDayLong, formatThaiDayShort, parseDayKey, weekdayIndex, type DayKey } from "./date-utils";
import type { CalendarItem } from "./types";

const MAX_VISIBLE = 3;

export interface DayHandlers {
  todayKey: DayKey;
  pending: boolean;
  unscheduled: CalendarItem[];
  dragging: DragPayload | null;
  onDragStart: (payload: DragPayload, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragEnter: (day: DayKey | null) => void;
  onDrop: (day: DayKey, e: React.DragEvent) => void;
  onEditTime: (item: CalendarItem, day: DayKey, time: string) => void;
  onUnschedule: (item: CalendarItem) => void;
  onScheduleExisting: (item: CalendarItem, day: DayKey, time: string) => void;
  onCreateDraft: (day: DayKey, time: string, title: string) => void;
}

interface CellProps extends DayHandlers {
  dayKey: DayKey;
  items: CalendarItem[];
  inMonth: boolean;
  expanded: boolean;
  isOver: boolean;
}

/** Grid cell (md+). Click on empty space opens the create popover. */
export function DayCell({ dayKey, items, inMonth, expanded, isOver, ...h }: CellProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const isToday = dayKey === h.todayKey;
  const dayNum = parseDayKey(dayKey).d;
  const visible = expanded ? items : items.slice(0, MAX_VISIBLE);
  const hidden = items.length - visible.length;
  const weekend = weekdayIndex(dayKey) >= 5;

  const openCreate = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-card],[data-popover]")) return;
    setCreateOpen(true);
  };

  return (
    <Popover open={createOpen} onOpenChange={setCreateOpen}>
      <PopoverAnchor asChild>
        <div
          role="gridcell"
          aria-label={formatThaiDayLong(dayKey)}
          onClick={openCreate}
          onDragOver={(e) => {
            if (!h.dragging) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDragEnter={() => h.dragging && h.onDragEnter(dayKey)}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) h.onDragEnter(null);
          }}
          onDrop={(e) => h.onDrop(dayKey, e)}
          className={cn(
            "group/cell relative flex flex-col gap-1 border-b border-r border-border/60 p-1.5 transition-colors",
            expanded ? "min-h-[26rem]" : "min-h-[7.5rem]",
            !inMonth && "bg-muted/20",
            weekend && inMonth && "bg-muted/10",
            h.dragging && "cursor-copy",
            isOver && "bg-primary/5 ring-1 ring-inset ring-primary/40",
            !h.dragging && "hover:bg-accent/40",
          )}
        >
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums",
                isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50",
              )}
            >
              {dayNum}
            </span>
            <button
              type="button"
              aria-label="สร้างคอนเทนต์ในวันนี้"
              onClick={(e) => {
                e.stopPropagation();
                setCreateOpen(true);
              }}
              className="rounded p-0.5 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/cell:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {visible.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                dayKey={dayKey}
                pending={h.pending}
                compact={!expanded}
                onDragStart={h.onDragStart}
                onDragEnd={h.onDragEnd}
                onEditTime={h.onEditTime}
                onUnschedule={h.onUnschedule}
              />
            ))}
            {hidden > 0 && <MoreCards dayKey={dayKey} items={items} {...h} />}
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-80 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <CreateOnDayContent
          dayKey={dayKey}
          unscheduled={h.unscheduled}
          pending={h.pending}
          onSchedule={(item, time) => {
            h.onScheduleExisting(item, dayKey, time);
            setCreateOpen(false);
          }}
          onCreate={(title, time) => {
            h.onCreateDraft(dayKey, time, title);
            setCreateOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** "+N" expander: all of the day's cards in a popover, still draggable. */
function MoreCards({ dayKey, items, ...h }: DayHandlers & { dayKey: DayKey; items: CalendarItem[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-popover
          onClick={(e) => e.stopPropagation()}
          className="rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/10"
        >
          +{items.length - MAX_VISIBLE} รายการ
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {formatThaiDayLong(dayKey)} · {items.length} รายการ
        </p>
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              dayKey={dayKey}
              pending={h.pending}
              onDragStart={h.onDragStart}
              onDragEnd={h.onDragEnd}
              onEditTime={h.onEditTime}
              onUnschedule={h.onUnschedule}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Phone layout (<md): one stacked row per day. Empty days stay compact. */
export function DayRow({ dayKey, items, ...h }: DayHandlers & { dayKey: DayKey; items: CalendarItem[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const isToday = dayKey === h.todayKey;

  return (
    <div className={cn("rounded-lg border border-border/60 bg-card", isToday && "border-primary/40")}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums", isToday && "bg-primary text-primary-foreground")}>
            {parseDayKey(dayKey).d}
          </span>
          <span className={cn("font-medium", items.length === 0 && "text-muted-foreground")}>
            {THAI_WEEKDAYS_SHORT[weekdayIndex(dayKey)]} {formatThaiDayShort(dayKey)}
          </span>
          {items.length > 0 && <span className="text-xs text-muted-foreground">· {items.length}</span>}
        </div>
        <Popover open={createOpen} onOpenChange={setCreateOpen}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="สร้างคอนเทนต์ในวันนี้" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0">
            <CreateOnDayContent
              dayKey={dayKey}
              unscheduled={h.unscheduled}
              pending={h.pending}
              onSchedule={(item, time) => {
                h.onScheduleExisting(item, dayKey, time);
                setCreateOpen(false);
              }}
              onCreate={(title, time) => {
                h.onCreateDraft(dayKey, time, title);
                setCreateOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {items.length > 0 && (
        <div className="space-y-1.5 border-t border-border/60 p-2">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              dayKey={dayKey}
              pending={h.pending}
              onDragStart={h.onDragStart}
              onDragEnd={h.onDragEnd}
              onEditTime={h.onEditTime}
              onUnschedule={h.onUnschedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
