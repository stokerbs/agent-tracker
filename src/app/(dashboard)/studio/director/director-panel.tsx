"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Plus, RefreshCw, Sparkles, Target, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PILLAR_META } from "@/lib/studio/constants";
import type { CampaignProposal, GeneratedIdea } from "@/lib/studio/ai";
import { AiModelTag } from "@/components/studio/ai-status";
import { FormatBadge, PillarBadge, PlatformChips, ScoreStrip } from "@/components/studio/badges";
import { SourceList } from "@/components/studio/source-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createCampaign, generateMoreIdeas, proposeCampaign, replaceIdea } from "./actions";
import { TONE_OPTIONS, type ToneKey } from "./tone";

const EXAMPLES = [
  "อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ TikTok กับ IG",
  "ทำซีรีส์ 4 ตอน เรื่องข้อจำกัดของ GPS ติดรถ สำหรับ Facebook และ Reels โทนให้ความรู้",
  "3 คลิปสั้น สัญญาณเตือนมิจฉาชีพออนไลน์ สำหรับคนวัยทำงาน TikTok",
];

interface LocalIdea extends GeneratedIdea {
  uid: string;
  selected: boolean;
}

type Busy = null | "propose" | "more" | "tone" | "create" | `replace:${string}`;

let uidCounter = 0;
function withUid(ideas: GeneratedIdea[]): LocalIdea[] {
  return ideas.map((i) => ({ ...i, uid: `idea-${Date.now()}-${uidCounter++}`, selected: true }));
}

