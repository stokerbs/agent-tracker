"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Loader2, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentStatusBadge, PillarBadge, PrivacyBadge } from "@/components/studio/badges";
import { PILLAR_META, PILLARS, PLATFORM_META, PLATFORMS, VIDEO_PLATFORMS } from "@/lib/studio/constants";
import { durationFit, estimateSpokenSeconds, formatDuration } from "@/lib/studio/duration";
import { effectivePrivacy } from "@/lib/studio/privacy/gate";
import { TARGET_DURATIONS, type ApprovalRules, type Pillar, type Platform, type PrivacyStatus } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { saveMasterFields } from "../actions";
import { formatTimeBkk } from "../format";
import type { MasterWithRelations } from "../queries";
import { CreativePlanSection } from "./creative-plan-section";
import { FieldSection } from "./field-section";
import { RightPanel, type EditableField } from "./right-panel";
import { VariantsSection } from "./variants-section";
import { WorkflowBar } from "./workflow-bar";

export interface ContentEditorProps {
  data: MasterWithRelations;
  aiAvailable: boolean;
  aiReason?: string;
  approvalRules: ApprovalRules;
}

type TextFields = { title: string; hook: string; script: string; caption: string; cta: string; notes: string };
type SaveState = { status: "idle" | "dirty" | "saving" | "saved" | "error"; at?: string; error?: string };

const AUTOSAVE_MS = 1200;
const FIT_LABEL = { on_target: "พอดีเป้า", short: "สั้นไป", long: "ยาวไป", unknown: "" } as const;
const FIT_CLASS = { on_target: "text-emerald-600 dark:text-emerald-400", short: "text-amber-600 dark:text-amber-400", long: "text-amber-600 dark:text-amber-400", unknown: "text-muted-foreground" } as const;

