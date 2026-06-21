"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Satellite,
  Settings2,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Gps903Credential } from "@/lib/types";
import { CredentialFormDialog } from "@/components/gps903/credential-form-dialog";
import {
  toggleCredentialActive,
  deleteCredential,
  testCredential,
  type TestResult,
} from "./actions";

interface Props {
  credentials: Gps903Credential[];
}

function timeAgo(ts: string | null, never: string, justNow: string): string {
  if (!ts) return never;
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return justNow;
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function maskImei(imei: string): string {
  return imei.slice(0, 6) + "•".repeat(imei.length - 9) + imei.slice(-3);
}

export function CredentialsClient({ credentials }: Props) {
  const t = useTranslations("gps903Credentials");
  const tCommon = useTranslations("common");
  const [addOpen, setAddOpen] = useState(false);

  if (credentials.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Satellite className="h-8 w-8 text-muted-foreground/30" />
            <p className="font-medium">{t("empty")}</p>
            <p className="text-sm text-muted-foreground">
              {t("emptyHint")}
            </p>
            <Button onClick={() => setAddOpen(true)} className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" />
              {t("addFirst")}
            </Button>
          </CardContent>
        </Card>
        <CredentialFormDialog open={addOpen} onOpenChange={setAddOpen} mode="add" />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("addButton")}
        </Button>
      </div>

      <div className="space-y-3">
        {credentials.map((cred) => (
          <CredentialRow key={cred.id} credential={cred} />
        ))}
      </div>

      <CredentialFormDialog open={addOpen} onOpenChange={setAddOpen} mode="add" />
    </>
  );
}

function CredentialRow({ credential: cred }: { credential: Gps903Credential }) {
  const t = useTranslations("gps903Credentials");
  const tCommon = useTranslations("common");
  const [editOpen, setEditOpen]     = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [, startTransition]         = useTransition();
  const [toggling, setToggling]     = useState(false);
  const [testing, setTesting]       = useState(false);
  const [deleting, setDeleting]     = useState(false);

  // Track device ID optimistically after detection so row updates without reload
  const [detectedId, setDetectedId] = useState<number | null>(null);
  const displayId = detectedId ?? cred.gps903_device_id;

  function handleToggle() {
    setToggling(true);
    startTransition(async () => {
      const res = await toggleCredentialActive(cred.id, !cred.is_active);
      setToggling(false);
      if (res.error) toast.error(res.error);
      else toast.success(cred.is_active ? t("row.disabled") : t("row.enabled"));
    });
  }

  function handleTest() {
    setTesting(true);
    setTestResult(null);
    startTransition(async () => {
      const res = await testCredential(cred.id);
      setTesting(false);
      setTestResult(res);

      if (res.ok) {
        if (res.device_id && !cred.gps903_device_id) {
          setDetectedId(res.device_id);
        }
        toast.success(
          res.device_id && !cred.gps903_device_id
            ? t("row.testOk", { id: res.device_id })
            : t("row.test"),
        );
      } else if (res.loginOk) {
        toast.warning(t("row.testLoginOnly"));
      } else if (res.error) {
        toast.error(res.error);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(t("row.deleteConfirm", { name: cred.device_name }))) return;
    setDeleting(true);
    startTransition(async () => {
      const res = await deleteCredential(cred.id);
      setDeleting(false);
      if (res.error) toast.error(res.error);
      else toast.success(t("row.deletedToast"));
    });
  }

  const hasDeviceId = displayId != null;

  return (
    <>
      <div
        className={cn(
          "rounded-lg border bg-card p-4 transition-opacity",
          !cred.is_active && "opacity-60",
        )}
      >
        <div className="flex flex-wrap items-start gap-3">
          {/* Icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <Satellite className="h-4 w-4 text-emerald-500" />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{cred.device_name}</span>

              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  cred.is_active
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {cred.is_active ? t("row.active") : t("row.inactive")}
              </Badge>

              {!hasDeviceId && (
                <Badge
                  variant="secondary"
                  className="gap-0.5 border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                >
                  <AlertCircle className="h-2.5 w-2.5" />
                  {t("row.noDeviceId")}
                </Badge>
              )}

              {cred.last_sync_ok === true  && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {cred.last_sync_ok === false && <XCircle      className="h-3.5 w-3.5 text-red-500" />}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-mono">IMEI {maskImei(cred.imei)}</span>
              {hasDeviceId ? (
                <span className="font-mono">
                  ID #{displayId}
                  {detectedId && !cred.gps903_device_id && (
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400">({t("row.justDetected")})</span>
                  )}
                </span>
              ) : (
                <span className="font-mono text-muted-foreground/50">{t("row.idUnknown")}</span>
              )}
              <span>{t("row.lastSync", { timeAgo: timeAgo(cred.last_synced_at, tCommon("never"), tCommon("justNow")) })}</span>
            </div>
            {(cred.phone_number || cred.provider) && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground/70">
                {cred.phone_number && (
                  <span className="font-mono">{t("row.sim", { phone: cred.phone_number })}</span>
                )}
                {cred.provider && (
                  <span className="font-mono">{cred.provider}</span>
                )}
              </div>
            )}

            {/* Test result banner */}
            {testResult && (
              <div
                className={cn(
                  "mt-1 flex items-start gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs",
                  testResult.ok
                    ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : testResult.loginOk
                    ? "bg-amber-500/5 text-amber-700 dark:text-amber-400"
                    : "bg-red-500/5 text-red-600",
                )}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                )}
                <span>
                  {testResult.ok ? (
                    <>
                      {testResult.device_id && `#${testResult.device_id} · `}
                      {testResult.lat != null && (
                        <>
                          {testResult.lat.toFixed(5)}, {testResult.lng!.toFixed(5)}
                          {testResult.speed != null && <> · {Math.round(testResult.speed)} km/h</>}
                          {testResult.battery != null && <> · {testResult.battery}%</>}
                        </>
                      )}
                    </>
                  ) : (
                    testResult.error
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Button
              variant={!hasDeviceId ? "default" : "ghost"}
              size="sm"
              className={cn("h-8 gap-1 text-xs", !hasDeviceId && "bg-amber-500 hover:bg-amber-600 text-white")}
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {testing ? t("row.testing") : t("row.test")}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setEditOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {tCommon("edit")}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn("h-8 text-xs", cred.is_active ? "text-muted-foreground" : "text-emerald-600")}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : (cred.is_active ? t("row.disable") : t("row.enable"))}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-red-500 hover:bg-red-500/10 hover:text-red-500"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      <CredentialFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        credential={cred}
      />
    </>
  );
}
