"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  SendHorizonal,
  Shield,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  caseInfo?: {
    case_number: string;
    case_type: string | null;
    displayClientName: string | null | undefined;
  } | null;
}

export function ReportEditor({ report, versions, canApprove, language = "th", caseInfo }: ReportEditorProps) {
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

  // Dirty-state tracking — snapshot is updated after every successful save.
  const savedSnapshot = useRef({
    execSummary: plainTextToHtml(report.executive_summary ?? ""),
    chronoBody: plainTextToHtml(_extractChrono(report.body ?? "")),
    observations: plainTextToHtml(report.observations ?? ""),
    conclusion: plainTextToHtml(report.conclusion ?? ""),
  });

  const isDirty =
    execSummary !== savedSnapshot.current.execSummary ||
    chronoBody !== savedSnapshot.current.chronoBody ||
    observations !== savedSnapshot.current.observations ||
    conclusion !== savedSnapshot.current.conclusion;

  function syncSnapshot() {
    savedSnapshot.current = { execSummary, chronoBody, observations, conclusion };
  }

  // Warn before browser-level navigation (close tab, browser back, refresh).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleBack() {
    if (isDirty && !window.confirm("มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก\nต้องการออกจากหน้านี้หรือไม่?")) return;
    router.push("/reports");
  }

  const isDraft = report.status === "draft";
  const isReview = report.status === "review";
  const isApproved = report.status === "approved";
  const isRejected = report.status === "rejected";

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
      syncSnapshot();
      toast.success("บันทึกร่างเรียบร้อยแล้ว");
      router.refresh();
    });
  }

  function handleSubmitForReview() {
    start(async () => {
      const content = {
        executive_summary: execSummary,
        body: buildBody(execSummary, chronoBody, observations, conclusion),
        observations,
        conclusion,
      };
      const saveRes = await saveReportDraft(report.id, content);
      if (saveRes?.error) { toast.error(saveRes.error); return; }
      syncSnapshot();

      const res = await submitReportForReview(report.id);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("ส่งรายงานเพื่อรีวิวเรียบร้อยแล้ว");
      router.refresh();
    });
  }

  function handleApprove(clientVisible: boolean) {
    start(async () => {
      const res = await approveReport(report.id, clientVisible);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(clientVisible ? "อนุมัติและเผยแพร่รายงานแล้ว" : "อนุมัติรายงาน (ภายใน) แล้ว");
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
    // Restored content differs from snapshot — mark dirty so the user saves explicitly.
    toast.info("โหลดเวอร์ชันนี้แล้ว — กด \"บันทึกร่าง\" เพื่อบันทึก");
  }

  const editable = !isApproved;

  return (
    <div className="space-y-6">
      {/* Breadcrumb with dirty-aware back button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          รายงานทั้งหมด
        </button>
        <span className="text-muted-foreground/40">/</span>
        <div className="flex items-center gap-1.5 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{report.title}</span>
        </div>
        {isDirty && (
          <span className="ml-1 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            ยังไม่ได้บันทึก
          </span>
        )}
      </div>

      {/* Rejection feedback */}
      {report.status === "rejected" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">รายงานถูกปฏิเสธ</p>
            {report.rejection_notes && (
              <p className="mt-0.5 text-sm text-destructive/80">{report.rejection_notes}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">แก้ไขรายงานแล้วส่งเพื่อรีวิวอีกครั้ง</p>
          </div>
        </div>
      )}

      {/* Case context */}
      {caseInfo && (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            คดี{" "}
            <span className="font-mono font-semibold text-primary">{caseInfo.case_number}</span>
            {caseInfo.case_type && <span> · {caseInfo.case_type}</span>}
            {caseInfo.displayClientName && <span> · ลูกค้า: {caseInfo.displayClientName}</span>}
          </p>
        </div>
      )}

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
            {/* Approve — split button. is_client_visible only set to true via
                "Approve + Publish". Plain approval keeps it false (internal). */}
            {canApprove && (isDraft || isReview) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="success"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={pending}
                  >
                    {pending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    อนุมัติรายงาน
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleApprove(false)}>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    อนุมัติ (ภายใน)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleApprove(true)}>
                    <Shield className="mr-2 h-3.5 w-3.5" />
                    อนุมัติ + เผยแพร่ให้ลูกค้า
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