export function DirectorPanel({ initialQuery, aiAvailable }: { initialQuery: string; aiAvailable: boolean }) {
  const [request, setRequest] = useState(initialQuery);
  const [proposal, setProposal] = useState<CampaignProposal | null>(null);
  const [ideas, setIdeas] = useState<LocalIdea[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [tone, setTone] = useState<ToneKey>("professional");
  const [created, setCreated] = useState<{ id: string; ideaCount: number; title: string } | null>(null);
  const [, startTransition] = useTransition();

  const selectedIdeas = useMemo(() => ideas.filter((i) => i.selected), [ideas]);
  const titles = useMemo(() => ideas.map((i) => i.title), [ideas]);
  const trimmed = request.trim();
  const canSubmit = aiAvailable && trimmed.length >= 8 && busy === null;

  const applyProposal = useCallback((p: CampaignProposal, gid: string | null, m: string) => {
    setProposal(p);
    setIdeas(withUid(p.ideas));
    setGenerationId(gid);
    setModel(m);
    setCreated(null);
  }, []);

  function run(kind: Busy, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาดไม่คาดคิด");
      } finally {
        setBusy(null);
      }
    });
  }

  function handlePropose() {
    if (!canSubmit) return;
    run("propose", async () => {
      const res = await proposeCampaign({ request: trimmed });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      applyProposal(res.data.proposal, res.data.generationId, res.data.model);
    });
  }

  function handleMore() {
    if (!proposal) return;
    run("more", async () => {
      const res = await generateMoreIdeas({
        request: trimmed,
        existingTitles: titles,
        count: 3,
        platforms: proposal.interpretation.platforms,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setIdeas((prev) => [...prev, ...withUid(res.data.ideas)]);
      if (res.data.knowledge_gaps.length) {
        setProposal((p) => (p ? { ...p, knowledge_gaps: Array.from(new Set([...p.knowledge_gaps, ...res.data.knowledge_gaps])) } : p));
      }
      toast.success(`เพิ่มไอเดียใหม่ ${res.data.ideas.length} ชิ้น`);
    });
  }

  function handleReplace(idea: LocalIdea) {
    if (!proposal) return;
    run(`replace:${idea.uid}`, async () => {
      const res = await replaceIdea({
        request: trimmed,
        avoidTitle: idea.title,
        existingTitles: titles.filter((t) => t !== idea.title),
        pillar: idea.pillar,
        platforms: idea.platforms.length ? idea.platforms : proposal.interpretation.platforms,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setIdeas((prev) => prev.map((i) => (i.uid === idea.uid ? { ...res.data.idea, uid: i.uid, selected: true } : i)));
      toast.success("เปลี่ยนไอเดียแล้ว");
    });
  }

  function handleTone() {
    if (!proposal) return;
    run("tone", async () => {
      const res = await proposeCampaign({ request: trimmed, refine: { previousIdeas: titles, tone } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      applyProposal(res.data.proposal, res.data.generationId, res.data.model);
      toast.success(`ปรับโทนเป็น "${TONE_OPTIONS.find((t) => t.key === tone)?.label}" แล้ว`);
    });
  }

  function handleCreate() {
    if (!proposal || !selectedIdeas.length) return;
    run("create", async () => {
      const res = await createCampaign({
        request: trimmed,
        title: proposal.title,
        interpretation: proposal.interpretation,
        mix_note: proposal.mix_note,
        knowledge_gaps: proposal.knowledge_gaps,
        ideas: selectedIdeas.map(({ uid: _uid, selected: _selected, ...rest }) => rest),
        generationId,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setCreated({ id: res.data.id, ideaCount: res.data.ideaCount, title: proposal.title });
      setProposal(null);
      setIdeas([]);
      toast.success(`สร้างแคมเปญ "${proposal.title}" แล้ว (${res.data.ideaCount} ไอเดีย)`);
    });
  }

  function toggle(uid: string, checked: boolean) {
    setIdeas((prev) => prev.map((i) => (i.uid === uid ? { ...i, selected: checked } : i)));
  }

  const proposing = busy === "propose" || busy === "tone";

  return (
    <div className="space-y-6">
      {/* ── Brief ─────────────────────────────────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" />
            บรีฟของคุณ
          </div>
          <Textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={!aiAvailable || busy !== null}
            placeholder="เช่น อาทิตย์หน้าสร้าง 5 คอนเทนต์ เน้นงานนอกใจ TikTok กับ IG"
            className="min-h-[88px] resize-y text-base leading-relaxed"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handlePropose();
            }}
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={busy !== null}
                onClick={() => setRequest(ex)}
                className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              บอกเป้าหมาย แพลตฟอร์ม จำนวน และโทนที่อยากได้ — ระบบจะค้นคลังความรู้แล้วเสนอแคมเปญ (ไม่ใช่แชต) · ⌘/Ctrl + Enter
            </p>
            <Button onClick={handlePropose} disabled={!canSubmit} className="shrink-0">
              {proposing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {proposal ? "ร่างแคมเปญใหม่" : "ร่างแคมเปญ"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-destructive">สร้างด้วย AI ไม่สำเร็จ</p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{error}</p>
          </div>
          {!proposal && (
            <Button size="sm" variant="outline" onClick={handlePropose} disabled={!canSubmit}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> ลองใหม่
            </Button>
          )}
        </div>
      )}

      {/* ── Created ───────────────────────────────────────────────────────── */}
      {created && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium">สร้างแคมเปญ “{created.title}” แล้ว</p>
                <p className="text-xs text-muted-foreground">
                  บันทึก {created.ideaCount} ไอเดียเข้า Idea Bank (สถานะ “บันทึกไว้”) — ไปเลือกไอเดียเพื่อสร้างคอนเทนต์ต่อได้เลย
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link href={`/studio/ideas?campaign=${created.id}`}>
                เปิดใน Idea Bank <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {proposing && <ProposalSkeleton />}

      {/* ── Proposal ──────────────────────────────────────────────────────── */}
      {proposal && !proposing && (
        <div className="space-y-6">
          <InterpretationCard proposal={proposal} model={model} />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                ไอเดียที่เสนอ <span className="ml-1 font-normal text-muted-foreground">({ideas.length} · เลือกแล้ว {selectedIdeas.length})</span>
              </h2>
              <p className="hidden text-xs text-muted-foreground sm:block">เรียงตามคะแนนที่ AI ประเมิน · ติ๊กออกถ้าไม่ต้องการ</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {ideas.map((idea, idx) => (
                <IdeaProposalCard
                  key={idea.uid}
                  idea={idea}
                  index={idx + 1}
                  replacing={busy === `replace:${idea.uid}`}
                  disabled={busy !== null}
                  onToggle={(c) => toggle(idea.uid, c)}
                  onReplace={() => handleReplace(idea)}
                />
              ))}
              {busy === "more" && (
                <Card className="border-dashed border-border/70">
                  <CardContent className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 p-5 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    กำลังคิดไอเดียเพิ่ม…
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">สัดส่วนคอนเทนต์ (Content mix)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{proposal.mix_note || "—"}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/[0.03]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  คลังความรู้ยังไม่ครอบคลุม
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proposal.knowledge_gaps.length ? (
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {proposal.knowledge_gaps.map((g, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">ไอเดียทั้งหมดอิงจากคลังความรู้ที่มีอยู่</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground/80">
                  เพิ่มความรู้ใน{" "}
                  <Link href="/studio/knowledge" className="text-primary hover:underline">
                    คลังความรู้
                  </Link>{" "}
                  เพื่อให้ AI อ้างอิงได้แทนความรู้ทั่วไป
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Refinement bar ───────────────────────────────────────────── */}
          <div className="sticky bottom-3 z-10 rounded-xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleMore} disabled={busy !== null}>
                  {busy === "more" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                  สร้างเพิ่ม
                </Button>
                <div className="flex items-center gap-1.5">
                  <Select value={tone} onValueChange={(v) => setTone(v as ToneKey)} disabled={busy !== null}>
                    <SelectTrigger className="h-8 w-[150px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((t) => (
                        <SelectItem key={t.key} value={t.key} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleTone} disabled={busy !== null}>
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" /> เปลี่ยนโทน
                  </Button>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={busy !== null || selectedIdeas.length === 0} className="md:min-w-[200px]">
                {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                สร้างแคมเปญ ({selectedIdeas.length} ไอเดีย)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InterpretationCard({ proposal, model }: { proposal: CampaignProposal; model: string | null }) {
  const it = proposal.interpretation;
  return (
    <Card className="overflow-hidden border-border/60">
      <div className="h-1 w-full bg-gradient-to-r from-primary/70 via-violet-500/60 to-sky-500/60" />
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">ระบบตีความบรีฟว่า</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{proposal.title}</h2>
          </div>
          {model && <AiModelTag model={model} />}
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Field label="เป้าหมาย" value={it.objective} />
          <Field label="กลุ่มเป้าหมาย" value={it.audience} />
          <Field label="โทน" value={it.tone} />
          <Field label="CTA" value={it.cta} />
        </dl>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>แพลตฟอร์ม</span>
            <PlatformChips platforms={it.platforms} max={6} />
          </div>
          <div className="flex items-center gap-2">
            <span>เสาหลัก</span>
            <span className="inline-flex flex-wrap gap-1">
              {it.pillar_focus.map((p) => (
                <PillarBadge key={p} pillar={p} />
              ))}
            </span>
          </div>
          <div>
            จำนวน <span className="font-medium text-foreground">{it.post_count}</span> ชิ้น
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 leading-relaxed">{value || "—"}</dd>
    </div>
  );
}

function IdeaProposalCard({
  idea,
  index,
  replacing,
  disabled,
  onToggle,
  onReplace,
}: {
  idea: LocalIdea;
  index: number;
  replacing: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onReplace: () => void;
}) {
  const pillar = PILLAR_META[idea.pillar];
  return (
    <Card className={cn("relative flex flex-col border-border/60 transition-opacity", !idea.selected && "opacity-60", replacing && "animate-pulse")}>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Checkbox checked={idea.selected} onCheckedChange={(c) => onToggle(c === true)} disabled={disabled} className="mt-1" aria-label="เลือกไอเดียนี้" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold text-white", pillar?.dot ?? "bg-slate-500")}>{index}</span>
              <PillarBadge pillar={idea.pillar} />
              <FormatBadge format={idea.format} />
            </div>
            <h3 className="mt-1.5 font-medium leading-snug">{idea.title}</h3>
            {idea.hook && <p className="mt-1 text-sm italic text-muted-foreground">“{idea.hook}”</p>}
          </div>
        </div>
        {idea.description && <p className="text-sm leading-relaxed text-foreground/80">{idea.description}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <PlatformChips platforms={idea.platforms} max={4} />
          {idea.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[11px] text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
        <ScoreStrip scores={idea.ai_scores} />
        <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
          <p className="text-[11px] font-medium text-muted-foreground">แหล่งที่ AI ใช้</p>
          <SourceList items={idea.source_refs} emptyText="AI ไม่ได้ระบุแหล่งอ้างอิง — ตรวจสอบก่อนใช้" />
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReplace} disabled={disabled} className="text-xs">
            {replacing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            เปลี่ยนไอเดียนี้
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        กำลังค้นคลังความรู้และร่างแคมเปญ… <span className="text-xs">(ใช้เวลา 20–60 วินาที)</span>
      </div>
      <Card className="border-border/60">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/60">
            <CardContent className="space-y-3 p-4">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
