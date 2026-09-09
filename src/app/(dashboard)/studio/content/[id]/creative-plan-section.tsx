"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Clapperboard, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CreativePlan, CreativeShot } from "@/lib/studio/types";
import { saveCreativePlan } from "../actions";
import { aiCreativePlan } from "./ai-actions";

export interface CreativePlanSectionProps {
  masterId: string;
  plan: CreativePlan | null;
  hasScript: boolean;
  aiAvailable: boolean;
}

const EMPTY: CreativePlan = { shots: [], broll: [], text_overlays: [], subtitle_style: null, voiceover_notes: null, thumbnail_concept: null, music_mood: null };

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Text creative plan (shot list, B-roll, overlays…). V1 generates a PLAN, not
 * a video — the empty state says so. Shots are inline-editable and saved back
 * as jsonb after zod validation on the server.
 */
export function CreativePlanSection({ masterId, plan, hasScript, aiAvailable }: CreativePlanSectionProps) {
  const router = useRouter();
  const [local, setLocal] = useState<CreativePlan>(plan ?? EMPTY);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    setLocal(plan ?? EMPTY);
    setDirty(false);
  }, [plan]);

  function patch(p: Partial<CreativePlan>) {
    setLocal((l) => ({ ...l, ...p }));
    setDirty(true);
  }
  function patchShot(i: number, s: Partial<CreativeShot>) {
    setLocal((l) => ({ ...l, shots: l.shots.map((x, j) => (j === i ? { ...x, ...s } : x)) }));
    setDirty(true);
  }
  function addShot() {
    const last = local.shots[local.shots.length - 1];
    const start_sec = last ? last.end_sec : 0;
    patch({ shots: [...local.shots, { start_sec, end_sec: start_sec + 3, voice: "", visual: "", text_overlay: null }] });
  }
  function removeShot(i: number) {
    patch({ shots: local.shots.filter((_, j) => j !== i) });
  }
  function save() {
    start(async () => {
      const res = await saveCreativePlan({ masterId, plan: local });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("บันทึกแผนวิดีโอแล้ว");
      setDirty(false);
      router.refresh();
    });
  }
  function generate() {
    if (plan && plan.shots.length && !confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setConfirmRegen(false);
    setGenerating(true);
    start(async () => {
      const res = await aiCreativePlan(masterId);
      setGenerating(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("สร้างแผนวิดีโอแล้ว — แก้ไขได้ทันที");
      router.refresh();
    });
  }

  const listField = (label: string, key: "broll" | "text_overlays", placeholder: string) => (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <Textarea
        value={local[key].join("\n")}
        onChange={(e) => patch({ [key]: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } as Partial<CreativePlan>)}
        rows={3}
        placeholder={placeholder}
        className="text-xs"
        aria-label={label}
      />
      {local[key].length > 0 && (
        <div className="flex flex-wrap gap-1">
          {local[key].map((b, i) => (
            <span key={`${b}-${i}`} className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[11px]">
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
  const textField = (label: string, key: "subtitle_style" | "voiceover_notes" | "thumbnail_concept" | "music_mood", rows = 2) => (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <Textarea value={local[key] ?? ""} onChange={(e) => patch({ [key]: e.target.value || null } as Partial<CreativePlan>)} rows={rows} className="text-xs" aria-label={label} />
    </div>
  );

  const isEmpty = !local.shots.length && !local.broll.length && !local.text_overlays.length && !local.thumbnail_concept && !local.voiceover_notes;

  return (
    <section className="rounded-lg border border-border/70 bg-card" aria-labelledby="plan-title">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h2 id="plan-title" className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Clapperboard className="h-3.5 w-3.5" /> แผนวิดีโอ (Creative Plan)
        </h2>
        <div className="flex items-center gap-1.5">
          {confirmRegen ? (
            <>
              <span className="text-xs text-amber-600 dark:text-amber-400">แทนที่แผนเดิม?</span>
              <Button size="sm" variant="outline" onClick={generate} disabled={pending}>
                ยืนยัน
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRegen(false)} disabled={pending}>
                ยกเลิก
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={generate} disabled={!aiAvailable || !hasScript || pending} title={!aiAvailable ? "AI ยังใช้งานไม่ได้" : !hasScript ? "ต้องมีสคริปต์ก่อน" : undefined}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {plan?.shots.length ? "สร้างแผนใหม่" : "สร้างแผนวิดีโอ"}
              </Button>
              {(dirty || !isEmpty) && (
                <Button size="sm" onClick={save} disabled={!dirty || pending}>
                  {pending && !generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกแผน
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      {generating ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center" role="status" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          <p className="text-xs text-muted-foreground">AI กำลังวาง shot list จากสคริปต์… (10–60 วินาที)</p>
        </div>
      ) : isEmpty ? (
        <div className="px-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">ยังไม่มีแผนวิดีโอ</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground/70">
            แผนวิดีโอเป็น <span className="font-medium text-foreground/80">ข้อความ</span>: shot list ตามช่วงเวลา, B-roll ที่ปลอดภัย, ข้อความบนจอ, สไตล์ซับ, โน้ตเสียงพากย์, คอนเซ็ปต์ thumbnail — V1 ยังไม่สร้างวิดีโอ/ภาพจริง
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" onClick={addShot}>
              <Plus className="h-4 w-4" /> เพิ่ม shot เอง
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-3">
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-muted/40 text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium" style={{ width: 130 }}>
                    เวลา (วิ)
                  </th>
                  <th className="px-2 py-1.5 font-medium">เสียง / พูด</th>
                  <th className="px-2 py-1.5 font-medium">ภาพ</th>
                  <th className="px-2 py-1.5 font-medium" style={{ width: 180 }}>
                    ข้อความบนจอ
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {local.shots.map((s, i) => (
                  <tr key={i} className={cn("border-t border-border/60 align-top", i % 2 ? "bg-muted/10" : "")}>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} value={s.start_sec} onChange={(e) => patchShot(i, { start_sec: Math.max(0, Number(e.target.value) || 0) })} className="h-7 w-14 px-1.5 text-xs" aria-label={`shot ${i + 1} เริ่ม`} />
                        <span className="text-muted-foreground">–</span>
                        <Input type="number" min={0} value={s.end_sec} onChange={(e) => patchShot(i, { end_sec: Math.max(0, Number(e.target.value) || 0) })} className="h-7 w-14 px-1.5 text-xs" aria-label={`shot ${i + 1} จบ`} />
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {fmt(s.start_sec)}–{fmt(s.end_sec)}
                      </p>
                    </td>
                    <td className="px-2 py-1.5">
                      <Textarea value={s.voice} onChange={(e) => patchShot(i, { voice: e.target.value })} rows={2} className="min-h-0 text-xs" aria-label={`shot ${i + 1} เสียง`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Textarea value={s.visual} onChange={(e) => patchShot(i, { visual: e.target.value })} rows={2} className="min-h-0 text-xs" aria-label={`shot ${i + 1} ภาพ`} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={s.text_overlay ?? ""} onChange={(e) => patchShot(i, { text_overlay: e.target.value || null })} className="h-8 text-xs" aria-label={`shot ${i + 1} ข้อความบนจอ`} />
                    </td>
                    <td className="px-1 py-1.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeShot(i)} aria-label={`ลบ shot ${i + 1}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border/60 px-2 py-1.5">
              <Button size="sm" variant="ghost" onClick={addShot} className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5" /> เพิ่ม shot
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {listField("B-roll (บรรทัดละรายการ)", "broll", "เช่น ภาพมุมกว้างถนนตอนกลางคืน (ไม่เห็นทะเบียน/หน้าคน)")}
            {listField("ข้อความบนจอ (บรรทัดละรายการ)", "text_overlays", "เช่น 3 สิ่งที่นักสืบมองหา")}
            {textField("สไตล์ซับไตเติล", "subtitle_style", 1)}
            {textField("อารมณ์เพลง", "music_mood", 1)}
            {textField("โน้ตเสียงพากย์", "voiceover_notes")}
            {textField("คอนเซ็ปต์ Thumbnail", "thumbnail_concept")}
          </div>
        </div>
      )}
    </section>
  );
}
