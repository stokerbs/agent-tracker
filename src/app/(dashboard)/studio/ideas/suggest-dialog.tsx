"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PILLAR_META, PILLARS } from "@/lib/studio/constants";
import type { GeneratedIdea } from "@/lib/studio/ai";
import type { Pillar } from "@/lib/studio/types";
import { AiModelTag } from "@/components/studio/ai-status";
import { FormatBadge, PillarBadge, PlatformChips, ScoreStrip } from "@/components/studio/badges";
import { SourceList } from "@/components/studio/source-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveSuggestedIdeas, suggestIdeas } from "./actions";

const ANY = "__any__";
const COUNTS = [3, 5, 8];

type Step = "brief" | "preview";

/** "ให้ AI แนะนำ 5 ไอเดีย" — brief → preview → save selected as origin 'ai', status 'new'. */
export function SuggestIdeasDialog({ open, onOpenChange, aiAvailable, defaultPillar = null }: { open: boolean; onOpenChange: (open: boolean) => void; aiAvailable: boolean; defaultPillar?: Pillar | null }) {
  const [step, setStep] = useState<Step>("brief");
  const [brief, setBrief] = useState("");
  const [pillar, setPillar] = useState<Pillar | null>(defaultPillar);
  const [count, setCount] = useState(5);
  const [ideas, setIdeas] = useState<(GeneratedIdea & { selected: boolean })[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);

  const selected = ideas.filter((i) => i.selected);

  function reset() {
    setStep("brief");
    setIdeas([]);
    setGaps([]);
    setError(null);
    setGenerationId(null);
    setModel(null);
  }

  function close(v: boolean) {
    if (pending) return;
    onOpenChange(v);
    if (!v) reset();
  }

  function generate() {
    setError(null);
    start(async () => {
      const res = await suggestIdeas({ brief: brief.trim(), pillar, count });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setIdeas(res.data.ideas.map((i) => ({ ...i, selected: true })));
      setGaps(res.data.knowledge_gaps);
      setGenerationId(res.data.generationId);
      setModel(res.data.model);
      setStep("preview");
    });
  }

  function save() {
    if (!selected.length) return;
    setError(null);
    setSaving(true);
    start(async () => {
      const res = await saveSuggestedIdeas({ ideas: selected.map(({ selected: _s, ...rest }) => rest), generationId });
      setSaving(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(`บันทึก ${res.data.ids.length} ไอเดียเข้า Idea Bank แล้ว (สถานะ “ใหม่”)`);
      onOpenChange(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> ให้ AI แนะนำไอเดีย
          </DialogTitle>
          <DialogDescription>
            {step === "brief" ? "บอกหัวข้อหรือมุมที่อยากได้ — AI จะค้นคลังความรู้แล้วเสนอไอเดียพร้อมแหล่งอ้างอิง คุณเลือกเก็บเฉพาะที่ชอบ" : "ติ๊กไอเดียที่ต้องการเก็บ · คะแนนเป็นการประเมินของ AI ไม่ใช่ผลจริง"}
          </DialogDescription>
        </DialogHeader>

        {step === "brief" && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="suggest-brief">บรีฟ</Label>
              <Textarea id="suggest-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} maxLength={2000} placeholder="เช่น ไอเดียคอนเทนต์เรื่องข้อจำกัดของ GPS ติดรถ สำหรับคนที่กำลังสงสัยคู่ครอง" disabled={pending || !aiAvailable} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>เสาหลัก (ไม่บังคับ)</Label>
                <Select value={pillar ?? ANY} onValueChange={(v) => setPillar(v === ANY ? null : (v as Pillar))} disabled={pending}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>ให้ AI เลือกผสม</SelectItem>
                    {PILLARS.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", PILLAR_META[p].dot)} />
                          {PILLAR_META[p].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>จำนวน</Label>
                <Select value={String(count)} onValueChange={(v) => setCount(Number(v))} disabled={pending}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTS.map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c} ไอเดีย
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!aiAvailable && <p className="text-xs text-amber-600 dark:text-amber-400">AI ยังใช้งานไม่ได้ — ตรวจสอบตั้งค่าสตูดิโอ</p>}
            {error && <ErrorNote text={error} />}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => close(false)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button size="sm" onClick={generate} disabled={pending || !aiAvailable || brief.trim().length < 8}>
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                {pending ? "กำลังคิดไอเดีย… (20–60 วิ)" : `แนะนำ ${count} ไอเดีย`}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                เลือกแล้ว {selected.length}/{ideas.length}
              </span>
              {model && <AiModelTag model={model} />}
            </div>
            <ul className="space-y-2">
              {ideas.map((idea, idx) => (
                <li key={idx} className={cn("rounded-lg border border-border/60 p-3 transition-opacity", !idea.selected && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <Checkbox checked={idea.selected} onCheckedChange={(c) => setIdeas((prev) => prev.map((i, j) => (j === idx ? { ...i, selected: c === true } : i)))} className="mt-1" aria-label="เลือกไอเดียนี้" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PillarBadge pillar={idea.pillar} />
                        <FormatBadge format={idea.format} />
                        <PlatformChips platforms={idea.platforms} max={3} />
                      </div>
                      <p className="font-medium leading-snug">{idea.title}</p>
                      {idea.hook && <p className="text-sm italic text-muted-foreground">“{idea.hook}”</p>}
                      {idea.description && <p className="text-xs leading-relaxed text-foreground/75">{idea.description}</p>}
                      <ScoreStrip scores={idea.ai_scores} />
                      <SourceList items={idea.source_refs.slice(0, 3)} emptyText="AI ไม่ได้ระบุแหล่งอ้างอิง" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {gaps.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> คลังความรู้ยังไม่ครอบคลุม
                </p>
                <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                  {gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && <ErrorNote text={error} />}
            <div className="flex flex-wrap justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setStep("brief")} disabled={pending}>
                ← แก้บรีฟ
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
                  {pending && !saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  สุ่มใหม่
                </Button>
                <Button size="sm" onClick={save} disabled={pending || selected.length === 0}>
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  บันทึก {selected.length} ไอเดีย
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="break-words">{text}</span>
    </p>
  );
}
