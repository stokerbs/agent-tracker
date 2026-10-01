"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { updatePartner } from "./actions";
import { PARTNER_STAGES, PARTNER_STAGE_LABELS, type PartnerStage } from "@/lib/marketing/zh/partner-pipeline";
import { referralLink } from "@/lib/marketing/zh/partner-schema";

const ERROR_TH: Record<string, string> = { invalid_input: "ข้อมูลไม่ถูกต้อง", not_found: "ไม่พบรายการ" };

/** Stage/notes editor + the partner's referral link (copy to hand out after agreement). */
export function PartnerControls({ id, stage, adminNotes, referralSlug }: { id: string; stage: PartnerStage; adminNotes: string | null; referralSlug: string }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const link = referralLink(referralSlug);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await updatePartner(fd);
        if ("error" in res) toast.error(`บันทึกไม่สำเร็จ: ${ERROR_TH[res.error] ?? res.error}`);
        else toast.success("บันทึกแล้ว");
      } catch {
        toast.error("บันทึกไม่สำเร็จ: เครือข่ายขัดข้อง");
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("คัดลอกไม่ได้ — คัดลอกลิงก์ด้วยตนเอง");
    }
  }

  const input = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs";
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <label className="space-y-1">
          <span className="text-muted-foreground">Stage</span>
          <select name="stage" defaultValue={stage} className={input}>
            {PARTNER_STAGES.map((s) => <option key={s} value={s}>{PARTNER_STAGE_LABELS[s].th} · {PARTNER_STAGE_LABELS[s].zh}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-muted-foreground">โน้ต</span><input name="adminNotes" defaultValue={adminNotes ?? ""} maxLength={2000} className={input} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">ลิงก์ referral:</span>
        <code className="truncate rounded border border-border bg-background px-2 py-1 font-mono text-[11px]">{link}</code>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted">
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />} {copied ? "คัดลอกแล้ว" : "คัดลอก"}
        </button>
      </div>
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-60">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} บันทึก
      </button>
    </form>
  );
}
