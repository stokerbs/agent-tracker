"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SENSITIVITY_META } from "@/lib/studio/constants";
import { scrubText, summarizeFindings } from "@/lib/studio/privacy/scrub";
import type { PrivacyFinding, PrivacyRules, Sensitivity, StudioCase } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { createCase, updateCase, type CaseInput } from "./actions";
import { CASE_FIELD_LABELS, CASE_TEXT_FIELDS, CASE_TYPES, CASE_TYPE_META, POTENTIAL_META, PRIVACY_NOTE, type CaseTextField } from "./case-types";

const SENSITIVITIES = Object.keys(SENSITIVITY_META) as Sensitivity[];

function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))).slice(0, 20);
}

const TEXTAREAS: { key: Exclude<CaseTextField, "title">; rows: number; hint: string }[] = [
  { key: "situation", rows: 4, hint: "ลูกค้ามาด้วยปัญหาอะไร — เล่าแบบกว้าง ๆ ไม่ระบุตัวบุคคล สถานที่จริง หรือวันที่" },
  { key: "objective", rows: 2, hint: "ต้องการพิสูจน์/หาอะไร" },
  { key: "method", rows: 4, hint: "วิธีการที่ใช้ในระดับหลักการ — ไม่เผยเทคนิคที่ทำให้ทีมภาคสนามเสี่ยง" },
  { key: "observations", rows: 4, hint: "สิ่งที่พบระหว่างงาน (generalise แล้ว)" },
  { key: "outcome", rows: 3, hint: "ผลลัพธ์ที่ลูกค้าได้รับ" },
  { key: "lessons", rows: 3, hint: "บทเรียนสำหรับทีมและสำหรับคนทั่วไป" },
  { key: "interesting_insight", rows: 3, hint: "จุดพลิก / สิ่งที่คนทั่วไปคาดไม่ถึง" },
  { key: "anonymized_version", rows: 5, hint: "เรื่องเล่าแบบไม่ระบุตัวตน 4–8 ประโยค (AI ช่วยร่างให้ได้จากหน้าเคส)" },
];

