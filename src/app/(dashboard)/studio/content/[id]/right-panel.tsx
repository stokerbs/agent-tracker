"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AiModelTag, AiUnavailableBanner } from "@/components/studio/ai-status";
import { PrivacyBadge, SourceKindBadge, SupportBadge } from "@/components/studio/badges";
import { sourceHref } from "@/components/studio/source-list";
import { SOURCE_KIND_META, SUPPORT_STATUS_META } from "@/lib/studio/constants";
import { REWRITE_MODE_META, type RewriteMode } from "@/lib/studio/ai/prompts/rewrite";
import { summarizeFindings } from "@/lib/studio/privacy/scrub";
import type { GeneratedScript } from "@/lib/studio/ai";
import type { ContentClaim, PrivacyFinding, SupportStatus } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { addContentSource, applyGeneratedScript, deleteClaim, removeContentSource, searchSourceCandidates, updateClaim, type SourceCandidate } from "../actions";
import { formatDateTimeBkk } from "../format";
import type { MasterWithRelations } from "../queries";
import { aiGenerateCTA, aiGenerateHooks, aiGenerateScript, aiRewrite, runContentPrivacyCheck, type PrivacyCheckActionResult } from "./ai-actions";
import { AiPreviewDialog, type AiPreviewState } from "./ai-preview-dialog";
import { effectivePrivacy } from "@/lib/studio/privacy/gate";

export type EditableField = "hook" | "script" | "caption" | "cta";

export interface RightPanelProps {
  data: MasterWithRelations;
  aiAvailable: boolean;
  aiReason?: string;
  fields: Record<EditableField, string>;
  /** Replace a field in the editor (marks dirty → autosave). */
  onReplaceField: (field: EditableField, text: string) => void;
  /** Server already saved the generated script; sync editor state without re-saving. */
  onScriptApplied: (d: { hook: string; script: string; caption: string; cta: string }) => void;
  /** Flush pending autosave (so server-side AI actions read the latest copy). */
  flush: () => Promise<void>;
}

const FIELD_LABEL: Record<EditableField, string> = { hook: "Hook", script: "Script", caption: "Caption", cta: "CTA" };
const SEVERITY: Record<PrivacyFinding["severity"], string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

