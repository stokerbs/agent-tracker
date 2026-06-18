"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Loader2, TriangleAlert, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Gps903Credential } from "@/lib/types";
import {
  createCredential,
  updateCredential,
  testRawCredential,
  type TestResult,
} from "@/app/(dashboard)/gps903-credentials/actions";

interface Props {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  mode:         "add" | "edit";
  credential?:  Gps903Credential;
}

const EMPTY = {
  device_name:      "",
  imei:             "",
  device_password:  "",
  gps903_device_id: "" as string,
  is_active:        true,
};

export function CredentialFormDialog({ open, onOpenChange, mode, credential }: Props) {
  const [form, setForm]             = useState(EMPTY);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, startSave]         = useTransition();
  const [testing, startTest]        = useTransition();

  useEffect(() => {
    if (open) {
      setTestResult(null);
      setForm(
        mode === "edit" && credential
          ? {
              device_name:      credential.device_name,
              imei:             credential.imei,
              device_password:  "",   // never pre-filled
              gps903_device_id: credential.gps903_device_id?.toString() ?? "",
              is_active:        credential.is_active,
            }
          : EMPTY,
      );
    }
  }, [open, mode, credential]);

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear test result when credentials change
    if (field === "imei" || field === "device_password") setTestResult(null);
  }

  function handleTest() {
    if (!/^\d{15}$/.test(form.imei.trim())) {
      toast.error("Enter a valid 15-digit IMEI before testing");
      return;
    }
    if (!form.device_password) {
      toast.error("Enter the device password before testing");
      return;
    }

    startTest(async () => {
      const res = await testRawCredential(form.imei.trim(), form.device_password);
      setTestResult(res);

      // Auto-fill detected device ID into the form
      if (res.device_id) {
        setForm((prev) => ({ ...prev, gps903_device_id: String(res.device_id) }));
      }

      if (res.ok) {
        toast.success(`Device ID #${res.device_id} detected — position confirmed`);
      } else if (res.loginOk) {
        toast.warning("Login succeeded — enter Device ID manually");
      } else if (res.error) {
        toast.error(res.error);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!/^\d{15}$/.test(form.imei.trim())) {
      toast.error("IMEI must be exactly 15 digits");
      return;
    }
    if (mode === "add" && !form.device_password) {
      toast.error("Device password is required");
      return;
    }

    const rawId = form.gps903_device_id.trim();
    const deviceId = rawId ? Number(rawId) : null;
    if (rawId && (isNaN(deviceId!) || deviceId! <= 0)) {
      toast.error("Device ID must be a positive number");
      return;
    }

    startSave(async () => {
      const payload = {
        device_name:      form.device_name.trim(),
        imei:             form.imei.trim(),
        device_password:  form.device_password,
        gps903_device_id: deviceId,
        is_active:        form.is_active,
      };

      const res =
        mode === "add"
          ? await createCredential(payload)
          : await updateCredential(credential!.id, payload);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(mode === "add" ? "Device credential added" : "Credential updated");
        onOpenChange(false);
      }
    });
  }

  const canTest = form.imei.length === 15 && form.device_password.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add GPS903 Device" : `Edit — ${credential?.device_name}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Device Name */}
          <div className="space-y-1.5">
            <Label htmlFor="device_name">Device Name</Label>
            <Input
              id="device_name"
              placeholder="e.g. Vehicle A Tracker"
              value={form.device_name}
              onChange={(e) => set("device_name", e.target.value)}
              required
            />
          </div>

          {/* IMEI */}
          <div className="space-y-1.5">
            <Label htmlFor="imei">IMEI</Label>
            <Input
              id="imei"
              placeholder="15-digit IMEI"
              value={form.imei}
              onChange={(e) => set("imei", e.target.value.replace(/\D/g, "").slice(0, 15))}
              maxLength={15}
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="device_password">
              Device Password
              {mode === "edit" && (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  (leave blank to keep existing)
                </span>
              )}
            </Label>
            <Input
              id="device_password"
              type="password"
              placeholder={mode === "edit" ? "••••••••" : "GPS903 device password"}
              value={form.device_password}
              onChange={(e) => set("device_password", e.target.value)}
              required={mode === "add"}
            />
          </div>

          {/* Test Connection */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleTest}
              disabled={testing || !canTest}
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              {testing ? "Testing…" : "Test Connection & Auto-Detect Device ID"}
            </Button>

            {/* Test result */}
            {testResult && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs",
                  testResult.ok
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : testResult.loginOk
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                    : "border-red-500/30 bg-red-500/5 text-red-600",
                )}
              >
                {testResult.ok && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                {(testResult.loginOk || (!testResult.ok && testResult.error)) && (
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {testResult.ok ? (
                    <>
                      Login OK · Device ID{" "}
                      <span className="font-mono font-bold">#{testResult.device_id}</span>{" "}
                      detected
                      {testResult.lat != null && (
                        <>
                          {" "}· {testResult.lat.toFixed(5)}, {testResult.lng!.toFixed(5)}
                          {testResult.speed != null && <> · {Math.round(testResult.speed)} km/h</>}
                          {testResult.battery != null && <> · {testResult.battery}% battery</>}
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

          {/* Device ID (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="gps903_device_id">
              GPS903 Device ID
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                (auto-detected above, or enter manually)
              </span>
            </Label>
            <Input
              id="gps903_device_id"
              type="number"
              placeholder="Auto-detected by Test Connection"
              value={form.gps903_device_id}
              onChange={(e) => set("gps903_device_id", e.target.value)}
              min={1}
            />
            {!form.gps903_device_id && (
              <p className="text-[11px] text-muted-foreground">
                The device won&apos;t be polled until a Device ID is detected or entered.
              </p>
            )}
          </div>

          {/* Active toggle */}
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive devices are excluded from the polling cron.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded accent-emerald-500"
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "add" ? "Add Device" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
