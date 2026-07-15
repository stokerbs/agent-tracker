"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Contact,
  Phone,
  Search,
  Link2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ContactResult, ContactInputType, ContactStageName, StageState } from "@/lib/contact/types";
import { attachContactToCase } from "@/app/(dashboard)/osint/contact/actions";

export interface CaseOption {
  id: string;
  label: string;
}

const STAGE_ORDER: ContactStageName[] = ["input", "phone", "breach", "accounts"];

export function ContactAnalyzer({ cases }: { cases: CaseOption[] }) {
  const t = useTranslations("osintContact");
  const [type, setType] = useState<ContactInputType>("phone");
  const [value, setValue] = useState("");
  const [caseId, setCaseId] = useState("none");

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContactResult | null>(null);
  const [attaching, startAttach] = useTransition();

  const canSubmit = useMemo(() => type === "phone" && value.trim().length > 0, [type, value]);

  async function analyze() {
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { type, value: value.trim() };
      if (type === "phone") body.region = "TH";
      if (caseId !== "none") body.case_id = caseId;

      const res = await fetch("/api/osint/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let json: { error?: string; analysis?: ContactResult } | null = null;
      try {
        json = raw ? JSON.parse(raw) : null;
      } catch {
        json = null;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? `${t("errors.generic")} (${res.status})`);
      setResult(json.analysis as ContactResult);
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("error");
    }
  }

  function onAttach() {
    if (!result || caseId === "none") return;
    startAttach(async () => {
      const r = await attachContactToCase({ analysisId: result.id, caseId });
      if (r.ok) toast.success(t("attach.success"));
      else toast.error(r.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* Input */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Contact className="h-4 w-4 text-sky-400" /> {t("input.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="tablist" aria-label={t("input.title")} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs">
              {(["phone", "email", "username"] as ContactInputType[]).map((tt) => (
                <button
                  key={tt}
                  type="button"
                  role="tab"
                  aria-selected={type === tt}
                  disabled={tt !== "phone"}
                  onClick={() => setType(tt)}
                  className={cn(
                    "rounded-md px-2 py-1.5 font-medium transition-colors",
                    type === tt ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                    tt !== "phone" && "cursor-not-allowed opacity-40",
                  )}
                  title={tt !== "phone" ? t("input.phase2") : undefined}
                >
                  {t(`input.types.${tt}`)}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-value">{t("input.phoneLabel")}</Label>
              <Input
                id="contact-value"
                inputMode="tel"
                placeholder="081-234-5678 หรือ +66812345678"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && analyze()}
              />
              <p className="text-xs text-muted-foreground">{t("input.hint")}</p>
            </div>

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
            <p className="text-xs text-muted-foreground">{t("pdpaNote")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Result */}
      <div className="space-y-4">
        {status === "idle" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <Contact className="h-10 w-10 opacity-40" />
              <p className="text-sm">{t("empty")}</p>
            </CardContent>
          </Card>
        )}

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

            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4" /> {t("attach.prompt")}
                </div>
                <Button size="sm" onClick={onAttach} disabled={caseId === "none" || attaching}>
                  {attaching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                  {t("attach.button")}
                </Button>
              </CardContent>
            </Card>

            {result.phone && <PhonePanel t={t} result={result} />}
            <ReversePanel t={t} result={result} />
          </>
        )}
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

const STAGE_ICON: Record<StageState, React.ReactNode> = {
  complete: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  processing: <Loader2 className="h-4 w-4 animate-spin text-sky-400" />,
  failed: <AlertTriangle className="h-4 w-4 text-destructive" />,
  skipped: <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />,
  pending: <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />,
};

function ProgressTimeline({ t, stageStatus, loading }: { t: T; stageStatus: Partial<Record<ContactStageName, StageState>>; loading: boolean }) {
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

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="break-all text-right font-mono text-xs text-foreground">{v}</span>
    </div>
  );
}

function PhonePanel({ t, result }: { t: T; result: ContactResult }) {
  const p = result.phone!;
  return (
    <Section icon={<Phone className="h-4 w-4 text-emerald-400" />} title={t("panels.phone")}>
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant={p.valid ? "secondary" : "destructive"}>{p.valid ? t("phone.valid") : t("phone.invalid")}</Badge>
        {p.lineType && <Badge variant="outline">{p.lineType}</Badge>}
      </div>
      <Row k="E.164" v={p.e164 ?? "—"} />
      <Row k={t("phone.national")} v={p.national ?? "—"} />
      <Row k={t("phone.country")} v={[p.country, p.countryCallingCode].filter(Boolean).join(" ") || "—"} />
    </Section>
  );
}

function ReversePanel({ t, result }: { t: T; result: ContactResult }) {
  if (result.reverseSearch.length === 0) return null;
  return (
    <Section icon={<Search className="h-4 w-4 text-sky-400" />} title={t("panels.reverse")}>
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
