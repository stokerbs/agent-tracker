"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Layers, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiModelTag } from "@/components/studio/ai-status";
import { PlatformChip } from "@/components/studio/badges";
import { FORMAT_META, PLATFORM_META, PLATFORMS } from "@/lib/studio/constants";
import { estimateSpokenSeconds, formatDuration } from "@/lib/studio/duration";
import type { ContentVariant, Platform } from "@/lib/studio/types";
import type { GeneratedVariant } from "@/lib/studio/ai";
import { deleteVariant, saveVariant, upsertVariants } from "../actions";
import { formatTimeBkk } from "../format";
import { aiRepurpose } from "./ai-actions";
import { FieldSection } from "./field-section";

export interface VariantsSectionProps {
  masterId: string;
  variants: ContentVariant[];
  primaryPlatform: string | null;
  aiAvailable: boolean;
  hasSource: boolean;
}

export function VariantsSection({ masterId, variants, primaryPlatform, aiAvailable, hasSource }: VariantsSectionProps) {
  const [tab, setTab] = useState<string>(variants[0]?.id ?? "");
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  useEffect(() => {
    if (!variants.some((v) => v.id === tab)) setTab(variants[0]?.id ?? "");
  }, [variants, tab]);

  return (
    <section className="rounded-lg border border-border/70 bg-card" aria-labelledby="variants-title">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h2 id="variants-title" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> เวอร์ชันแพลตฟอร์ม
          <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{variants.length}</span>
        </h2>
        <Button size="sm" variant="outline" onClick={() => setRepurposeOpen(true)} disabled={!aiAvailable || !hasSource} title={!aiAvailable ? "AI ยังใช้งานไม่ได้" : !hasSource ? "ต้องมีสคริปต์หรือแคปชันต้นฉบับก่อน" : undefined}>
          <Plus className="h-4 w-4" /> สร้างเวอร์ชันแพลตฟอร์ม
        </Button>
      </header>

      {variants.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">ยังไม่มีเวอร์ชันแพลตฟอร์ม</p>
          <p className="mt-1 text-xs text-muted-foreground/70">ให้ AI ปรับต้นฉบับให้เหมาะกับแต่ละแพลตฟอร์ม (ความยาว แคปชัน แฮชแท็ก) แล้วแก้ต่อได้เอง</p>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="p-3">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            {variants.map((v) => (
              <TabsTrigger key={v.id} value={v.id} className="rounded-full border border-border/70 px-2.5 py-0.5 text-xs data-[state=active]:border-foreground/40">
                {PLATFORM_META[v.platform as Platform]?.label ?? v.platform}
              </TabsTrigger>
            ))}
          </TabsList>
          {variants.map((v) => (
            <TabsContent key={v.id} value={v.id} className="mt-3">
              <VariantEditor masterId={masterId} variant={v} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <RepurposeDialog open={repurposeOpen} onOpenChange={setRepurposeOpen} masterId={masterId} existing={variants.map((v) => v.platform)} primaryPlatform={primaryPlatform} />
    </section>
  );
}

// ─── One variant ─────────────────────────────────────────────────────────────
function VariantEditor({ masterId, variant }: { masterId: string; variant: ContentVariant }) {
  const router = useRouter();
  const [fields, setFields] = useState({ hook: variant.hook ?? "", script: variant.script ?? "", caption: variant.caption ?? "", cta: variant.cta ?? "" });
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = PLATFORM_META[variant.platform as Platform];
  const est = estimateSpokenSeconds(fields.script);

  useEffect(() => {
    setFields({ hook: variant.hook ?? "", script: variant.script ?? "", caption: variant.caption ?? "", cta: variant.cta ?? "" });
    setDirty(false);
  }, [variant.id, variant.hook, variant.script, variant.caption, variant.cta]);

  function set<K extends keyof typeof fields>(k: K, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }
  function save() {
    start(async () => {
      const res = await saveVariant({ id: variant.id, masterId, ...fields });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDirty(false);
      setSavedAt(res.data.savedAt);
      router.refresh();
    });
  }
  function remove() {
    start(async () => {
      const res = await deleteVariant({ id: variant.id, masterId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("ลบเวอร์ชันแล้ว");
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <PlatformChip platform={variant.platform} />
          <span>{FORMAT_META[variant.format as keyof typeof FORMAT_META]?.label ?? variant.format}</span>
          {fields.script && <span>· ~{formatDuration(est)}</span>}
          {savedAt ? <span>· บันทึกแล้ว {formatTimeBkk(savedAt)}</span> : dirty ? <span className="text-amber-600 dark:text-amber-400">· ยังไม่บันทึก</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          {confirmDelete ? (
            <>
              <span className="text-xs text-destructive">ลบเวอร์ชันนี้?</span>
              <Button size="sm" variant="destructive" onClick={remove} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ลบ"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={pending}>
                ยกเลิก
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending} aria-label="ลบเวอร์ชัน">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={save} disabled={!dirty || pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกเวอร์ชัน
              </Button>
            </>
          )}
        </div>
      </div>
      <FieldSection id={`v-${variant.id}-hook`} label="Hook" value={fields.hook} onChange={(v) => set("hook", v)} minRows={2} />
      <FieldSection id={`v-${variant.id}-script`} label="Script" value={fields.script} onChange={(v) => set("script", v)} minRows={6} mono />
      <FieldSection id={`v-${variant.id}-caption`} label="Caption" value={fields.caption} onChange={(v) => set("caption", v)} minRows={3} maxChars={meta?.maxCaption} />
      <FieldSection id={`v-${variant.id}-cta`} label="CTA" value={fields.cta} onChange={(v) => set("cta", v)} minRows={1} />
    </div>
  );
}

// ─── Repurpose dialog ────────────────────────────────────────────────────────
function RepurposeDialog({ open, onOpenChange, masterId, existing, primaryPlatform }: { open: boolean; onOpenChange: (v: boolean) => void; masterId: string; existing: string[]; primaryPlatform: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Platform[]>([]);
  const [preview, setPreview] = useState<{ variants: GeneratedVariant[]; model: string; generationId: string | null } | null>(null);
  const [pending, start] = useTransition();
  const [phase, setPhase] = useState<"pick" | "generating" | "preview" | "saving">("pick");

  function reset() {
    setSelected([]);
    setPreview(null);
    setPhase("pick");
  }
  function toggle(p: Platform) {
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }
  function generate() {
    setPhase("generating");
    start(async () => {
      const res = await aiRepurpose({ masterId, platforms: selected });
      if (!res.ok) {
        toast.error(res.error);
        setPhase("pick");
        return;
      }
      setPreview({ variants: res.data.data.variants, model: res.data.model, generationId: res.data.generationId });
      setPhase("preview");
    });
  }
  function apply() {
    if (!preview) return;
    setPhase("saving");
    start(async () => {
      const res = await upsertVariants({
        masterId,
        generationId: preview.generationId,
        variants: preview.variants.map((v) => ({ platform: v.platform, format: v.format, hook: v.hook, script: v.script, caption: v.caption, cta: v.cta })),
      });
      if (!res.ok) {
        toast.error(res.error);
        setPhase("preview");
        return;
      }
      toast.success(`บันทึก ${res.data.count} เวอร์ชันแล้ว`);
      onOpenChange(false);
      reset();
      router.refresh();
    });
  }

  const replacing = preview?.variants.filter((v) => existing.includes(v.platform)).map((v) => PLATFORM_META[v.platform].label) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (pending) return;
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> สร้างเวอร์ชันแพลตฟอร์ม
          </DialogTitle>
          <DialogDescription>AI ปรับต้นฉบับให้เหมาะกับแต่ละแพลตฟอร์ม โดยไม่เพิ่มข้อเท็จจริงใหม่ — ตรวจก่อนบันทึก</DialogDescription>
        </DialogHeader>

        {phase === "pick" && (
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="เลือกแพลตฟอร์ม">
            {PLATFORMS.map((p) => {
              const has = existing.includes(p);
              const isPrimary = p === primaryPlatform;
              return (
                <label key={p} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-accent/50">
                  <Checkbox checked={selected.includes(p)} onCheckedChange={() => toggle(p)} aria-label={PLATFORM_META[p].label} />
                  <span className="flex-1">{PLATFORM_META[p].label}</span>
                  {isPrimary && <span className="text-[10px] text-muted-foreground">หลัก</span>}
                  {has && <span className="text-[10px] text-amber-600 dark:text-amber-400">มีอยู่แล้ว → จะแทนที่</span>}
                </label>
              );
            })}
          </div>
        )}

        {phase === "generating" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <p className="text-sm text-muted-foreground">AI กำลังปรับเนื้อหาให้ {selected.length} แพลตฟอร์ม… (10–60 วินาที)</p>
          </div>
        )}

        {(phase === "preview" || phase === "saving") && preview && (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {replacing.length > 0 && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                จะแทนที่เวอร์ชันเดิมของ {replacing.join(", ")} — เนื้อหาเดิมที่แก้ไว้จะหาย
              </p>
            )}
            {preview.variants.map((v) => (
              <div key={v.platform} className="rounded-md border border-border/70 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <PlatformChip platform={v.platform} />
                  <span className="text-xs text-muted-foreground">{FORMAT_META[v.format]?.label ?? v.format}</span>
                  {v.script && <span className="text-xs text-muted-foreground">· ~{formatDuration(estimateSpokenSeconds(v.script))}</span>}
                </div>
                {v.hook && <p className="text-sm font-medium">{v.hook}</p>}
                {v.script && <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground/90">{v.script}</pre>}
                {v.caption && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{v.caption}</p>}
                {v.cta && <p className="mt-1 text-xs text-primary">{v.cta}</p>}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div>{preview?.model && <AiModelTag model={preview.model} />}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              ยกเลิก
            </Button>
            {phase === "pick" && (
              <Button size="sm" onClick={generate} disabled={!selected.length || pending}>
                <Sparkles className="h-4 w-4" /> สร้าง {selected.length ? `(${selected.length})` : ""}
              </Button>
            )}
            {(phase === "preview" || phase === "saving") && (
              <Button size="sm" onClick={apply} disabled={pending}>
                {phase === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกเวอร์ชัน
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
