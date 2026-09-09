import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTENT_STATUS_META,
  FORMAT_META,
  IDEA_ORIGIN_META,
  IDEA_STATUS_META,
  PILLAR_META,
  PLATFORM_META,
  PRIVACY_STATUS_META,
  SENSITIVITY_META,
  SOURCE_KIND_META,
  SUPPORT_STATUS_META,
} from "@/lib/studio/constants";
import type {
  AiScores,
  ContentFormat,
  ContentStatus,
  IdeaOrigin,
  IdeaStatus,
  Pillar,
  Platform,
  PrivacyStatus,
  Sensitivity,
  SourceKind,
  SupportStatus,
} from "@/lib/studio/types";

/** Shared pill. Every studio badge renders through this so sizes stay consistent. */
export function Pill({ className, dot, children, title }: { className?: string; dot?: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", className)}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export function PillarBadge({ pillar, className }: { pillar: Pillar | string; className?: string }) {
  const m = PILLAR_META[pillar as Pillar];
  if (!m) return <Pill className={cn("bg-muted text-muted-foreground border-border", className)}>{pillar}</Pill>;
  return (
    <Pill className={cn(m.badge, className)} dot={m.dot} title={m.description}>
      {m.label}
    </Pill>
  );
}

export function PlatformChip({ platform, className, short }: { platform: Platform | string; className?: string; short?: boolean }) {
  const m = PLATFORM_META[platform as Platform];
  if (!m) return <Pill className={cn("bg-muted text-muted-foreground border-border", className)}>{platform}</Pill>;
  return <Pill className={cn(m.badge, className)}>{short ? m.short : m.label}</Pill>;
}

export function PlatformChips({ platforms, max = 3, className }: { platforms: (Platform | string)[]; max?: number; className?: string }) {
  const shown = platforms.slice(0, max);
  const rest = platforms.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((p) => (
        <PlatformChip key={p} platform={p} short />
      ))}
      {rest > 0 && <Pill className="bg-muted text-muted-foreground border-border">+{rest}</Pill>}
    </span>
  );
}

export function ContentStatusBadge({ status, className }: { status: ContentStatus | string; className?: string }) {
  const m = CONTENT_STATUS_META[status as ContentStatus];
  if (!m) return <Pill className={cn("bg-muted text-muted-foreground border-border", className)}>{status}</Pill>;
  return (
    <Pill className={cn(m.badge, className)} dot={m.dot}>
      {m.label}
    </Pill>
  );
}

export function IdeaStatusBadge({ status, className }: { status: IdeaStatus | string; className?: string }) {
  const m = IDEA_STATUS_META[status as IdeaStatus];
  return <Pill className={cn(m?.badge ?? "bg-muted text-muted-foreground border-border", className)}>{m?.label ?? status}</Pill>;
}

export function IdeaOriginBadge({ origin, className }: { origin: IdeaOrigin | string; className?: string }) {
  const m = IDEA_ORIGIN_META[origin as IdeaOrigin];
  return <Pill className={cn(m?.badge ?? "bg-muted text-muted-foreground border-border", className)}>{m?.label ?? origin}</Pill>;
}

export function FormatBadge({ format, className }: { format: ContentFormat | string | null; className?: string }) {
  if (!format) return null;
  const m = FORMAT_META[format as ContentFormat];
  return <Pill className={cn(m?.badge ?? "bg-muted text-muted-foreground border-border", className)}>{m?.label ?? format}</Pill>;
}

export function SensitivityBadge({ level, className }: { level: Sensitivity | string; className?: string }) {
  const m = SENSITIVITY_META[level as Sensitivity];
  return <Pill className={cn(m?.badge ?? "bg-muted text-muted-foreground border-border", className)}>{m?.label ?? level}</Pill>;
}

export function PrivacyBadge({ status, className, size = "sm" }: { status: PrivacyStatus | string | null; className?: string; size?: "sm" | "md" }) {
  if (!status) return <Pill className={cn("bg-muted text-muted-foreground border-border", className)}>ยังไม่ตรวจ</Pill>;
  const m = PRIVACY_STATUS_META[status as PrivacyStatus];
  return (
    <Pill className={cn(m?.badge ?? "bg-muted text-muted-foreground border-border", size === "md" && "px-2.5 py-1 text-xs", className)} dot={m?.dot}>
      {m?.label ?? status}
    </Pill>
  );
}

export function SupportBadge({ status, className }: { status: SupportStatus | string; className?: string }) {
  const m = SUPPORT_STATUS_META[status as SupportStatus];
  return <Pill className={cn(m?.badge ?? "bg-muted text-muted-foreground border-border", className)}>{m?.label ?? status}</Pill>;
}

export function SourceKindBadge({ kind, className }: { kind: SourceKind | string; className?: string }) {
  const m = SOURCE_KIND_META[kind as SourceKind];
  return (
    <Pill className={cn(m?.badge ?? "bg-muted text-muted-foreground border-border", className)}>
      {m?.warn ? <AlertTriangle className="h-3 w-3" /> : null}
      {m?.label ?? kind}
    </Pill>
  );
}

/** Approved-for-content marker used across knowledge/cases/questions. */
export function ApprovedBadge({ approved, className }: { approved: boolean; className?: string }) {
  return approved ? (
    <Pill className={cn("bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", className)} dot="bg-emerald-500">
      ใช้กับ AI ได้
    </Pill>
  ) : (
    <Pill className={cn("bg-muted text-muted-foreground border-border", className)}>ยังไม่อนุมัติให้ AI ใช้</Pill>
  );
}

/** AI score strip — always labelled as an estimate. */
export function ScoreStrip({ scores, className }: { scores: AiScores | null | undefined; className?: string }) {
  if (!scores) return null;
  const items: { k: keyof AiScores; label: string }[] = [
    { k: "hook", label: "Hook" },
    { k: "educational", label: "ความรู้" },
    { k: "conversion", label: "โอกาสขาย" },
    { k: "originality", label: "ความใหม่" },
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground", className)} title={scores.rationale ?? undefined}>
      <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400">
        <Sparkles className="h-3 w-3" /> AI ประเมิน
      </span>
      {items.map(({ k, label }) => {
        const v = Number(scores[k] ?? 0);
        return (
          <span key={k} className="inline-flex items-center gap-1">
            {label}
            <span className="inline-flex gap-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < v ? "bg-foreground/70" : "bg-foreground/15")} />
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}
