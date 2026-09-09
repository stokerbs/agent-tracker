"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ApprovalRules } from "@/lib/studio/types";
import { ToggleRow } from "./knowledge-prefs-form";
import { updateApprovalRules } from "./actions";

export function ApprovalForm({ initial }: { initial: ApprovalRules }) {
  const [form, setForm] = useState<ApprovalRules>(initial);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        const res = await updateApprovalRules(form);
        if (res.ok) toast.success("บันทึกกฎการอนุมัติแล้ว");
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
          label="ต้องผ่านตรวจความเป็นส่วนตัวก่อนอนุมัติ"
          hint="ถ้าเปิด: อนุมัติได้เฉพาะเมื่อผลตรวจล่าสุดเป็น safe (หรือมี override) — ผลตรวจ blocked ไม่สามารถอนุมัติได้ในทุกกรณี"
          checked={form.require_privacy_safe}
          onChange={(v) => setForm({ ...form, require_privacy_safe: v })}
          disabled={pending}
        />
        <ToggleRow
          label="อนุญาตให้ override ผล review_required"
          hint="ผู้อนุมัติต้องบันทึกเหตุผล และระบบเก็บเป็น studio_content_reviews (decision = override_privacy)"
          checked={form.allow_override}
          onChange={(v) => setForm({ ...form, allow_override: v })}
          disabled={pending}
        />
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
