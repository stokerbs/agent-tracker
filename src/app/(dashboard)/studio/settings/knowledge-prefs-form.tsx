"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { KnowledgePrefs } from "./knowledge-prefs";
import { updateKnowledgePrefs } from "./actions";

export function KnowledgePrefsForm({ initial }: { initial: KnowledgePrefs }) {
  const [form, setForm] = useState<KnowledgePrefs>(initial);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        const res = await updateKnowledgePrefs(form);
        if (res.ok) toast.success("บันทึกค่าตั้งค่าความรู้แล้ว");
        else toast.error(res.error);
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <ToggleRow
          label="ให้น้ำหนักบทเรียนจากเคสก่อน"
          hint="เมื่อค้นบริบท ให้ studio_case_insights ที่อนุมัติแล้วมาก่อนคลังความรู้ทั่วไป"
          checked={form.prefer_case_insights}
          onChange={(v) => setForm({ ...form, prefer_case_insights: v })}
          disabled={pending}
        />
        <ToggleRow
          label="รวมคำถามลูกค้าในบริบท"
          hint="ดึง studio_customer_questions ที่อนุมัติแล้วเข้า prompt ด้วย"
          checked={form.include_customer_questions}
          onChange={(v) => setForm({ ...form, include_customer_questions: v })}
          disabled={pending}
        />
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0">
            <Label htmlFor="max_context_blocks" className="text-sm">
              จำนวนบล็อกความรู้สูงสุดต่อคำสั่ง
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">4–12 บล็อก ([K1]…[Kn]) — มากขึ้น = แม่นขึ้นแต่ใช้ token มากขึ้น</p>
          </div>
          <Input
            id="max_context_blocks"
            type="number"
            min={4}
            max={12}
            step={1}
            value={form.max_context_blocks}
            onChange={(e) => setForm({ ...form, max_context_blocks: Math.max(4, Math.min(12, Math.round(Number(e.target.value) || 4))) })}
            disabled={pending}
            className="h-8 w-20 text-right tabular-nums"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </div>
  );
}
