"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ScanSearch,
  Upload,
  Link2,
  Fingerprint,
  MapPin,
  GitBranch,
  Cloud,
  ShieldAlert,
  Sparkles,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  ScanFace,
  Boxes,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AnalysisResult, StageName, StageState } from "@/lib/osint/types";
import { buildGraph } from "@/lib/osint/graph";
import { OsintGraph } from "./osint-graph";
import { OsintGpsMap } from "./osint-gps-map";
import { attachToCase } from "@/app/(dashboard)/osint/image/actions";

export interface CaseOption {
  id: string;
  label: string;
}

type Mode = "upload" | "url" | "redirect" | "base64";

const STAGE_ORDER: StageName[] = [
  "ingest",
  "hashes",
  "metadata",
  "redirect",
  "attribution",
  "integrity",
  "ocr",
  "faces",
  "objects",
  "report",
];

// Uploads/base64 travel in the JSON request body. Serverless functions cap the
// request body at ~4.5 MB, so the inline path must stay well under that (base64
// inflates by ~33%). Larger images should use the URL path, which downloads
// server-side and supports the full 25 MB limit.
const MAX_INLINE_BYTES = 3 * 1024 * 1024;

export function OsintAnalyzer({ cases }: { cases: CaseOption[] }) {
  const t = useTranslations("osint");
  const [mode, setMode] = useState<Mode>("upload");

  // Inputs
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [base64, setBase64] = useState("");
  const [caseId, setCaseId] = useState<string>("none");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Async state
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [attaching, startAttach] = useTransition();

  const acceptFile = useCallback((f: File) => {
    if (f.size > MAX_INLINE_BYTES) {
      toast.error(t("errors.tooLargeInline"));
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }, [t]);

  // Drag/drop + paste handlers.
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) acceptFile(f);
    },
    [acceptFile],
  );
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) acceptFile(f);
    },
    [acceptFile],
  );

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });

  const canSubmit = useMemo(() => {
    if (mode === "upload") return Boolean(file);
    if (mode === "url") return imageUrl.trim().length > 0;
    if (mode === "redirect") return redirectUrl.trim().length > 0;
    return base64.trim().length > 0;
  }, [mode, file, imageUrl, redirectUrl, base64]);

  async function analyze() {
    // Guard the inline (base64 paste) path against the serverless body-size cap.
    if (mode === "base64" && base64.trim().length > MAX_INLINE_BYTES * 1.37) {
      toast.error(t("errors.tooLargeInline"));
      return;
    }
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {};
      if (caseId !== "none") body.case_id = caseId;

      if (mode === "upload" && file) {
        body.image_base64 = await fileToBase64(file);
        body.file_name = file.name;
      } else if (mode === "url") {
        body.image_url = imageUrl.trim();
      } else if (mode === "redirect") {
        body.redirect_url = redirectUrl.trim();
      } else {
        body.image_base64 = base64.trim();
      }

      const res = await fetch("/api/osint/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      // Platform errors (413 too-large, 504 timeout, 500 crash) return non-JSON
      // bodies. Parse defensively so we surface a clear status instead of a raw
      // DOMException from res.json() ("string did not match the expected pattern").
      const rawText = await res.text();
      let json: { error?: string; analysis?: AnalysisResult } | null = null;
      try {
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        json = null;
      }
      if (!res.ok || !json) {
        const msg =
          json?.error ??
          (res.status === 413
            ? t("errors.tooLarge")
            : res.status === 504
              ? t("errors.timeout")
              : `${t("errors.generic")} (${res.status})`);
        throw new Error(msg);
      }
      setResult(json.analysis as AnalysisResult);
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  function onAttach() {
    if (!result || caseId === "none") return;
    startAttach(async () => {
      const r = await attachToCase({ analysisId: result.id, caseId });
      if (r.ok) toast.success(t("attach.success"));
      else toast.error(r.error);
    });
  }

  const graph = useMemo(() => (result ? buildGraph(result) : null), [result]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* ── Input column ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanSearch className="h-4 w-4 text-sky-400" /> {t("input.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="tablist" aria-label={t("input.title")} className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 text-xs">
              {(["upload", "url", "redirect", "base64"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md px-2 py-1.5 font-medium transition-colors",
                    mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {t(`input.modes.${m}`)}
                </button>
              ))}
            </div>

            {mode === "upload" && (
              <div
                onDrop={onDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onPaste={onPaste}
                tabIndex={0}
                role="button"
                aria-label={t("input.dropzone")}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm outline-none transition-colors",
                  dragging ? "border-sky-400 bg-sky-400/5" : "border-border hover:border-sky-400/50",
                )}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-muted-foreground">{t("input.dropzone")}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && acceptFile(e.target.files[0])}
                />
                {file && <span className="mt-1 font-medium text-foreground">{file.name}</span>}
              </div>
            )}

            {mode === "url" && (
              <div className="space-y-1.5">
                <Label htmlFor="osint-url">{t("input.urlLabel")}</Label>
                <Input
                  id="osint-url"
                  placeholder="https://example.com/photo.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
            )}

            {mode === "redirect" && (
              <div className="space-y-1.5">
                <Label htmlFor="osint-redirect">{t("input.redirectLabel")}</Label>
                <Input
                  id="osint-redirect"
                  placeholder="https://jsc12.pimeyes.com/redirect/…"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("input.redirectHint")}</p>
              </div>
            )}

            {mode === "base64" && (
              <div className="space-y-1.5">
                <Label htmlFor="osint-b64">{t("input.base64Label")}</Label>
                <Textarea
                  id="osint-b64"
                  rows={4}
                  placeholder="data:image/jpeg;base64,/9j/4AAQ…"
                  value={base64}
                  onChange={(e) => setBase64(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t("input.caseLabel")}</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("input.noCase")}</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={analyze} disabled={!canSubmit || status === "loading"} className="w-full">
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("actions.analyzing")}
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" /> {t("actions.analyze")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {previewUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("panels.preview")}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={t("panels.preview")} className="max-h-72 w-full rounded-lg object-contain" />
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Result column ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {status === "idle" && <EmptyState label={t("empty")} />}

        {status === "loading" && <ProgressTimeline t={t} stageStatus={{}} loading />}

        {status === "error" && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={analyze}>
                {t("actions.retry")}
              </Button>
            </CardContent>
          </Card>
        )}

        {status === "done" && result && (
          <>
            <ProgressTimeline t={t} stageStatus={result.stageStatus} loading={false} />

            {/* Attach to case */}
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4" /> {t("attach.prompt")}
                </div>
                <Button
                  size="sm"
                  onClick={onAttach}
                  disabled={caseId === "none" || attaching}
                  title={caseId === "none" ? t("attach.needCase") : undefined}
                >
                  {attaching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                  {t("attach.button")}
                </Button>
              </CardContent>
            </Card>

            {result.report && <ReportPanel t={t} report={result.report} />}
            <HashPanel t={t} result={result} />
            <MetadataPanel t={t} result={result} />
            <IntegrityPanel t={t} result={result} />
            <AttributionPanel t={t} result={result} />
            <FacesPanel t={t} result={result} />
            <ObjectsPanel t={t} result={result} />
            <OcrPanel t={t} result={result} />
            <RedirectPanel t={t} result={result} />
            <ReverseSearchPanel t={t} result={result} />
            {graph && (
              <Section icon={<GitBranch className="h-4 w-4 text-violet-400" />} title={t("panels.graph")}>
                <OsintGraph graph={graph} />
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

type T = ReturnType<typeof useTranslations>;

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <ScanSearch className="h-10 w-10 opacity-40" />
        <p className="text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const STAGE_ICON: Record<StageState, React.ReactNode> = {
  complete: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  processing: <Loader2 className="h-4 w-4 animate-spin text-sky-400" />,
  failed: <AlertTriangle className="h-4 w-4 text-destructive" />,
  skipped: <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />,
  pending: <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />,
};

function ProgressTimeline({
  t,
  stageStatus,
  loading,
}: {
  t: T;
  stageStatus: Partial<Record<StageName, StageState>>;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("progress.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-2">
          {STAGE_ORDER.map((s) => {
            const state: StageState = loading ? "processing" : stageStatus[s] ?? "pending";
            return (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center">{STAGE_ICON[state]}</span>
                <span className={cn(state === "skipped" && "text-muted-foreground")}>{t(`stages.${s}`)}</span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function ReportPanel({ t, report }: { t: T; report: NonNullable<AnalysisResult["report"]> }) {
  return (
    <Section icon={<Sparkles className="h-4 w-4 text-amber-400" />} title={t("panels.report")}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {t("report.risk")}: {report.riskScore}/100
          </Badge>
          <Badge variant="outline">
            {t("report.confidence")}: {report.confidence}/100
          </Badge>
          <Badge variant="secondary">{report.model}</Badge>
        </div>
        <p className="whitespace-pre-wrap text-foreground">{report.summary}</p>
        <div>
          <p className="font-medium">{t("report.origin")}</p>
          <p className="text-muted-foreground">{report.likelyOrigin}</p>
        </div>
        {report.leads.length > 0 && (
          <div>
            <p className="font-medium">{t("report.leads")}</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {report.leads.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}
        {report.recommendations.length > 0 && (
          <div>
            <p className="font-medium">{t("report.recommendations")}</p>
            <ul className="list-inside list-disc text-muted-foreground">
              {report.recommendations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="break-all text-right font-mono text-xs text-foreground">{v}</span>
    </div>
  );
}

function HashPanel({ t, result }: { t: T; result: AnalysisResult }) {
  const h = result.hashes;
  return (
    <Section icon={<Fingerprint className="h-4 w-4 text-sky-400" />} title={t("panels.hashes")}>
      {h ? (
        <div>
          <Row k="MD5" v={h.md5} />
          <Row k="SHA-1" v={h.sha1} />
          <Row k="SHA-256" v={h.sha256} />
          <Row k="pHash" v={h.phash} />
          <Row k="dHash" v={h.dhash} />
          <Row k="aHash" v={h.ahash} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("panels.stageFailed")}</p>
      )}
    </Section>
  );
}

function MetadataPanel({ t, result }: { t: T; result: AnalysisResult }) {
  const m = result.metadata;
  return (
    <Section icon={<MapPin className="h-4 w-4 text-emerald-400" />} title={t("panels.metadata")}>
      {m ? (
        <div className="space-y-3">
          <div>
            <Row k={t("meta.dimensions")} v={`${m.width ?? "?"} × ${m.height ?? "?"}`} />
            <Row k={t("meta.format")} v={m.format ?? "—"} />
            <Row k={t("meta.filesize")} v={`${m.filesize ?? "?"} bytes`} />
            <Row k={t("meta.dpi")} v={m.dpi ?? "—"} />
            <Row k={t("meta.camera")} v={[m.cameraMake, m.cameraModel].filter(Boolean).join(" ") || "—"} />
            <Row k={t("meta.software")} v={m.software ?? "—"} />
            <Row k={t("meta.takenAt")} v={m.takenAt ?? "—"} />
          </div>
          {m.gpsLat != null && m.gpsLng != null ? (
            <OsintGpsMap lat={m.gpsLat} lng={m.gpsLng} />
          ) : (
            <p className="text-xs text-muted-foreground">{t("meta.noGps")}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("panels.stageFailed")}</p>
      )}
    </Section>
  );
}

function IntegrityPanel({ t, result }: { t: T; result: AnalysisResult }) {
  const g = result.integrity;
  if (!g) return null;
  const flags: [string, boolean][] = [
    [t("integrity.stripped"), g.metadataStripped],
    [t("integrity.resized"), g.likelyResized],
    [t("integrity.screenshot"), g.likelyScreenshot],
    [t("integrity.edited"), Boolean(g.likelyEditedSoftware)],
  ];
  return (
    <Section icon={<ShieldAlert className="h-4 w-4 text-orange-400" />} title={t("panels.integrity")}>
      <div className="flex flex-wrap gap-2">
        {flags.map(([label, on]) => (
          <Badge key={label} variant={on ? "destructive" : "outline"}>
            {label}: {on ? t("integrity.yes") : t("integrity.no")}
          </Badge>
        ))}
        <Badge variant="secondary">
          {t("integrity.confidence")}: {Math.round(g.confidence * 100)}%
        </Badge>
      </div>
      {g.likelyEditedSoftware && (
        <p className="mt-2 text-xs text-muted-foreground">{t("integrity.software")}: {g.likelyEditedSoftware}</p>
      )}
    </Section>
  );
}

function AttributionPanel({ t, result }: { t: T; result: AnalysisResult }) {
  const a = result.attribution;
  if (!a) return null;
  return (
    <Section icon={<Cloud className="h-4 w-4 text-emerald-400" />} title={t("panels.attribution")}>
      <div className="space-y-2 text-sm">
        <Row k={t("attribution.host")} v={a.host ?? "—"} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t("attribution.cloud")}:</span>
          {a.cloud.length ? (
            a.cloud.map((c) => (
              <Badge key={c.provider} variant="secondary" title={c.evidence}>
                {c.provider}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t("attribution.cdn")}:</span>
          {a.cdn.length ? (
            a.cdn.map((c) => (
              <Badge key={c.provider} variant="secondary" title={c.evidence}>
                {c.provider}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </div>
    </Section>
  );
}

function RedirectPanel({ t, result }: { t: T; result: AnalysisResult }) {
  if (result.redirects.length === 0) return null;
  return (
    <Section icon={<GitBranch className="h-4 w-4 text-violet-400" />} title={t("panels.redirects")}>
      <ol className="space-y-1">
        {result.redirects.map((hop) => (
          <li key={hop.hopIndex} className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="shrink-0 uppercase">
              {hop.kind}
            </Badge>
            {hop.statusCode != null && <span className="text-muted-foreground">{hop.statusCode}</span>}
            <span className="break-all font-mono text-foreground">{hop.url}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function FacesPanel({ t, result }: { t: T; result: AnalysisResult }) {
  const state = result.stageStatus.faces;
  // Hide entirely when face detection wasn't run (no ML provider configured).
  if (state === "skipped" || state === undefined) return null;
  return (
    <Section icon={<ScanFace className="h-4 w-4 text-amber-400" />} title={`${t("panels.faces")} (${result.faces.length})`}>
      {result.faces.length === 0 ? (
        <p className="text-sm text-muted-foreground">{state === "failed" ? t("panels.stageFailed") : t("faces.none")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {result.faces.map((f) => (
            <div key={f.faceIndex} className="rounded-lg border border-border p-2 text-xs">
              <div className="mb-1 font-medium">
                {t("faces.face")} {f.faceIndex + 1}
                {f.confidence != null && <span className="text-muted-foreground"> · {Math.round(f.confidence * 100)}%</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {f.hasGlasses && <Badge variant="secondary">{t("faces.glasses")}</Badge>}
                {f.hasMask && <Badge variant="secondary">{t("faces.mask")}</Badge>}
                {(f.yaw != null || f.pitch != null || f.roll != null) && (
                  <Badge variant="outline">
                    Y{fmt(f.yaw)} P{fmt(f.pitch)} R{fmt(f.roll)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function fmt(v: number | null): string {
  return v == null ? "–" : String(Math.round(v));
}

function ObjectsPanel({ t, result }: { t: T; result: AnalysisResult }) {
  const state = result.stageStatus.objects;
  if (state === "skipped" || state === undefined) return null;
  return (
    <Section icon={<Boxes className="h-4 w-4 text-emerald-400" />} title={`${t("panels.objects")} (${result.objects.length})`}>
      {result.objects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{state === "failed" ? t("panels.stageFailed") : t("objects.none")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {result.objects.map((o, i) => (
            <Badge key={`${o.label}-${i}`} variant="outline" title={o.category ?? undefined}>
              {o.label}
              {o.confidence != null && <span className="ml-1 text-muted-foreground">{Math.round(o.confidence * 100)}%</span>}
            </Badge>
          ))}
        </div>
      )}
    </Section>
  );
}

function OcrPanel({ t, result }: { t: T; result: AnalysisResult }) {
  const state = result.stageStatus.ocr;
  if (state === "skipped" || state === undefined) return null;
  return (
    <Section icon={<Type className="h-4 w-4 text-sky-400" />} title={`${t("panels.ocr")} (${result.ocr.length})`}>
      {result.ocr.length === 0 ? (
        <p className="text-sm text-muted-foreground">{state === "failed" ? t("panels.stageFailed") : t("ocr.none")}</p>
      ) : (
        <ul className="space-y-1">
          {result.ocr.map((o, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="shrink-0 uppercase">
                {o.category ?? "raw"}
              </Badge>
              <span className="break-all font-mono text-xs text-foreground">{o.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function ReverseSearchPanel({ t, result }: { t: T; result: AnalysisResult }) {
  if (result.reverseSearch.length === 0) return null;
  return (
    <Section icon={<Search className="h-4 w-4 text-sky-400" />} title={t("panels.reverseSearch")}>
      <div className="flex flex-wrap gap-2">
        {result.reverseSearch.map((l) => (
          <a key={l.engine} href={l.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Link2 className="mr-2 h-3.5 w-3.5" /> {l.label}
            </Button>
          </a>
        ))}
      </div>
    </Section>
  );
}
