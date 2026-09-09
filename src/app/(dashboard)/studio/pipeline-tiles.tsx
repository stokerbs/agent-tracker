import Link from "next/link";
import { CalendarClock, CheckCircle2, Eye, FileText, Lightbulb, Send } from "lucide-react";
import { CONTENT_STATUS_META } from "@/lib/studio/constants";
import { cn } from "@/lib/utils";
import type { PipelineCounts } from "./queries";

interface Tile {
  key: keyof PipelineCounts;
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
  dot: string;
}

const TILES: Tile[] = [
  { key: "ideas", label: "ไอเดีย", hint: "ใหม่ + บันทึกไว้ (ยังไม่ได้สร้างคอนเทนต์)", href: "/studio/ideas", icon: <Lightbulb className="h-4 w-4" />, dot: "bg-sky-400" },
  { key: "draft", label: CONTENT_STATUS_META.draft.label, href: "/studio/content?status=draft", icon: <FileText className="h-4 w-4" />, dot: CONTENT_STATUS_META.draft.dot! },
  { key: "review", label: CONTENT_STATUS_META.review.label, href: "/studio/content?status=review", icon: <Eye className="h-4 w-4" />, dot: CONTENT_STATUS_META.review.dot! },
  { key: "approved", label: "พร้อมเผยแพร่", hint: "อนุมัติแล้ว รอตั้งเวลา", href: "/studio/content?status=approved", icon: <CheckCircle2 className="h-4 w-4" />, dot: CONTENT_STATUS_META.approved.dot! },
  { key: "scheduled", label: CONTENT_STATUS_META.scheduled.label, href: "/studio/calendar", icon: <CalendarClock className="h-4 w-4" />, dot: CONTENT_STATUS_META.scheduled.dot! },
  { key: "published30d", label: CONTENT_STATUS_META.published.label, hint: "30 วันล่าสุด", href: "/studio/content?status=published", icon: <Send className="h-4 w-4" />, dot: CONTENT_STATUS_META.published.dot! },
];

/** Six clickable pipeline counters, in workflow order. Server component. */
export function PipelineTiles({ counts }: { counts: PipelineCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {TILES.map((t, i) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "group relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 transition-all duration-200",
            "hover:-translate-y-px hover:border-border hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="flex items-center justify-between">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
              {t.icon}
            </span>
            <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
          </div>
          <p className="mt-3 font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums">{counts[t.key]}</p>
          <p className="mt-1.5 truncate text-xs font-medium text-muted-foreground">{t.label}</p>
          {t.hint && <p className="mt-0.5 truncate text-[10px] text-muted-foreground/60">{t.hint}</p>}
          {i < TILES.length - 1 && (
            <span className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-border/80 xl:block" aria-hidden />
          )}
        </Link>
      ))}
    </div>
  );
}
