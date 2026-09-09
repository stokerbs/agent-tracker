"use client";

import { useState } from "react";
import { CalendarPlus, Clock, ListChecks, Sparkles } from "lucide-react";
import { PillarBadge, PlatformChip } from "@/components/studio/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_SCHEDULE_TIME, formatThaiDayLong, isTimeString, type DayKey } from "./date-utils";
import type { CalendarItem } from "./types";

interface Props {
  dayKey: DayKey;
  unscheduled: CalendarItem[];
  pending: boolean;
  onSchedule: (item: CalendarItem, time: string) => void;
  onCreate: (title: string, time: string) => void;
}

/**
 * "สร้างคอนเทนต์ในวันนี้" — body of the day popover. Two paths: place an
 * already-approved master (goes live as scheduled) or start a fresh draft
 * pre-dated to this day (opens the editor).
 */
export function CreateOnDayContent({ dayKey, unscheduled, pending, onSchedule, onCreate }: Props) {
  const [mode, setMode] = useState<"pick" | "new">(unscheduled.length ? "pick" : "new");
  const [time, setTime] = useState(DEFAULT_SCHEDULE_TIME);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const timeOk = isTimeString(time);
  const filtered = query.trim() ? unscheduled.filter((i) => i.title.toLowerCase().includes(query.trim().toLowerCase())) : unscheduled;

  return (
    <div className="text-sm">
      <div className="border-b border-border/60 px-3 py-2.5">
        <p className="font-medium">สร้างคอนเทนต์ในวันนี้</p>
        <p className="text-xs text-muted-foreground">{formatThaiDayLong(dayKey)}</p>
      </div>

      <div className="flex gap-1 p-2">
        <ModeButton active={mode === "pick"} onClick={() => setMode("pick")} icon={<ListChecks className="h-3.5 w-3.5" />}>
          เลือกจากที่อนุมัติแล้ว
          {unscheduled.length > 0 && <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{unscheduled.length}</span>}
        </ModeButton>
        <ModeButton active={mode === "new"} onClick={() => setMode("new")} icon={<Sparkles className="h-3.5 w-3.5" />}>
          สร้างใหม่
        </ModeButton>
      </div>

      <div className="flex items-center gap-2 px-3 pb-2">
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <label className="text-xs text-muted-foreground" htmlFor={`time-${dayKey}`}>
          เวลาเผยแพร่
        </label>
        <Input id={`time-${dayKey}`} type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className="h-8 w-28 text-xs" />
      </div>

      {mode === "pick" ? (
        <div className="border-t border-border/60">
          {unscheduled.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              ยังไม่มีคอนเทนต์ที่อนุมัติแล้วรอตั้งเวลา — สร้างใหม่ หรืออนุมัติร่างที่มีอยู่ก่อน
            </p>
          ) : (
            <>
              {unscheduled.length > 5 && (
                <div className="px-3 pt-2">
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ…" className="h-8 text-xs" />
                </div>
              )}
              <ul className="max-h-64 space-y-1 overflow-y-auto p-2">
                {filtered.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium" title={item.title}>
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1">
                        <PillarBadge pillar={item.pillar} />
                        {item.primary_platform && <PlatformChip platform={item.primary_platform} short />}
                      </div>
                    </div>
                    <Button size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={pending || !timeOk} onClick={() => onSchedule(item, time)}>
                      ตั้งเวลา
                    </Button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">ไม่พบชื่อที่ค้นหา</li>}
              </ul>
            </>
          )}
        </div>
      ) : (
        <form
          className="space-y-2 border-t border-border/60 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!timeOk) return;
            onCreate(title.trim(), time);
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="ชื่อคอนเทนต์ (ใส่ทีหลังได้)" className="h-9 text-sm" autoFocus />
          <p className="text-[11px] text-muted-foreground">จะสร้างเป็นร่างที่กำหนดวันไว้ล่วงหน้า แล้วเปิดตัวแก้ไขให้ทันที — ขึ้นปฏิทินจริงเมื่ออนุมัติแล้ว</p>
          <Button type="submit" size="sm" className="w-full" disabled={pending || !timeOk}>
            <CalendarPlus className="h-3.5 w-3.5" /> สร้างร่างและเปิดตัวแก้ไข
          </Button>
        </form>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
