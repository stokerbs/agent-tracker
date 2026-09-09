import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_KIND_META } from "@/lib/studio/constants";
import type { SourceKind, SourceRef } from "@/lib/studio/types";
import { SourceKindBadge } from "./badges";

export interface SourceListItem extends SourceRef {
  note?: string | null;
  /** For case insights: the parent studio case id, so the link opens the case. */
  case_id?: string | null;
}

export function sourceHref(item: SourceListItem): string | null {
  if (!item.id) return null;
  switch (item.kind as SourceKind) {
    case "knowledge":
      return `/studio/knowledge/${item.id}`;
    case "case_insight":
      return item.case_id ? `/studio/cases/${item.case_id}#insight-${item.id}` : null;
    case "customer_question":
      return `/studio/knowledge?tab=questions&q=${encodeURIComponent(String(item.label ?? "").slice(0, 40))}`;
    default:
      return null;
  }
}

/**
 * "AI เอาข้อมูลนี้มาจากไหน?" — one-click answer. Groups by kind, links to the
 * record, and shouts when a piece leans on general AI knowledge.
 */
export function SourceList({ items, className, emptyText = "ยังไม่มีการอ้างอิงแหล่งข้อมูล" }: { items: SourceListItem[]; className?: string; emptyText?: string }) {
  // jsonb-sourced refs may be malformed — never let a bad row crash the page.
  const safe = (Array.isArray(items) ? items : []).filter((i): i is SourceListItem => !!i && typeof i === "object" && typeof i.kind === "string");
  if (!safe.length) return <p className={cn("text-xs text-muted-foreground", className)}>{emptyText}</p>;
  const general = safe.filter((i) => i.kind === "ai_general");
  const real = safe.filter((i) => i.kind !== "ai_general");
  return (
    <div className={cn("space-y-2", className)}>
      {real.map((s, i) => {
        const href = sourceHref(s);
        const body = (
          <>
            <SourceKindBadge kind={s.kind} />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{String(s.label ?? "")}</span>
            {href && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </>
        );
        return href ? (
          <Link key={`${s.kind}-${s.id}-${i}`} href={href} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-2 transition-colors hover:border-border hover:bg-accent">
            {body}
          </Link>
        ) : (
          <div key={`${s.kind}-${s.id}-${i}`} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-2">
            {body}
          </div>
        );
      })}
      {general.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {SOURCE_KIND_META.ai_general.label} — บางส่วนของคอนเทนต์นี้ไม่ได้มาจากคลังความรู้ของ Detective Pulse ตรวจสอบก่อนอนุมัติ
          </span>
        </div>
      )}
    </div>
  );
}
