"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plus, Satellite, Settings2, Trash2, XCircle, Zap } from "lucide-react";
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
} from "./actions";

interface Props {
  credentials: Gps903Credential[];
}

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function maskImei(imei: string): string {
  return imei.slice(0, 6) + "•".repeat(imei.length - 9) + imei.slice(-3);
}

export function CredentialsClient({ credentials }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  if (credentials.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Satellite className="h-8 w-8 text-muted-foreground/30" />
            <p className="font-medium">No GPS903 credentials configured</p>
            <p className="text-sm text-muted-foreground">
              Add at least one device credential to enable GPS polling and map display.
            </p>
            <Button onClick={() => setAddOpen(true)} className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" />
              Add First Device
            </Button>
          </CardContent>
        </Card>
        <CredentialFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          mode="add"
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Device
        </Button>
      </div>

      <div className="space-y-3">
        {credentials.map((cred) => (
          <CredentialRow key={cred.id} credential={cred} />
        ))}
      </div>

      <CredentialFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="add"
      />
    </>
  );
}

function CredentialRow({ credential: cred }: { credential: Gps903Credential }) {
  const [editOpen, setEditOpen]         = useState(false);
  const [testResult, setTestResult]     = useState<string | null>(null);
  const [, startTransition]             = useTransition();
  const [toggling, setToggling]         = useState(false);
  const [testing, setTesting]           = useState(false);
  const [deleting, setDeleting]         = useState(false);

  function handleToggle() {
    setToggling(true);
    startTransition(async () => {
      const res = await toggleCredentialActive(cred.id, !cred.is_active);
      setToggling(false);
      if (res.error) toast.error(res.error);
      else toast.success(cred.is_active ? "Device disabled" : "Device enabled");
    });
  }

  function handleTest() {
    setTesting(true);
    setTestResult(null);
    startTransition(async () => {
      const res = await testCredential(cred.id);
      setTesting(false);
      if (res.error) {
        setTestResult(`✗ ${res.error}`);
        toast.error(res.error);
      } else {
        const msg = `✓ ${res.lat?.toFixed(5)}, ${res.lng?.toFixed(5)} · ${res.speed} km/h · ${res.battery ?? "?"}% battery`;
        setTestResult(msg);
        toast.success("Device is online");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete credential for "${cred.device_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    startTransition(async () => {
      const res = await deleteCredential(cred.id);
      setDeleting(false);
      if (res.error) toast.error(res.error);
      else toast.success("Credential deleted");
    });
  }

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
            <Satellite className="h-4.5 w-4.5 text-emerald-500" />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-0.5">
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
                {cred.is_active ? "Active" : "Inactive"}
              </Badge>
              {cred.last_sync_ok === true && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {cred.last_sync_ok === false && (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-mono">IMEI {maskImei(cred.imei)}</span>
              <span className="font-mono">ID #{cred.gps903_device_id}</span>
              <span>Last sync: {timeAgo(cred.last_synced_at)}</span>
            </div>

            {testResult && (
              <p
                className={cn(
                  "mt-1 font-mono text-xs",
                  testResult.startsWith("✓") ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
                )}
              >
                {testResult}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Test
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setEditOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Edit
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={cn("h-8 text-xs", cred.is_active ? "text-muted-foreground" : "text-emerald-600")}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (cred.is_active ? "Disable" : "Enable")}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-red-500 hover:bg-red-500/10 hover:text-red-500"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
