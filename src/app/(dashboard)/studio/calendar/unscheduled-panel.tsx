"use client";

import Link from "next/link";
import { GripVertical, Inbox } from "lucide-react";
import { PillarBadge, PlatformChip } from "@/components/studio/badges";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PILLAR_META } from "@/lib/studio/constants";
import type { Pillar } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import type { DragPayload } from "./calendar-board";
import type { CalendarItem } from "./types";

interface ListProps {
  items: CalendarItem[];
  pending: boolean;
  onDragStart: (payload: DragPayload, e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function UnscheduledList({ items, pending, onDragStart, onDragEnd }: ListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">ไม่มีคอนเทนต์ที่อนุมัติแล้วรอตั้งเวลา</p>
        <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
          <Link href="/studio/content?status=review">ดูรายการรอตรวจ</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const pillar = PILLAR_META[item.pillar as Pillar];
        return (
          <li
            key={item.id}
            draggable={!pending}
            onDragStart={(e) => onDragStart({ id: item.id, from: "unscheduled" }, e)}
            onDragEnd={onDragEnd}
            className={cn(
              "group flex items-stretch overflow-hidden rounded-md border border-border/60 bg-card text-xs shadow-sm transition-all hover:border-border hover:shadow",
              pending ? "opacity-60" : "cursor-grab active:cursor-grabbing",
            )}
          >
            <span className={cn("w-[3px] shrink-0", pillar?.dot ?? "bg-slate-400")} aria-hidden />
            <Link href={`/studio/content/${item.id}`} className="min-w-0 flex-1 px-2 py-1.5" title={item.title}>
              <p className="truncate font-medium">{item.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <PillarBadge pillar={item.pillar} />
                {item.primary_platform && <PlatformChip platform={item.primary_platform} short />}
              </div>
            </Link>
            <span className="flex w-5 items-center justify-center text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Right-hand column on lg+: drag these onto any day. */
export function UnscheduledPanel(props: ListProps) {
  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-4 rounded-xl border border-border/60 bg-card">
        <div className="border-b border-border/60 px-3 py-2.5">
          <p className="text-sm font-medium">ยังไม่ตั้งเวลา</p>
          <p className="text-[11px] text-muted-foreground">อนุมัติแล้ว {props.items.length} รายการ · ลากไปวางบนวันที่ต้องการ (ค่าเริ่มต้น 19:00)</p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          <UnscheduledList {...props} />
        </div>
      </div>
    </aside>
  );
}

/** Same list as a drawer below lg (touch devices use the day popover to place). */
export function UnscheduledSheet(props: ListProps) {
  return (
    <div className="lg:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Inbox className="h-3.5 w-3.5" /> ยังไม่ตั้งเวลา
            {props.items.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{props.items.length}</span>}
          </Button>
        </SheetTrigger>
        <SheetContent className="px-4 pb-6">
          <SheetHeader className="text-left">
            <SheetTitle>ยังไม่ตั้งเวลา</SheetTitle>
            <SheetDescription>คอนเทนต์ที่อนุมัติแล้วแต่ยังไม่มีวันเผยแพร่ — แตะ + บนวันในปฏิทินเพื่อวางคอนเทนต์เหล่านี้</SheetDescription>
          </SheetHeader>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            <UnscheduledList {...props} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
