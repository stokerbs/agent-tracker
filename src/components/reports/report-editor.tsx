"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Save,
  SendHorizonal,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RichTextEditor, isHtmlContent, plainTextToHtml } from "@/components/shared/rich-text-editor";
import { VersionHistoryPanel } from "@/components/reports/version-history-panel";
import {
  saveReportDraft,
  submitReportForReview,
  approveReport,
  regenerateReport,
} from "@/app/(dashboard)/reports/actions";
import type { Report, ReportVersion } from "@/lib/types";

interface ReportEditorProps {
  report: Report;
  versions: ReportVersion[];
  canApprove: boolean;
  language?: "th" | "en";
}

export function ReportEditor({ report, versions, canApprove, language = "th" }: ReportEditorProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [regenLang, setRegenLang] = useState<"th" | "en">(language);
  const [versionList, setVersionList] = useState<ReportVersion[]>(versions);

  // Editable content state — convert legacy plain-text to HTML for Tiptap.
  const [execSummary, setExecSummary] = useState(() =>
    plainTextToHtml(report.executive_summary ?? ""),
  );
  const [chronoBody, setChronoBody] = useState(() =>
    plainTextToHtml(_extractChrono(report.body ?? "")),
  );
  const [observations, setObservations] = useState(() =>
    plainTextToHtml(report.observations ?? ""),
  );
  const [conclusion, setConclusion] = useState(() =>
    plainTextToHtml(report.conclusion ?? ""),
  );

  const isDraft = report.status === "draft";
  const isReview = report.status === "review";
  const isApproved = report.status === "approved";

  function buildBody(es: string, body: string, obs: string, conc: string): string {
    const isThai = language === "th";
    return isThai
      ? [
          "1. สรุปผลการปฏิบัติงาน",
          es,
          "",
          "2. ลำดับเหตุการณ์",
          body,
          "",
          "3. ข้อสังเกต",
          obs,
          "",
          "4. สรุป",
          conc,
        ].join("\n")
      : [
          "1. EXECUTIVE SUMMARY",
          es,
          "",
          "2. CHRONOLOGICAL SURVEILLANCE REPORT",
          body,
          "",
          "3. OBSERVATIONS",
          obs,
          "",
          "4. CONCLUSION",
          conc,
        ].join("\n");
  }

  function handleSaveDraft() {
    start(async () => {
      const content = {
        executive_summary: execSummary,
        body: buildBody(execSummary, chronoBody, observations, conclusion),
        observations,
        conclusion,
      };
      const res = await saveReportDraft(report.id, content);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("บันทึกร่างเรียบร้อยแล้ว");
      router.refresh();
    });
  }

  function handleSubmitForReview() {
    start(async () => {
      // Save content first.
      const content = {
        executive_summary: execSummary,
        body: buildBody(execSummary, chronoBody, observations, conclusion),
        observations,
        conclusion,
      };
      const saveRes = await saveReportDraft(report.id, content);
      if (saveRes?.error) { toast.error(saveRes.error); return; }

      const res = await submitReportForReview(report.id);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("ส่งรายงานเพื่อรีวิวเรียบร้อยแล้ว");
      router.refresh();
    });
  }

  function handleApprove() {
    start(async () => {
      const res = await approveReport(report.id, true);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("อนุมัติรายงานเรียบร้อยแล้ว");
      router.refresh();
    });
  }

  function handleRegenerate() {
    start(async () => {
      const res = await regenerateReport(report.id, regenLang);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("สร้างรายงานใหม่ด้วย AI เรียบร้อยแล้ว");
      router.refresh();
    });
  }

  function handleRestoreVersion(content: ReportVersion["content"]) {
    if (content.executive_summary !== undefined)
      setExecSummary(plainTextToHtml(content.executive_summary ?? ""));
    if (content.body !== undefined)
      setChronoBody(plainTextToHtml(_extractChrono(content.body ?? "")));
    if (content.observations !== undefined)
      setObservations(plainTextToHtml(content.observations ?? ""));
    if (content.conclusion !== undefined)
      setConclusion(plainTextToHtml(content.conclusion ?? ""));
    toast.info("โหลดเวอร์ชันนี้แล้ว — กด \"บันทึกร่าง\" เพื่อบันทึก");
  }

  const editable = !isApproved;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      {/* Main editor */}
      <div className="space-y-5">
        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusDot status={report.status} />
            <span className="text-sm font-medium capitalize">
              {STATUS_LABELS[report.status] ?? report.status}
            </span>
            {report.edited_at && (
              <span className="text-xs text-muted-foreground">
                · แก้ไขล่าสุด {new Date(report.edited_at).toLocaleDateString("th-TH")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Regenerate with AI */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRegenLang("th")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${regenLang === "th" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                ไทย
              </button>
              <button
                type="button"
                onClick={() => setRegenLang("en")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${regenLang === "en" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                EN
              </button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleRegenerate}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                สร้างใหม่ด้วย AI
              </Button>
            </div>

            {/* Save / Submit / Approve */}
            {editable && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleSaveDraft}
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  บันทึกร่าง
                </Button>
                {isDraft && (
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleSubmitForReview}
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-3.5 w-3.5" />
                    )}
                    ส่งรีวิว
                  </Button>
                )}
              </>
            )}
            {canApprove && (isDraft || isReview) && (
              <Button
                variant="success"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handleApprove}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                อนุมัติรายงาน
              </Button>
            )}
            {isApproved && (
              <span className="flex items-center gap-1 text-xs text-success">
                <Shield className="h-3.5 w-3.5" />
                อนุมัติแล้ว
              </span>
            )}
          </div>
        </div>

        {/* Section editors */}
        <Section
          label="1. สรุปผลการปฏิบัติงาน"
          placeholder="บรรยายสรุปผลการสอดแนม…"
          value={execSummary}
          onChange={setExecSummary}
          disabled={!editable}
        />
        <Section
          label="2. ลำดับเหตุการณ์"
          placeholder="บรรยายเหตุการณ์ตามลำดับเวลา…"
          value={chronoBody}
          onChange={setChronoBody}
          disabled={!editable}
          minHeight="200px"
        />
        <Section
          label="3. ข้อสังเกต"
          placeholder="ข้อสังเกตจากปฏิบัติการ…"
          value={observations}
          onChange={setObservations}
          disabled={!editable}
        />
        <Section
          label="4. สรุป"
          placeholder="บทสรุปและคำแนะนำ…"
          value={conclusion}
          onChange={setConclusion}
          disabled={!editable}
        />
      </div>

      {/* Sidebar: version history */}
      <aside className="space-y-3">
        <div className="sticky top-4 rounded-lg border border-border/60 bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            ประวัติการแก้ไข
          </h3>
          <VersionHistoryPanel
            versions={versionList}
            onRestoreVersion={editable ? handleRestoreVersion : undefined}
          />
        </div>
      </aside>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  minHeight,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  minHeight?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <RichTextEditor
        content={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        minHeight={minHeight ?? "140px"}
      />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color: Record<string, string> = {
    draft: "bg-slate-400",
    review: "bg-amber-400",
    approved: "bg-emerald-400",
    rejected: "bg-rose-500",
  };
  return (
    <span className={`h-2 w-2 rounded-full ${color[status] ?? "bg-slate-400"}`} />
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "ร่าง",
  review: "รอรีวิว",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _extractChrono(body: string): string {
  // Strip provider tag first.
  const clean = body.replace(/\n__PROVIDER:(claude|template)__$/, "");
  // Thai: between "2. ลำดับเหตุการณ์" and "3. ข้อสังเกต"
  if (clean.includes("ลำดับเหตุการณ์")) {
    return (
      clean.split("2. ลำดับเหตุการณ์")[1]?.split("\n3. ข้อสังเกต")[0]?.trim() ?? clean
    );
  }
  // English fallback.
  return (
    clean
      .split("2. CHRONOLOGICAL SURVEILLANCE REPORT")[1]
      ?.split("3. OBSERVATIONS")[0]
      ?.trim() ?? clean
  );
}