export function ContentEditor({ data, aiAvailable, aiReason, approvalRules }: ContentEditorProps) {
  const { master } = data;
  const router = useRouter();
  const editable = !["published"].includes(master.status);

  // Text fields are owned locally (the owner may be mid-sentence when the
  // server refreshes); everything else renders straight from props.
  const [fields, setFields] = useState<TextFields>({
    title: master.title,
    hook: master.hook ?? "",
    script: master.script ?? "",
    caption: master.caption ?? "",
    cta: master.cta ?? "",
    notes: master.notes ?? "",
  });
  const [meta, setMeta] = useState({ pillar: master.pillar as Pillar, primaryPlatform: (master.primary_platform as Platform | null) ?? null, targetDurationSec: master.target_duration_sec });
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);
  const latestRef = useRef({ fields, meta });
  latestRef.current = { fields, meta };

  const persist = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    const snapshot = latestRef.current;
    dirtyRef.current = false;
    setSave({ status: "saving" });
    const run = (async () => {
      const res = await saveMasterFields({
        id: master.id,
        title: snapshot.fields.title.trim() || master.title,
        hook: snapshot.fields.hook || null,
        script: snapshot.fields.script || null,
        caption: snapshot.fields.caption || null,
        cta: snapshot.fields.cta || null,
        notes: snapshot.fields.notes || null,
        pillar: snapshot.meta.pillar,
        primaryPlatform: snapshot.meta.primaryPlatform,
        targetDurationSec: snapshot.meta.targetDurationSec,
      });
      if (!res.ok) {
        dirtyRef.current = true;
        setSave({ status: "error", error: res.error });
        toast.error(res.error);
        return;
      }
      setSave((s) => (dirtyRef.current ? s : { status: "saved", at: res.data.savedAt }));
      if (res.data.reopened) {
        toast.info("เนื้อหาถูกแก้หลังอนุมัติ — สถานะกลับเป็น “ร่าง” ต้องตรวจและอนุมัติใหม่");
        router.refresh();
      }
    })();
    inflightRef.current = run;
    await run;
    inflightRef.current = null;
  }, [master.id, master.title, router]);

  const schedule = useCallback(() => {
    dirtyRef.current = true;
    setSave((s) => (s.status === "saving" ? s : { status: "dirty" }));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void persist(), AUTOSAVE_MS);
  }, [persist]);

  /** Await any in-flight save, then flush pending edits — used before workflow/AI actions. */
  const flush = useCallback(async () => {
    if (inflightRef.current) await inflightRef.current;
    await persist();
  }, [persist]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function setField<K extends keyof TextFields>(k: K, v: string) {
    setFields((f) => ({ ...f, [k]: v }));
    schedule();
  }
  function setMetaField<K extends keyof typeof meta>(k: K, v: (typeof meta)[K]) {
    setMeta((m) => ({ ...m, [k]: v }));
    schedule();
  }
  const onReplaceField = useCallback(
    (field: EditableField, text: string) => {
      setFields((f) => ({ ...f, [field]: text }));
      schedule();
    },
    [schedule],
  );
  const onScriptApplied = useCallback((d: { hook: string; script: string; caption: string; cta: string }) => {
    setFields((f) => ({ ...f, ...d }));
    // Already persisted server-side — mark clean without a second write.
    dirtyRef.current = false;
    setSave({ status: "saved", at: new Date().toISOString() });
  }, []);

  const estimated = useMemo(() => estimateSpokenSeconds(fields.script), [fields.script]);
  const fit = durationFit(estimated, meta.targetDurationSec);
  const isVideo = !meta.primaryPlatform || VIDEO_PLATFORMS.includes(meta.primaryPlatform);
  const maxCaption = meta.primaryPlatform ? PLATFORM_META[meta.primaryPlatform]?.maxCaption : undefined;
  // Same rule as the server gate (lib/studio/privacy/gate.ts): a stricter AI
  // verdict governs until a new AI check or an explicit override.
  const privacyGate = effectivePrivacy(data.privacyChecks);
  const latestPrivacy: PrivacyStatus | null = privacyGate.status;

  return (
    <div className="space-y-5">
      <Link href="/studio/content" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="h-3.5 w-3.5" /> กลับไปรายการคอนเทนต์
      </Link>

      {/* ── Header ── */}
      <header className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <input
              aria-label="ชื่อคอนเทนต์"
              value={fields.title}
              disabled={!editable}
              onChange={(e) => setField("title", e.target.value)}
              maxLength={200}
              className="w-full bg-transparent text-xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md -mx-1 px-1 disabled:opacity-80"
              placeholder="ชื่อคอนเทนต์"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <ContentStatusBadge status={master.status} />
              <PillarBadge pillar={meta.pillar} />
              <PrivacyBadge status={latestPrivacy} />
              <SaveIndicator state={save} onSave={() => void flush()} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Select value={meta.pillar} onValueChange={(v) => setMetaField("pillar", v as Pillar)} disabled={!editable}>
              <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="เสาคอนเทนต์">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PILLARS.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {PILLAR_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={meta.primaryPlatform ?? "none"} onValueChange={(v) => setMetaField("primaryPlatform", v === "none" ? null : (v as Platform))} disabled={!editable}>
              <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="แพลตฟอร์มหลัก">
                <SelectValue placeholder="แพลตฟอร์มหลัก" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {PLATFORM_META[p].label}
                  </SelectItem>
                ))}
                <SelectItem value="none" className="text-xs">
                  ไม่ระบุ
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={meta.targetDurationSec ? String(meta.targetDurationSec) : "none"} onValueChange={(v) => setMetaField("targetDurationSec", v === "none" ? null : Number(v))} disabled={!editable}>
              <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="ความยาวเป้าหมาย">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)} className="text-xs">
                    เป้า {d} วิ
                  </SelectItem>
                ))}
                <SelectItem value="none" className="text-xs">
                  ไม่กำหนด
                </SelectItem>
              </SelectContent>
            </Select>
            <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-xs tabular-nums", FIT_CLASS[fit])} aria-live="polite">
              <Clock className="h-3.5 w-3.5" />
              {fields.script ? (
                <>
                  ประมาณ {formatDuration(estimated)}
                  {fit !== "unknown" && <> · {FIT_LABEL[fit]}</>}
                </>
              ) : (
                "ยังไม่มีสคริปต์"
              )}
            </span>
          </div>
        </div>
        <div className="mt-4 border-t border-border/60 pt-3">
          <WorkflowBar
            master={{ id: master.id, status: master.status, scheduled_at: master.scheduled_at, published_at: master.published_at, published_url: master.published_url, approved_at: master.approved_at }}
            approvedByName={data.approvedByName}
            latestPrivacy={latestPrivacy}
            claims={data.claims}
            approvalRules={approvalRules}
            beforeAction={flush}
          />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {!editable && (
            <p className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5" /> คอนเทนต์ที่เผยแพร่แล้วล็อกการแก้ไข — เก็บถาวรแล้วนำกลับมาเป็นร่างหากต้องการแก้
            </p>
          )}
          <FieldSection id="f-hook" label="Hook" hint="3 วินาทีแรก — สั้น เฉพาะเจาะจง ไม่ clickbait" value={fields.hook} onChange={(v) => setField("hook", v)} minRows={2} disabled={!editable} placeholder="เช่น สิ่งแรกที่นักสืบดูไม่ใช่รถ — แต่คือเวลา" />
          <FieldSection
            id="f-script"
            label="Script"
            hint={isVideo ? "บทพูดสำหรับวิดีโอสั้น — ประเมินความยาวอัตโนมัติ" : "เนื้อหาหลัก"}
            value={fields.script}
            onChange={(v) => setField("script", v)}
            minRows={10}
            mono
            disabled={!editable}
            placeholder="พิมพ์สคริปต์ที่นี่ หรือกด “เขียนสคริปต์ใหม่ด้วย AI” ในแผงด้านขวา"
          />
          <FieldSection id="f-caption" label="Caption" hint={meta.primaryPlatform ? `สำหรับ ${PLATFORM_META[meta.primaryPlatform].label}` : undefined} value={fields.caption} onChange={(v) => setField("caption", v)} minRows={4} maxChars={maxCaption} disabled={!editable} placeholder="แคปชันประกอบโพสต์ + แฮชแท็ก" />
          <FieldSection id="f-cta" label="CTA" value={fields.cta} onChange={(v) => setField("cta", v)} minRows={1} disabled={!editable} placeholder="เช่น ปรึกษาเบื้องต้นได้ทาง LINE @detectivepluse" />
          <FieldSection id="f-notes" label="Notes" hint="โน้ตภายใน — ไม่เผยแพร่ ไม่เข้า Privacy Check" value={fields.notes} onChange={(v) => setField("notes", v)} minRows={2} disabled={!editable} placeholder="บริบท ไอเดียเพิ่ม สิ่งที่ต้องเช็ก" />

          <VariantsSection masterId={master.id} variants={data.variants} primaryPlatform={meta.primaryPlatform} aiAvailable={aiAvailable && editable} hasSource={!!(fields.script.trim() || fields.caption.trim())} />
          <CreativePlanSection masterId={master.id} plan={master.creative_plan} hasScript={!!fields.script.trim()} aiAvailable={aiAvailable && editable} />
        </div>

        <aside className="lg:col-span-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <RightPanel
            data={data}
            aiAvailable={aiAvailable && editable}
            aiReason={aiReason}
            fields={{ hook: fields.hook, script: fields.script, caption: fields.caption, cta: fields.cta }}
            onReplaceField={onReplaceField}
            onScriptApplied={onScriptApplied}
            flush={flush}
          />
        </aside>
      </div>
    </div>
  );
}

function SaveIndicator({ state, onSave }: { state: SaveState; onSave: () => void }) {
  return (
    <span className="ml-1 inline-flex items-center gap-1.5 text-[11px]" role="status" aria-live="polite">
      {state.status === "saving" && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> กำลังบันทึก…
        </span>
      )}
      {state.status === "saved" && (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" /> บันทึกแล้ว {formatTimeBkk(state.at)}
        </span>
      )}
      {state.status === "dirty" && <span className="text-muted-foreground">มีการแก้ไข…</span>}
      {state.status === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <TriangleAlert className="h-3 w-3" /> บันทึกไม่สำเร็จ
        </span>
      )}
      {(state.status === "dirty" || state.status === "error") && (
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={onSave}>
          <Save className="h-3 w-3" /> บันทึก
        </Button>
      )}
    </span>
  );
}