function Section({ id, icon, title, action, children, className }: { id: string; icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("rounded-lg border border-border/70 bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <h3 id={`${id}-title`} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon} {title}
        </h3>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function RightPanel({ data, aiAvailable, aiReason, fields, onReplaceField, onScriptApplied, flush }: RightPanelProps) {
  const router = useRouter();
  const { master } = data;
  const [preview, setPreview] = useState<AiPreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const aiDisabledTitle = aiAvailable ? undefined : "AI ยังใช้งานไม่ได้ — ตรวจสอบตั้งค่าสตูดิโอ";

  return (
    <div className="space-y-4">
      {!aiAvailable && <AiUnavailableBanner reason={aiReason} />}

      <SourcesSection data={data} />
      <PrivacySection data={data} aiAvailable={aiAvailable} flush={flush} />
      <ClaimsSection data={data} />
      <NotesAndHooks
        data={data}
        aiAvailable={aiAvailable}
        hook={fields.hook}
        onUseHook={(t) => {
          onReplaceField("hook", t);
          toast.success("แทนที่ hook แล้ว — บันทึกอัตโนมัติ");
        }}
        flush={flush}
      />
      <AiActionsSection
        data={data}
        aiAvailable={aiAvailable}
        aiDisabledTitle={aiDisabledTitle}
        fields={fields}
        flush={flush}
        setPreview={setPreview}
        setPreviewLoading={setPreviewLoading}
        onReplaceField={onReplaceField}
        onScriptApplied={onScriptApplied}
        setApplying={setApplying}
        refresh={() => router.refresh()}
      />
      <ReviewsSection data={data} />

      <AiPreviewDialog state={preview} loading={previewLoading} pending={applying} onClose={() => setPreview(null)} />
    </div>
  );
}

// ─── 1. Sources ──────────────────────────────────────────────────────────────
function SourcesSection({ data }: { data: MasterWithRelations }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const general = data.sources.filter((s) => s.source_kind === "ai_general");
  const real = data.sources.filter((s) => s.source_kind !== "ai_general");

  function remove(id: string) {
    setRemoving(id);
    start(async () => {
      const res = await removeContentSource({ id, masterId: data.master.id });
      setRemoving(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Section
      id="sources"
      icon={<BookOpen className="h-3.5 w-3.5" />}
      title="แหล่งข้อมูล"
      action={
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> เพิ่มแหล่งข้อมูล
        </Button>
      }
    >
      {data.sources.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีการอ้างอิงแหล่งข้อมูล — เพิ่มจากคลังความรู้เพื่อให้ตอบได้ว่า &quot;เนื้อหานี้มาจากไหน&quot;</p>
      ) : (
        <ul className="space-y-1.5">
          {real.map((s) => {
            const href = sourceHref({ kind: s.source_kind as never, id: s.source_id, label: s.label, case_id: s.case_id });
            return (
              <li key={s.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5">
                <SourceKindBadge kind={s.source_kind} />
                {href ? (
                  <Link href={href} className="min-w-0 flex-1 truncate text-sm hover:text-primary hover:underline" title={s.note ?? s.label}>
                    {s.label}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm" title={s.note ?? s.label}>
                    {s.label}
                  </span>
                )}
                {href && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove(s.id)} disabled={pending} aria-label={`ลบแหล่งข้อมูล ${s.label}`}>
                  {removing === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </Button>
              </li>
            );
          })}
          {general.length > 0 && (
            <li className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{SOURCE_KIND_META.ai_general.label} — บางส่วนไม่ได้มาจากคลังความรู้ของ Detective Pulse ตรวจสอบก่อนอนุมัติ</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => remove(general[0].id)} disabled={pending} aria-label="ลบการอ้างอิงความรู้ทั่วไปของ AI">
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          )}
        </ul>
      )}
      <AddSourceDialog open={open} onOpenChange={setOpen} masterId={data.master.id} />
    </Section>
  );
}

function AddSourceDialog({ open, onOpenChange, masterId }: { open: boolean; onOpenChange: (v: boolean) => void; masterId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "external">("search");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SourceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || tab !== "search") return;
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchSourceCandidates({ q: term });
      setSearching(false);
      if (res.ok) setItems(res.data.items);
      else toast.error(res.error);
    }, 350);
    return () => clearTimeout(t);
  }, [q, open, tab]);

  function add(input: { kind: SourceCandidate["kind"] | "external"; sourceId: string | null; label: string; note?: string | null }) {
    start(async () => {
      const res = await addContentSource({ masterId, ...input });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("เพิ่มแหล่งข้อมูลแล้ว");
      setLabel("");
      setNote("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>เพิ่มแหล่งข้อมูล</DialogTitle>
          <DialogDescription>เชื่อมคอนเทนต์กับความรู้จริงของ Detective Pulse หรือระบุแหล่งภายนอกที่ตรวจสอบแล้ว</DialogDescription>
        </DialogHeader>
        <div className="inline-flex h-8 items-center rounded-lg bg-muted p-0.5 text-xs" role="tablist">
          {(
            [
              ["search", "ค้นหาในคลัง"],
              ["external", "แหล่งภายนอก"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === k ? "bg-background text-foreground shadow" : "text-muted-foreground")}>
              {l}
            </button>
          ))}
        </div>
        {tab === "search" ? (
          <div className="space-y-2">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อความรู้ / บทเรียนจากเคส / คำถามลูกค้า…" aria-label="ค้นหาแหล่งข้อมูล" />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {searching && (
                <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังค้นหา…
                </p>
              )}
              {!searching && q.trim().length >= 2 && items.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">ไม่พบรายการ — ลองคำอื่น หรือเพิ่มความรู้ใหม่ในคลังก่อน</p>}
              {items.map((it) => (
                <button
                  key={`${it.kind}-${it.id}`}
                  type="button"
                  disabled={pending}
                  onClick={() => add({ kind: it.kind, sourceId: it.id, label: it.label })}
                  className="flex w-full items-center gap-2 rounded-md border border-border/60 px-2.5 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SourceKindBadge kind={it.kind} />
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {!it.approved && <span className="text-[10px] text-amber-600 dark:text-amber-400">ยังไม่อนุมัติให้ AI ใช้</span>}
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ชื่อแหล่งข้อมูล เช่น พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล ม.24" maxLength={300} aria-label="ชื่อแหล่งข้อมูลภายนอก" />
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="หมายเหตุ / ลิงก์ / ทำไมเชื่อถือได้" maxLength={1000} aria-label="หมายเหตุ" />
            <div className="flex justify-end">
              <Button size="sm" disabled={!label.trim() || pending} onClick={() => add({ kind: "external", sourceId: null, label: label.trim(), note: note.trim() || null })}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} เพิ่ม
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── 2. Privacy ──────────────────────────────────────────────────────────────
function PrivacySection({ data, aiAvailable, flush }: { data: MasterWithRelations; aiAvailable: boolean; flush: () => Promise<void> }) {
  const router = useRouter();
  const latest = data.privacyChecks[0] ?? null;
  const gate = effectivePrivacy(data.privacyChecks);
  const [last, setLast] = useState<PrivacyCheckActionResult | null>(null);
  const [running, setRunning] = useState<"fast" | "ai" | null>(null);
  const [, start] = useTransition();

  function run(useAi: boolean) {
    setRunning(useAi ? "ai" : "fast");
    start(async () => {
      await flush();
      const res = await runContentPrivacyCheck({ masterId: data.master.id, useAi });
      setRunning(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLast(res.data);
      if (res.data.ai_error) toast.warning(`ตรวจแบบเร็วสำเร็จ แต่ AI ตรวจไม่ได้: ${res.data.ai_error}`);
      else toast.success(res.data.status === "safe" ? "ผ่าน — ไม่พบข้อมูลระบุตัวตน" : res.data.status === "blocked" ? "พบข้อมูลที่ต้องเอาออก" : "พบจุดที่ควรตรวจสอบ");
      router.refresh();
    });
  }

  const findings = latest?.findings ?? [];
  return (
    <Section id="privacy" icon={<ShieldCheck className="h-3.5 w-3.5" />} title="Privacy Check">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PrivacyBadge status={latest?.status ?? null} size="md" />
        {gate.verdictGoverns && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400">
            ผล AI ล่าสุด “{gate.verdict?.status === "blocked" ? "บล็อก" : "ต้องตรวจสอบ"}” ยังมีผลต่อการอนุมัติ — รันตรวจด้วย AI ใหม่ หรือ override ตอนอนุมัติ
          </span>
        )}
        {latest && (
          <span className="text-[11px] text-muted-foreground">
            {formatDateTimeBkk(latest.created_at)} · {latest.checked_by === "ai" ? `AI${latest.model ? ` (${latest.model})` : ""}` : latest.checked_by === "human" ? "คน" : "อัตโนมัติ"}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-foreground/90">{last?.summary ?? (latest ? summarizeFindings(findings) : "ยังไม่เคยตรวจ — ส่งตรวจ/อนุมัติจะรันการตรวจอัตโนมัติ หรือกดตรวจตอนนี้")}</p>

      {findings.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {findings.map((f, i) => (
            <li key={i} className={cn("rounded-md border px-2.5 py-1.5 text-xs", SEVERITY[f.severity])}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium">{f.kind}</span>
                {f.field && <span className="opacity-70">· {f.field}</span>}
                <span className="ml-auto text-[10px] uppercase opacity-70">
                  {f.severity} · {f.source === "ai" ? "AI" : "auto"}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] opacity-90">“{f.excerpt}”</p>
              <p className="mt-0.5 opacity-80">{f.reason}</p>
            </li>
          ))}
        </ul>
      )}

      {last?.suggestions?.length ? (
        <div className="mt-3 rounded-md border border-violet-500/30 bg-violet-500/5 px-2.5 py-2">
          <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400">AI แนะนำวิธีทำให้ทั่วไปขึ้น</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
            {last.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => run(false)} disabled={running !== null}>
          {running === "fast" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} ตรวจอีกครั้ง (เร็ว)
        </Button>
        <Button size="sm" variant="outline" onClick={() => run(true)} disabled={running !== null || !aiAvailable} title={!aiAvailable ? "AI ยังใช้งานไม่ได้" : undefined}>
          {running === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} ตรวจด้วย AI
        </Button>
      </div>
      {data.privacyChecks.length > 1 && <p className="mt-2 text-[10px] text-muted-foreground">ประวัติ {data.privacyChecks.length} ครั้ง — ทุกครั้งถูกบันทึกไว้เป็นหลักฐาน</p>}
    </Section>
  );
}

// ─── 3. Claims ───────────────────────────────────────────────────────────────
const SUPPORT_OPTIONS: SupportStatus[] = ["needs_review", "supported", "partially_supported", "ai_suggestion", "unsupported"];

function ClaimsSection({ data }: { data: MasterWithRelations }) {
  const router = useRouter();
  const claims = data.claims;
  const counts = claims.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.support_status]: (acc[c.support_status] ?? 0) + 1 }), {});
  const summary = Object.entries(counts)
    .map(([k, n]) => `${n} ${SUPPORT_STATUS_META[k as SupportStatus]?.label ?? k}`)
    .join(" · ");
  const warn = (counts.unsupported ?? 0) + (counts.needs_review ?? 0);

  return (
    <Section id="claims" icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Fact Check" action={claims.length ? <span className="text-[11px] text-muted-foreground">{summary}</span> : null}>
      {claims.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มี claim — เมื่อให้ AI เขียนสคริปต์ ระบบจะแยกข้อกล่าวอ้างพร้อมแหล่งอ้างอิงมาให้ตรวจ</p>
      ) : (
        <>
          {warn > 0 && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {warn} claim ต้องตรวจหรือไม่มีแหล่งอ้างอิง — อนุมัติต้องรับทราบก่อน
            </p>
          )}
          <ul className="space-y-2">
            {claims.map((c) => (
              <ClaimRow key={c.id} claim={c} masterId={data.master.id} onDone={() => router.refresh()} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function ClaimRow({ claim, masterId, onDone }: { claim: ContentClaim; masterId: string; onDone: () => void }) {
  const [status, setStatus] = useState<SupportStatus>(claim.support_status as SupportStatus);
  const [note, setNote] = useState(claim.note ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [pending, start] = useTransition();
  const risky = status === "unsupported" || status === "needs_review";

  function persist(next: SupportStatus, nextNote: string) {
    start(async () => {
      const res = await updateClaim({ id: claim.id, masterId, supportStatus: next, note: nextNote.trim() || null });
      if (!res.ok) {
        toast.error(res.error);
        setStatus(claim.support_status as SupportStatus);
        return;
      }
      onDone();
    });
  }
  function remove() {
    start(async () => {
      const res = await deleteClaim({ id: claim.id, masterId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <li className={cn("rounded-md border px-2.5 py-2", risky ? "border-amber-500/40 bg-amber-500/5" : "border-border/60")}>
      <p className="text-sm leading-snug">{claim.claim}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as SupportStatus);
            persist(v as SupportStatus, note);
          }}
          disabled={pending}
        >
          <SelectTrigger className="h-7 w-[170px] text-xs" aria-label="สถานะแหล่งอ้างอิง">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORT_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {SUPPORT_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SupportBadge status={status} />
        {claim.source_kind && <SourceKindBadge kind={claim.source_kind} />}
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => setEditingNote((v) => !v)}>
          <MessageSquareText className="h-3.5 w-3.5" /> {note ? "แก้โน้ต" : "โน้ต"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={remove} disabled={pending} aria-label="ลบ claim">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {editingNote ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น อ้างอิงบทความ K3 ย่อหน้า 2" className="h-7 text-xs" maxLength={1000} aria-label="โน้ต claim" />
          <Button
            size="sm"
            className="h-7"
            disabled={pending}
            onClick={() => {
              setEditingNote(false);
              persist(status, note);
            }}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : note ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
      ) : null}
    </li>
  );
}

// ─── 4. AI notes + hook analysis ─────────────────────────────────────────────
function NotesAndHooks({ data, aiAvailable, hook, onUseHook, flush }: { data: MasterWithRelations; aiAvailable: boolean; hook: string; onUseHook: (t: string) => void; flush: () => Promise<void> }) {
  const [hooks, setHooks] = useState<{ text: string; angle: string; why: string }[] | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, start] = useTransition();

  function gen() {
    setLoading(true);
    start(async () => {
      await flush();
      const res = await aiGenerateHooks(data.master.id);
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHooks(res.data.data.hooks);
      setModel(res.data.model);
    });
  }

  const len = hook.trim().length;
  const lines = hook.trim() ? hook.trim().split(/\n/).length : 0;

  return (
    <Section id="hooks" icon={<Wand2 className="h-3.5 w-3.5" />} title="AI Notes · Hook">
      {data.master.ai_notes ? (
        <div className="mb-3 rounded-md border border-violet-500/20 bg-violet-500/5 px-2.5 py-2">
          <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400">โน้ตจาก AI (ตอนสร้างสคริปต์)</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground/90">{data.master.ai_notes}</p>
        </div>
      ) : (
        <p className="mb-3 text-[11px] text-muted-foreground">ยังไม่มีโน้ตจาก AI — จะปรากฏหลังให้ AI เขียนสคริปต์</p>
      )}

      <div className="rounded-md border border-border/60 px-2.5 py-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Hook ปัจจุบัน</span>
          <span className="tabular-nums">
            {len} ตัวอักษร · {lines} บรรทัด{len > 90 ? " · ยาว — 3 วินาทีแรกควรสั้น" : ""}
          </span>
        </div>
        <p className={cn("mt-1 text-sm", !hook.trim() && "italic text-muted-foreground")}>{hook.trim() || "ยังไม่มี hook"}</p>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">6 hooks ทางเลือก (คนละมุม)</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={gen} disabled={!aiAvailable || loading} title={!aiAvailable ? "AI ยังใช้งานไม่ได้" : undefined}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {hooks ? "สร้างชุดใหม่" : "สร้าง hooks"}
        </Button>
      </div>
      {loading && (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          AI กำลังคิด hooks… (10–30 วินาที)
        </p>
      )}
      {hooks && !loading && (
        <ul className="mt-2 space-y-1.5">
          {hooks.map((h, i) => (
            <li key={i} className="rounded-md border border-border/60 px-2.5 py-2">
              <p className="text-sm">{h.text}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted-foreground" title={h.why}>
                  {h.angle.replace(/_/g, " ")} · {h.why}
                </span>
                <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-xs" onClick={() => onUseHook(h.text)}>
                  ใช้อันนี้
                </Button>
              </div>
            </li>
          ))}
          {model && (
            <li className="pt-1">
              <AiModelTag model={model} />
            </li>
          )}
        </ul>
      )}
    </Section>
  );
}

// ─── 5. AI actions grid ──────────────────────────────────────────────────────
const REWRITE_GRID: { mode: RewriteMode; field?: EditableField }[] = [
  { mode: "rewrite_hook", field: "hook" },
  { mode: "shorten" },
  { mode: "more_viral" },
  { mode: "more_professional" },
  { mode: "more_natural_thai" },
  { mode: "alternative_version" },
];

function AiActionsSection({
  data,
  aiAvailable,
  aiDisabledTitle,
  fields,
  flush,
  setPreview,
  setPreviewLoading,
  onReplaceField,
  onScriptApplied,
  setApplying,
  refresh,
}: {
  data: MasterWithRelations;
  aiAvailable: boolean;
  aiDisabledTitle?: string;
  fields: Record<EditableField, string>;
  flush: () => Promise<void>;
  setPreview: (s: AiPreviewState | null) => void;
  setPreviewLoading: (v: boolean) => void;
  onReplaceField: (f: EditableField, t: string) => void;
  onScriptApplied: (d: { hook: string; script: string; caption: string; cta: string }) => void;
  setApplying: (v: boolean) => void;
  refresh: () => void;
}) {
  const [target, setTarget] = useState<EditableField>("script");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const masterId = data.master.id;

  function rewrite(mode: RewriteMode, field: EditableField, customInstruction?: string) {
    const text = fields[field];
    if (!text.trim()) {
      toast.error(`${FIELD_LABEL[field]} ยังว่าง — พิมพ์หรือสร้างก่อน`);
      return;
    }
    setBusy(mode);
    setPreviewLoading(true);
    start(async () => {
      const res = await aiRewrite({ masterId, mode, field, text, customInstruction: customInstruction ?? null });
      setPreviewLoading(false);
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview({
        title: `${REWRITE_MODE_META[mode].label} · ${FIELD_LABEL[field]}`,
        text: res.data.data.text,
        changeNote: res.data.data.change_note,
        model: res.data.model,
        onApply: () => {
          onReplaceField(field, res.data.data.text);
          setPreview(null);
          toast.success(`แทนที่ ${FIELD_LABEL[field]} แล้ว — บันทึกอัตโนมัติ`);
        },
      });
    });
  }

  function cta() {
    setBusy("cta");
    setPreviewLoading(true);
    start(async () => {
      await flush();
      const res = await aiGenerateCTA(masterId);
      setPreviewLoading(false);
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const options = res.data.data.options;
      let chosen = options[0]?.text ?? "";
      setPreview({
        title: "ตัวเลือก CTA",
        description: "เลือกหนึ่งตัวเลือกแล้วกดใช้แทน",
        model: res.data.model,
        applyLabel: "ใช้ CTA นี้",
        children: <CtaPicker options={options} onPick={(t) => (chosen = t)} />,
        onApply: () => {
          if (!chosen) return;
          onReplaceField("cta", chosen);
          setPreview(null);
          toast.success("แทนที่ CTA แล้ว — บันทึกอัตโนมัติ");
        },
      });
    });
  }

  function script() {
    setBusy("script");
    setPreviewLoading(true);
    start(async () => {
      await flush();
      const res = await aiGenerateScript({ masterId });
      setPreviewLoading(false);
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const g = res.data.data;
      setPreview({
        title: "สคริปต์ใหม่จาก AI",
        description: "จะแทนที่ hook / script / caption / CTA รวมถึงรายการ claim และเพิ่มแหล่งข้อมูลที่ AI อ้างอิง แล้วรัน Privacy Check อัตโนมัติ",
        model: res.data.model,
        applyLabel: "ใช้แทนทั้งชุด",
        children: <ScriptPreview g={g} />,
        onApply: async () => {
          setApplying(true);
          const applied = await applyGeneratedScript({
            masterId,
            hook: g.hook,
            script: g.script,
            caption: g.caption,
            cta: g.cta,
            aiNotes: g.ai_notes,
            sourceRefs: g.source_refs,
            claims: g.claims,
          });
          setApplying(false);
          if (!applied.ok) {
            toast.error(applied.error);
            return;
          }
          onScriptApplied({ hook: g.hook, script: g.script, caption: g.caption, cta: g.cta });
          setPreview(null);
          toast.success(`ใช้สคริปต์ใหม่แล้ว · Privacy Check: ${applied.data.privacyStatus}`);
          refresh();
        },
      });
    });
  }

  const disabled = !aiAvailable || busy !== null;

  return (
    <Section id="ai-actions" icon={<Sparkles className="h-3.5 w-3.5 text-violet-500" />} title="AI Actions" action={<AiModelTag model="preview → ยืนยันก่อนแทน" className="border-border/60 bg-muted text-muted-foreground" />}>
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">ปรับฟิลด์:</span>
        <Select value={target} onValueChange={(v) => setTarget(v as EditableField)}>
          <SelectTrigger className="h-7 w-[120px] text-xs" aria-label="ฟิลด์ที่จะปรับ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["script", "caption", "cta", "hook"] as EditableField[]).map((f) => (
              <SelectItem key={f} value={f} className="text-xs">
                {FIELD_LABEL[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {REWRITE_GRID.map(({ mode, field }) => (
          <Button key={mode} size="sm" variant="outline" className="h-8 justify-start text-xs" onClick={() => rewrite(mode, field ?? target)} disabled={disabled} title={aiDisabledTitle ?? REWRITE_MODE_META[mode].instruction}>
            {busy === mode ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {REWRITE_MODE_META[mode].label}
            {field && <span className="ml-auto text-[10px] text-muted-foreground">hook</span>}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="h-8 justify-start text-xs" onClick={cta} disabled={disabled} title={aiDisabledTitle}>
          {busy === "cta" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} สร้างตัวเลือก CTA
        </Button>
        <Button size="sm" className="h-8 justify-start text-xs" onClick={script} disabled={disabled} title={aiDisabledTitle}>
          {busy === "script" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} เขียนสคริปต์ใหม่ด้วย AI
        </Button>
      </div>

      <div className="mt-3 space-y-1.5">
        <label htmlFor="custom-instr" className="text-[11px] font-medium text-muted-foreground">
          สั่งเอง ({FIELD_LABEL[target]})
        </label>
        <div className="flex gap-1.5">
          <Input
            id="custom-instr"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="เช่น เปลี่ยนตอนจบให้ชวนคิดต่อ ไม่ต้องขาย"
            className="h-8 text-xs"
            maxLength={1000}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) rewrite("custom", target, custom.trim());
            }}
          />
          <Button size="sm" className="h-8" onClick={() => rewrite("custom", target, custom.trim())} disabled={disabled || !custom.trim()} title={aiDisabledTitle}>
            {busy === "custom" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function CtaPicker({ options, onPick }: { options: { text: string; style: string }[]; onPick: (t: string) => void }) {
  const [sel, setSel] = useState(0);
  const STYLE: Record<string, string> = { soft: "นุ่ม", educational: "ให้ความรู้", direct: "ตรง (สุภาพ)" };
  return (
    <ul className="space-y-1.5" role="radiogroup" aria-label="ตัวเลือก CTA">
      {options.map((o, i) => (
        <li key={i}>
          <button
            type="button"
            role="radio"
            aria-checked={sel === i}
            onClick={() => {
              setSel(i);
              onPick(o.text);
            }}
            className={cn("flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", sel === i ? "border-primary bg-primary/5" : "border-border/70 hover:bg-accent/50")}
          >
            <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full border", sel === i ? "border-primary bg-primary" : "border-muted-foreground/50")} />
            <span className="flex-1">{o.text}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{STYLE[o.style] ?? o.style}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ScriptPreview({ g }: { g: GeneratedScript }) {
  const [tab, setTab] = useState<"script" | "caption" | "claims">("script");
  return (
    <div className="space-y-2">
      <div className="inline-flex h-8 items-center rounded-lg bg-muted p-0.5 text-xs" role="tablist">
        {(
          [
            ["script", "Hook + Script"],
            ["caption", "Caption + CTA"],
            ["claims", `Claims (${g.claims.length}) · แหล่ง (${g.source_refs.length})`],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-md px-3 py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === k ? "bg-background text-foreground shadow" : "text-muted-foreground")}>
            {l}
          </button>
        ))}
      </div>
      {tab === "script" && (
        <div className="space-y-2">
          <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm font-medium">{g.hook}</p>
          <pre className="whitespace-pre-wrap rounded-md border border-border/70 bg-muted/30 px-3 py-2.5 font-sans text-sm leading-relaxed">{g.script}</pre>
          <p className="text-[11px] text-muted-foreground">ประมาณ {g.estimated_duration_sec} วิ</p>
        </div>
      )}
      {tab === "caption" && (
        <div className="space-y-2">
          <pre className="whitespace-pre-wrap rounded-md border border-border/70 bg-muted/30 px-3 py-2.5 font-sans text-sm leading-relaxed">{g.caption}</pre>
          <p className="rounded-md border border-border/70 px-3 py-2 text-sm text-primary">{g.cta}</p>
        </div>
      )}
      {tab === "claims" && (
        <div className="space-y-2">
          <ul className="space-y-1">
            {g.claims.map((c, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
                <SupportBadge status={c.support_status} />
                <span className="flex-1">{c.claim}</span>
              </li>
            ))}
            {g.claims.length === 0 && <li className="text-xs text-muted-foreground">ไม่มี claim ที่ต้องตรวจ</li>}
          </ul>
          <div className="flex flex-wrap gap-1">
            {g.source_refs.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px]">
                <SourceKindBadge kind={s.kind} /> {s.label}
              </span>
            ))}
          </div>
          {g.ai_notes && <p className="text-xs text-muted-foreground">AI notes: {g.ai_notes}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Reviews history ─────────────────────────────────────────────────────────
const DECISION: Record<string, { label: string; cls: string }> = {
  approve: { label: "อนุมัติ", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  reject: { label: "ไม่ผ่าน", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  request_changes: { label: "ขอแก้ไข", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  override_privacy: { label: "Override privacy", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" },
};

function ReviewsSection({ data }: { data: MasterWithRelations }) {
  return (
    <Section id="reviews" icon={<History className="h-3.5 w-3.5" />} title="ประวัติการตรวจ">
      {data.reviews.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีการตัดสินใจ</p>
      ) : (
        <ol className="space-y-1.5">
          {data.reviews.map((r) => {
            const d = DECISION[r.decision] ?? { label: r.decision, cls: "bg-muted text-muted-foreground border-border" };
            return (
              <li key={r.id} className="rounded-md border border-border/60 px-2.5 py-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", d.cls)}>{d.label}</span>
                  <span className="text-muted-foreground">{r.reviewer_name ?? "—"}</span>
                  <span className="ml-auto text-muted-foreground">{formatDateTimeBkk(r.created_at)}</span>
                </div>
                {r.note && <p className="mt-1 text-foreground/90">{r.note}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
