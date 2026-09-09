"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_META, PLATFORMS } from "@/lib/studio/constants";
import { recordMetrics } from "./actions";
import { bangkokLocalInputToIso, toBangkokLocalInput } from "../content/format";

type NumericField =
  | "views"
  | "reach"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "avg_watch_sec"
  | "completion_rate"
  | "profile_visits"
  | "dms"
  | "leads"
  | "qualified_leads"
  | "conversions";

const FIELD_GROUPS: { title: string; fields: { key: NumericField; label: string; hint?: string; step?: string; max?: number }[] }[] = [
  {
    title: "การเข้าถึง",
    fields: [
      { key: "views", label: "ยอดวิว (views)" },
      { key: "reach", label: "Reach" },
      { key: "avg_watch_sec", label: "เวลาดูเฉลี่ย (วินาที)", step: "0.1" },
      { key: "completion_rate", label: "ดูจบ (%)", hint: "0–100", step: "0.1", max: 100 },
    ],
  },
  {
    title: "การมีส่วนร่วม",
    fields: [
      { key: "likes", label: "ไลก์" },
      { key: "comments", label: "คอมเมนต์" },
      { key: "shares", label: "แชร์" },
      { key: "saves", label: "บันทึก (saves)" },
    ],
  },
  {
    title: "ผลทางธุรกิจ",
    fields: [
      { key: "profile_visits", label: "เข้าโปรไฟล์" },
      { key: "dms", label: "ทัก DM / LINE" },
      { key: "leads", label: "Leads" },
      { key: "qualified_leads", label: "Qualified leads", hint: "คุยแล้วมีโอกาสจ้างจริง" },
      { key: "conversions", label: "ปิดงานได้" },
    ],
  },
];

type FormState = Record<NumericField, string> & { platform: string; recorded_at: string; note: string };

function emptyForm(platform: string): FormState {
  const base = Object.fromEntries(FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, ""]))) as Record<NumericField, string>;
  return { ...base, platform, recorded_at: toBangkokLocalInput(new Date()), note: "" };
}

/** Parent should pass `key={master.id}` so the form resets per content piece. */
export function MetricsDialog({
  open,
  onOpenChange,
  master,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  master: { id: string; title: string; primary_platform: string | null } | null;
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(master?.primary_platform ?? "tiktok"));
  const [pending, start] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!master) return;
    start(async () => {
      try {
        const res = await recordMetrics({
          master_id: master.id,
          platform: form.platform,
          recorded_at: bangkokLocalInputToIso(form.recorded_at) ?? new Date().toISOString(),
          note: form.note,
          ...Object.fromEntries(FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, form[f.key] === "" ? null : form[f.key]]))),
        });
        if (res.ok) {
          toast.success("บันทึกผลแล้ว");
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>บันทึกผลคอนเทนต์</DialogTitle>
          <DialogDescription className="line-clamp-2">{master?.title ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>แพลตฟอร์ม</Label>
              <Select value={form.platform} onValueChange={(v) => set("platform", v)} disabled={pending}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PLATFORM_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recorded_at">เวลาที่อ่านค่า</Label>
              <Input id="recorded_at" type="datetime-local" value={form.recorded_at} onChange={(e) => set("recorded_at", e.target.value)} disabled={pending} className="h-9" />
            </div>
          </div>

          {FIELD_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {g.fields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label htmlFor={f.key} className="text-xs">
                      {f.label}
                    </Label>
                    <Input
                      id={f.key}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={f.max}
                      step={f.step ?? "1"}
                      placeholder="—"
                      value={form[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      disabled={pending}
                      className="h-9 tabular-nums"
                    />
                    {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="note">หมายเหตุ</Label>
            <Textarea id="note" rows={2} maxLength={1000} value={form.note} onChange={(e) => set("note", e.target.value)} disabled={pending} placeholder="เช่น ยอดจากแอป TikTok ณ 7 วันหลังโพสต์" />
          </div>
          <p className="text-[11px] text-muted-foreground">ช่องที่เว้นว่างจะบันทึกเป็น &quot;ไม่ทราบ&quot; (null) — ไม่ใช่ 0 · แหล่งข้อมูล: manual</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button size="sm" onClick={submit} disabled={pending || !master}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกผล
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
