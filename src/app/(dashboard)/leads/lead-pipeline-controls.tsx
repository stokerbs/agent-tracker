"use client";

import { useState, useTransition } from "react";
import { Loader2, Paperclip, Save } from "lucide-react";
import { toast } from "sonner";
import { updateLeadPipeline, getLeadFileUrl } from "./actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS, type LeadStage } from "@/lib/marketing/zh/pipeline";

export interface LeadFileSummary { id: string; file_name: string; size_bytes: number }

/** Inline pipeline editor for one lead row (stage, values, notes, files). */
export function LeadPipelineControls({
  id, stage, estimatedValue, quotedValue, finalRevenue, adminNotes, files,
}: {
  id: string;
  stage: LeadStage;
  estimatedValue: number | null;
  quotedValue: number | null;
  finalRevenue: number | null;
  adminNotes: string | null;
  files: LeadFileSummary[];
}) {
  const [pending, start] = useTransition();
  const [opening, setOpening] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateLeadPipeline(fd);
      if ("error" in res) toast.error(`บันทึกไม่สำเร็จ: ${res.error}`);
      else toast.success("บันทึก pipeline แล้ว");
    });
  }

  async function openFile(fileId: string) {
    setOpening(fileId);
    try {
      const res = await getLeadFileUrl(fileId);
      if ("url" in res) window.open(res.url, "_blank", "noopener");
      else toast.error("เปิดไฟล์ไม่ได้");
    } finally {
      setOpening(null);
    }
  }

  const input = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs";
  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
      <input type="hidden" name="id" value={id} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="text-muted-foreground">Stage</span>
          <select name="stage" defaultValue={stage} className={input}>
            {LEAD_STAGES.map((s) => <option key={s} value={s}>{LEAD_STAGE_LABELS[s].th} · {LEAD_STAGE_LABELS[s].zh}</option>)}
          </select>
        </label>
        <label className="space-y-1"><span className="text-muted-foreground">ประเมิน (฿)</span><input name="estimatedValue" type="number" min={0} step="1" defaultValue={estimatedValue ?? ""} className={input} /></label>
        <label className="space-y-1"><span className="text-muted-foreground">เสนอราคา (฿)</span><input name="quotedValue" type="number" min={0} step="1" defaultValue={quotedValue ?? ""} className={input} /></label>
        <label className="space-y-1"><span className="text-muted-foreground">รายได้จริง (฿)</span><input name="finalRevenue" type="number" min={0} step="1" defaultValue={finalRevenue ?? ""} className={input} /></label>
      </div>
      <label className="block space-y-1"><span className="text-muted-foreground">โน้ต</span><textarea name="adminNotes" defaultValue={adminNotes ?? ""} rows={2} maxLength={2000} className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" /></label>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => openFile(f.id)} disabled={opening === f.id} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-60">
                {opening === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                {f.file_name} ({Math.ceil(f.size_bytes / 1024)} KB)
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-60">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} บันทึก
      </button>
    </form>
  );
}
