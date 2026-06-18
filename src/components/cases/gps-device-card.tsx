"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, Loader2, Radio, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { softDeleteGpsDevice } from "@/app/(dashboard)/cases/gps-actions";
import { GpsDeviceFormDialog } from "./gps-device-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Agent, GpsDevice } from "@/lib/types";

const PROVIDER_COLORS: Record<string, string> = {
  AIS:    "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  TRUE:   "bg-red-500/10  text-red-600  dark:text-red-400  border-red-500/20",
  DTAC:   "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  GPS903: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

interface Props {
  device: GpsDevice;
  index: number;
  caseId: string;
  canEdit: boolean;
  canDelete: boolean;
  agents?: Pick<Agent, "id" | "full_name" | "agent_code">[];
}

export function GpsDeviceCard({ device, index, caseId, canEdit, canDelete, agents = [] }: Props) {
  const linkedAgent = agents.find((a) => a.id === device.agent_id) ?? null;
  const t = useTranslations("cases.gps");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delPending, startDel] = useTransition();

  function copyToClipboard(text: string, successKey: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t(successKey as Parameters<typeof t>[0]));
    });
  }

  function handleDelete() {
    startDel(async () => {
      const res = await softDeleteGpsDevice(device.id, caseId);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.deleted"));
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="text-sm font-semibold text-foreground">
              GPS #{index + 1}
            </span>
            {device.provider && (
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
                  PROVIDER_COLORS[device.provider] ?? "bg-muted text-muted-foreground",
                )}
              >
                {device.provider}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {canEdit && (
              <GpsDeviceFormDialog caseId={caseId} device={device} agents={agents} />
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-3 w-3" />
                {tCommon("delete")}
              </Button>
            )}
          </div>
        </div>

        {/* Fields grid */}
        <div className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
          <Field label={t("fields.imei")} value={device.imei}>
            {device.imei && (
              <CopyButton
                onCopy={() => copyToClipboard(device.imei!, "toast.imeiCopied")}
                label={t("copyImei")}
              />
            )}
          </Field>

          <Field label={t("fields.phoneNumber")} value={device.phone_number}>
            {device.phone_number && (
              <CopyButton
                onCopy={() => copyToClipboard(device.phone_number!, "toast.simCopied")}
                label={t("copySim")}
              />
            )}
          </Field>

          <Field label={t("fields.provider")} value={device.provider ?? null} />

          {device.gps903_device_id != null && (
            <Field label={t("fields.gps903DeviceId")} value={String(device.gps903_device_id)} />
          )}

          {linkedAgent && (
            <Field
              label={t("fields.linkedAgent")}
              value={`${linkedAgent.full_name} (${linkedAgent.agent_code})`}
            />
          )}

          {device.notes && (
            <div className="sm:col-span-2">
              <Field label={t("fields.notes")} value={device.notes} />
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              {t("deleteDialog.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("deleteDialog.message")}</p>

            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-1.5 font-mono text-xs">
              {device.imei && (
                <div>
                  <span className="text-muted-foreground">IMEI: </span>
                  <span className="text-foreground font-semibold">{device.imei}</span>
                </div>
              )}
              {device.phone_number && (
                <div>
                  <span className="text-muted-foreground">SIM: </span>
                  <span className="text-foreground font-semibold">{device.phone_number}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground/70">
              {t("deleteDialog.irreversible")}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("deleteDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={delPending}
              onClick={handleDelete}
            >
              {delPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="font-mono text-xs font-medium text-foreground/90">
          {value ?? "—"}
        </p>
        {children}
      </div>
    </div>
  );
}

function CopyButton({ onCopy, label }: { onCopy: () => void; label: string }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onCopy}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
    >
      <ClipboardCopy className="h-3 w-3" />
    </button>
  );
}
