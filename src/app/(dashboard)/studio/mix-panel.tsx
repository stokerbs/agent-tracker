"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookOpen, Check, Loader2, Plus, Sparkles } from "lucide-react";
import { AiModelTag } from "@/components/studio/ai-status";
import { PillarBadge } from "@/components/studio/badges";
import { Button } from "@/components/ui/button";
import type { ContentMixRecommendation } from "@/lib/studio/ai";
import { PILLARS, PILLAR_META } from "@/lib/studio/constants";
import type { Pillar } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { requestMixRecommendation, saveMixSuggestionAsIdea } from "./dashboard-actions";
import type { MixSnapshot } from "./queries";

interface Props {
  mix: MixSnapshot;
  aiAvailable: boolean;
}

/**
 * Content-mix panel: local percentages vs pillar targets (always on, no AI),
 * deterministic imbalance flags, and an explicit button that asks the AI for
 * rebalancing suggestions which can be saved straight into the Idea Bank.
 */
export function MixPanel({ mix, aiAvailable }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ recommendation: ContentMixRecommendation; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<number, string>>({});
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const targetOf = (p: Pillar) => mix.targets.find((t) => t.key === p)?.target_pct ?? 0;
  const pctOf = (p: Pillar) => (mix.total ? Math.round((mix.counts[p] / mix.total) * 100) : 0);

  const ask = () => {
    setError(null);
    startTransition(async () => {
      const res = await requestMixRecommendation(mix.windowDays);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data);
      setSaved({});
    });
  };

  const save = (idx: number, s: ContentMixRecommendation["suggestions"][number]) => {
    setSavingIdx(idx);
    startTransition(async () => {
      const res = await saveMixSuggestionAsIdea({ pillar: s.pillar, title: s.title, hook: s.hook, reason: s.reason, source_refs: s.source_refs });
      setSavingIdx(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved((m) => ({ ...m, [idx]: res.data.id }));
      toast.success("บันทึกเป็นไอเดียแล้ว");
    });
  };

  return (
    <div className="space-y-5">
      {/* Stacked distribution bar */}
      {mix.total === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
          ยังไม่มีคอนเทนต์ที่อนุมัติ / ตั้งเวลา / เผยแพร่ในช่วง {mix.windowDays} วันนี้ — สัดส่วนจะแสดงเมื่อมีคอนเทนต์เข้าสู่ปฏิทิน
        </p>
      ) : (
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60" role="img" aria-label="สัดส่วนคอนเทนต์ตามเสา">
          {PILLARS.filter((p) => mix.counts[p] > 0).map((p) => (
            <span
              key={p}
              className={cn("h-full transition-all", PILLAR_META[p].dot)}
              style={{ width: `${(mix.counts[p] / mix.total) * 100}%` }}
              title={`${PILLAR_META[p].label} ${pctOf(p)}%`}
            />
          ))}
        </div>
      )}

      {/* Per-pillar rows with target tick */}
      <ul className="space-y-2.5">
        {PILLARS.map((p) => {
          const meta = PILLAR_META[p];
          const pct = pctOf(p);
          const target = targetOf(p);
          const diff = pct - target;
          return (
            <li key={p} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                <span className="truncate" title={meta.description}>
                  {meta.label}
                </span>
              </span>
              <span className="relative h-1.5 rounded-full bg-muted/60">
                <span className={cn("absolute inset-y-0 left-0 rounded-full", meta.dot)} style={{ width: `${Math.min(pct, 100)}%` }} />
                {target > 0 && (
                  <span
                    className="absolute -top-[3px] h-3 w-px bg-foreground/50"
                    style={{ left: `${Math.min(target, 100)}%` }}
                    title={`เป้า ${target}%`}
                    aria-hidden
                  />
                )}
              </span>
              <span className="w-24 text-right font-mono tabular-nums text-muted-foreground">
                {pct}% <span className="text-muted-foreground/60">/ {target}%</span>
                {mix.total > 0 && Math.abs(diff) >= 15 && (
                  <span className={cn("ml-1", diff > 0 ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400")}>
                    {diff > 0 ? "▲" : "▼"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Deterministic flags */}
      {mix.flags.length > 0 && (
        <ul className="space-y-1.5">
          {mix.flags.map((f) => (
            <li key={f} className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* AI recommendation — on demand only */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">ให้ AI แนะนำการปรับสัดส่วน</p>
            <p className="text-[11px] text-muted-foreground">
              วิเคราะห์ ±{mix.windowDays} วัน เทียบเป้าหมายเสาคอนเทนต์ และดึงความรู้ที่ยังไม่ถูกใช้มาเสนอเป็นไอเดีย · เรียกเมื่อกดเท่านั้น
            </p>
          </div>
          <Button size="sm" onClick={ask} disabled={!aiAvailable || pending} title={aiAvailable ? undefined : "AI ยังใช้งานไม่ได้ — ตรวจสอบตั้งค่าสตูดิโอ"}>
            {pending && savingIdx === null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {result ? "วิเคราะห์อีกครั้ง" : "ให้ AI แนะนำ"}
          </Button>
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <AiModelTag model={result.model} /> ข้อเสนอเป็นการประเมินของ AI — ตัดสินใจเองก่อนนำไปใช้
            </div>

            {result.recommendation.flags.length > 0 && (
              <ul className="space-y-1">
                {result.recommendation.flags.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}

            {result.recommendation.suggestions.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-3">
                {result.recommendation.suggestions.map((s, i) => {
                  const savedId = saved[i];
                  const hasGeneral = s.source_refs.some((r) => r.kind === "ai_general");
                  return (
                    <div key={`${s.pillar}-${i}`} className="flex flex-col rounded-lg border border-border/60 bg-card p-3">
                      <PillarBadge pillar={s.pillar} className="self-start" />
                      <p className="mt-2 text-sm font-medium leading-snug">{s.title}</p>
                      {s.hook && <p className="mt-1 text-xs text-muted-foreground">“{s.hook}”</p>}
                      <p className="mt-2 text-[11px] text-muted-foreground/80">{s.reason}</p>
                      <p className="mt-2 text-[10px] text-muted-foreground/70">
                        แหล่งอ้างอิง {s.source_refs.length} รายการ
                        {hasGeneral && <span className="ml-1 text-destructive">· มีส่วนจากความรู้ทั่วไปของ AI</span>}
                      </p>
                      <div className="mt-3 flex-1" />
                      {savedId ? (
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link href="/studio/ideas">
                            <Check className="h-3.5 w-3.5 text-emerald-500" /> บันทึกแล้ว · เปิด Idea Bank
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" className="w-full" disabled={pending} onClick={() => save(i, s)}>
                          {savingIdx === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          บันทึกเป็นไอเดีย
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">AI ไม่ได้เสนอไอเดียเพิ่มในรอบนี้</p>
            )}

            {result.recommendation.unused_knowledge.length > 0 && (
              <div className="rounded-md border border-border/60 bg-background/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <BookOpen className="h-3.5 w-3.5 text-sky-500" /> ความรู้ที่ AI แนะนำให้หยิบมาใช้
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                  {result.recommendation.unused_knowledge.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
