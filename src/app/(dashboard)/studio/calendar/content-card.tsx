"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarX2, Clock, ExternalLink, GripVertical, MoreHorizontal } from "lucide-react";
import { ContentStatusBadge, PillarBadge, PlatformChip } from "@/components/studio/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONTENT_STATUS_META, PILLAR_META } from "@/lib/studio/constants";
import type { ContentStatus, Pillar } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import type { DragPayload } from "./calendar-board";
import { isTimeString, timeInBangkok, type DayKey } from "./date-utils";
import { DRAGGABLE_STATUSES, itemInstant, type CalendarItem } from "./types";

interface Props {
  item: CalendarItem;
  dayKey: DayKey;
  pending: boolean;
  from?: DragPayload["from"];
  /** Compact = month cell; full = week cell / phone list / popover. */
  compact?: boolean;
  onDragStart: (payload: DragPayload, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onEditTime?: (item: CalendarItem, day: DayKey, time: string) => void;
  onUnschedule?: (item: CalendarItem) => void;
}

export function isDraggable(item: CalendarItem): boolean {
  return (DRAGGABLE_STATUSES as readonly string[]).includes(item.status);
}

/**
 * One master on the calendar. Approved/scheduled cards drag; published cards
 * are fixed history; draft/review cards (pre-dated from "สร้างใหม่") render as
 * dashed "plans" until they pass approval.
 */
export function ContentCard({ item, dayKey, pending, from = "calendar", compact, onDragStart, onDragEnd, onEditTime, onUnschedule }: Props) {
  const draggable = isDraggable(item) && !pending;
  const isPlan = item.status === "draft" || item.status === "review";
  const instant = itemInstant(item);
  const time = instant ? timeInBangkok(instant) : "--:--";
  const pillar = PILLAR_META[item.pillar as Pillar];
  const statusDot = CONTENT_STATUS_META[item.status as ContentStatus]?.dot ?? "bg-slate-400";
  const href = `/studio/content/${item.id}`;

  return (
    <div
      data-card
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return e.preventDefault();
        onDragStart({ id: item.id, from }, e);
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "group/card relative flex items-stretch overflow-hidden rounded-md border bg-card text-[11px] leading-4 shadow-sm transition-all",
        "hover:border-border hover:shadow",
        isPlan ? "border-dashed border-border/70 opacity-75" : "border-border/60",
        draggable && "cursor-grab active:cursor-grabbing",
        pending && "opacity-60",
      )}
    >
      <span className={cn("w-[3px] shrink-0", pillar?.dot ?? "bg-slate-400")} aria-hidden />
      <Link href={href} className="min-w-0 flex-1 px-1.5 py-1" title={item.title}>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{time}</span>
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} title={CONTENT_STATUS_META[item.status as ContentStatus]?.label} />
          {isPlan && <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">แผน</span>}
          {draggable && <GripVertical className="ml-auto h-3 w-3 text-muted-foreground/40 opacity-0 transition-opacity group-hover/card:opacity-100" />}
        </div>
        <p className={cn("truncate font-medium text-foreground", compact ? "mt-0.5" : "mt-1 text-xs")}>{item.title}</p>
        <div className={cn("mt-1 flex flex-wrap items-center gap-1", compact && "hidden xl:flex")}>
          {compact ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {pillar?.label ?? item.pillar}
            </span>
          ) : (
            <PillarBadge pillar={item.pillar} />
          )}
          {item.primary_platform && <PlatformChip platform={item.primary_platform} short />}
          {!compact && <ContentStatusBadge status={item.status} />}
        </div>
      </Link>
      {(onEditTime || onUnschedule) && isDraggable(item) && (
        <CardMenu item={item} dayKey={dayKey} time={time} pending={pending} href={href} onEditTime={onEditTime} onUnschedule={onUnschedule} />
      )}
    </div>
  );
}

function CardMenu({
  item,
  dayKey,
  time,
  pending,
  href,
  onEditTime,
  onUnschedule,
}: {
  item: CalendarItem;
  dayKey: DayKey;
  time: string;
  pending: boolean;
  href: string;
  onEditTime?: (item: CalendarItem, day: DayKey, time: string) => void;
  onUnschedule?: (item: CalendarItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(time);
  const canUnschedule = item.status === "scheduled" && !!onUnschedule;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(time);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="ตัวเลือก"
          onClick={(e) => e.stopPropagation()}
          className="flex w-5 shrink-0 items-center justify-center text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/card:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="truncate text-sm font-medium" title={item.title}>
          {item.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <ContentStatusBadge status={item.status} />
          <PillarBadge pillar={item.pillar} />
        </div>

        <div className="mt-3 space-y-2">
          <Button asChild variant="outline" size="sm" className="w-full justify-start">
            <Link href={href}>
              <ExternalLink className="h-3.5 w-3.5" /> เปิดในตัวแก้ไข
            </Link>
          </Button>

          {onEditTime && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!isTimeString(value)) return;
                onEditTime(item, dayKey, value);
                setOpen(false);
              }}
            >
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Input type="time" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 text-xs" step={300} aria-label="แก้เวลา" />
              <Button type="submit" size="sm" className="h-8" disabled={pending || value === time || !isTimeString(value)}>
                แก้เวลา
              </Button>
            </form>
          )}

          {canUnschedule && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => {
                onUnschedule?.(item);
                setOpen(false);
              }}
            >
              <CalendarX2 className="h-3.5 w-3.5" /> เอาออกจากปฏิทิน
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