export function CaseForm({ initial, privacyRules }: { initial?: StudioCase; privacyRules: Partial<PrivacyRules> | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [caseCode, setCaseCode] = useState(initial?.case_code ?? "");
  const [caseType, setCaseType] = useState(initial?.case_type ?? "other");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState<Record<Exclude<CaseTextField, "title">, string>>({
    situation: initial?.situation ?? "",
    objective: initial?.objective ?? "",
    method: initial?.method ?? "",
    observations: initial?.observations ?? "",
    outcome: initial?.outcome ?? "",
    lessons: initial?.lessons ?? "",
    interesting_insight: initial?.interesting_insight ?? "",
    anonymized_version: initial?.anonymized_version ?? "",
  });
  const [potential, setPotential] = useState(initial?.content_potential ?? "medium");
  const [sensitivity, setSensitivity] = useState<string>(initial?.sensitivity ?? "confidential");
  const [approved, setApproved] = useState(initial?.approved_for_content ?? false);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [linkedCaseId, setLinkedCaseId] = useState(initial?.linked_case_id ?? "");

  // Live deterministic privacy scan (same function the server runs).
  const findings = useMemo<PrivacyFinding[]>(() => {
    const fields: Record<string, string> = { title };
    for (const k of CASE_TEXT_FIELDS) if (k !== "title") fields[k] = text[k];
    return scrubText({ fields, rules: privacyRules });
  }, [title, text, privacyRules]);
  const highCount = findings.filter((f) => f.severity === "high").length;
  const approveBlocked = highCount > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: CaseInput = {
      case_code: caseCode,
      case_type: caseType,
      title,
      situation: text.situation || null,
      objective: text.objective || null,
      method: text.method || null,
      observations: text.observations || null,
      outcome: text.outcome || null,
      lessons: text.lessons || null,
      interesting_insight: text.interesting_insight || null,
      anonymized_version: text.anonymized_version || null,
      content_potential: potential as CaseInput["content_potential"],
      sensitivity: sensitivity as CaseInput["sensitivity"],
      approved_for_content: approved && !approveBlocked,
      tags: parseTags(tags),
      linked_case_id: linkedCaseId.trim() || null,
    };
    start(async () => {
      const res = initial ? await updateCase(initial.id, payload) : await createCase(payload);
      if (!res.ok) { toast.error(res.error); return; }
      if (res.data.approvalDowngraded) toast.warning("บันทึกแล้ว แต่ยังอนุมัติให้ AI ใช้ไม่ได้ — พบข้อมูลระบุตัวตนระดับสูง");
      else toast.success(initial ? "บันทึกเคสแล้ว" : "เพิ่มเคสแล้ว");
      router.push(`/studio/cases/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{PRIVACY_NOTE} — ระบบสแกนอัตโนมัติขณะพิมพ์ และจะไม่ให้อนุมัติให้ AI ใช้หากยังพบข้อมูลระดับสูง</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="c-code">รหัสเคส *</Label>
          <Input id="c-code" value={caseCode} onChange={(e) => setCaseCode(e.target.value)} required maxLength={40} placeholder="DP-K-0007" className="font-mono uppercase" />
          <p className="text-[11px] text-muted-foreground">รหัสภายในของสตูดิโอ ต้องไม่ซ้ำ — ไม่ใช่เลขเคสจริง</p>
        </div>
        <div className="space-y-1.5">
          <Label>ประเภทเคส *</Label>
          <Select value={caseType} onValueChange={setCaseType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CASE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{CASE_TYPE_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ศักยภาพเป็นคอนเทนต์</Label>
          <Select value={potential} onValueChange={setPotential}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(POTENTIAL_META).map((p) => (
                <SelectItem key={p} value={p}>{POTENTIAL_META[p].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-title">ชื่อเคส *</Label>
        <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} placeholder="เช่น รถจอดที่เดิม แต่คนไม่ได้อยู่กับรถ" />
      </div>

      {TEXTAREAS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`c-${f.key}`}>{CASE_FIELD_LABELS[f.key]}</Label>
          <Textarea id={`c-${f.key}`} value={text[f.key]} onChange={(e) => setText((prev) => ({ ...prev, [f.key]: e.target.value }))} rows={f.rows} placeholder={f.hint} />
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>ระดับความอ่อนไหว</Label>
          <Select value={sensitivity} onValueChange={setSensitivity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SENSITIVITIES.map((s) => (
                <SelectItem key={s} value={s}>{SENSITIVITY_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-tags">แท็ก (คั่นด้วยจุลภาค)</Label>
          <Input id="c-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gps, เฝ้าติดตาม, บทเรียน" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="c-linked">เคสจริงที่เกี่ยวข้อง (UUID, ไม่บังคับ)</Label>
        <Input id="c-linked" value={linkedCaseId} onChange={(e) => setLinkedCaseId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className="font-mono text-xs" />
        <p className="text-[11px] text-muted-foreground">เป็นเพียงตัวชี้ (pointer) สำหรับทีมภายใน — สตูดิโอไม่อ่านหรือคัดลอกข้อมูลใด ๆ จากเคสจริง</p>
      </div>

      {/* Privacy scan result */}
      <div className={cn("rounded-lg border px-4 py-3", findings.length ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/30 bg-emerald-500/5")}>
        <div className="flex items-center gap-2 text-sm font-medium">
          {findings.length ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          <span>สแกนความเป็นส่วนตัว: {summarizeFindings(findings)}</span>
        </div>
        {findings.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {findings.slice(0, 12).map((f, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-muted-foreground">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", f.severity === "high" ? "bg-destructive/10 text-destructive" : f.severity === "medium" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
                  {f.severity === "high" ? "สูง" : f.severity === "medium" ? "กลาง" : "ต่ำ"}
                </span>
                <span className="text-foreground">{CASE_FIELD_LABELS[f.field as CaseTextField] ?? f.field}</span>
                <code className="rounded bg-muted px-1 text-[11px]">{f.excerpt}</code>
                <span>{f.reason}</span>
              </li>
            ))}
            {findings.length > 12 && <li className="text-muted-foreground">…และอีก {findings.length - 12} จุด</li>}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">บันทึกได้แม้มีคำเตือน (เป็นข้อมูลภายใน) แต่การอนุมัติให้ AI ใช้จะถูกปิดจนกว่าจะแก้จุดระดับสูงทั้งหมด</p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">อนุมัติให้ AI ใช้เคสนี้เป็นแหล่งข้อมูล</p>
          <p className="text-xs text-muted-foreground">
            {approveBlocked ? `ปิดอยู่ — พบข้อมูลระบุตัวตนระดับสูง ${highCount} จุด` : "AI จะใช้เฉพาะบทเรียนที่สกัดและอนุมัติแล้ว ไม่ใช่ข้อความดิบของเคส"}
          </p>
        </div>
        {approveBlocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span><Switch checked={false} disabled aria-label="อนุมัติให้ AI ใช้" /></span>
            </TooltipTrigger>
            <TooltipContent>แก้จุดระดับสูงทั้งหมดก่อนจึงเปิดได้</TooltipContent>
          </Tooltip>
        ) : (
          <Switch checked={approved} onCheckedChange={setApproved} aria-label="อนุมัติให้ AI ใช้" />
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>ยกเลิก</Button>
        <Button type="submit" disabled={pending || !caseCode.trim() || !title.trim()} className="gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? "บันทึกการแก้ไข" : "เพิ่มเคส"}
        </Button>
      </div>
    </form>
  );
}
