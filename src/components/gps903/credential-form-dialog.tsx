"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  phone_number:     "",
  provider:         "",
  is_active:        true,
};

export function CredentialFormDialog({ open, onOpenChange, mode, credential }: Props) {
  const t = useTranslations("gps903Credentials");
  const tCommon = useTranslations("common");
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
              phone_number:     credential.phone_number ?? "",
              provider:         credential.provider ?? "",
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
      toast.error(t("form.imeiInvalidToast"));
      return;
    }
    if (!form.device_password) {
      toast.error(t("form.passwordMissingToast"));
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
        toast.success(t("form.testSuccessToast", { id: res.device_id }));
      } else if (res.loginOk) {
        toast.warning(t("form.testLoginOnlyToast"));
      } else if (res.error) {
        toast.error(res.error);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!/^\d{15}$/.test(form.imei.trim())) {
      toast.error(t("form.imeiRequiredToast"));
      return;
    }
    if (mode === "add" && !form.device_password) {
      toast.error(t("form.passwordRequiredToast"));
      return;
    }

    const rawId = form.gps903_device_id.trim();
    const deviceId = rawId ? Number(rawId) : null;
    if (rawId && (isNaN(deviceId!) || deviceId! <= 0)) {
      toast.error(t("form.deviceIdInvalidToast"));
      return;
    }

    startSave(async () => {
      const payload = {
        device_name:      form.device_name.trim(),
        imei:             form.imei.trim(),
        device_password:  form.device_password,
        gps903_device_id: deviceId,
        phone_number:     form.phone_number.trim() || null,
        provider:         form.provider || null,
        is_active:        form.is_active,
      };

      const res =
        mode === "add"
          ? await createCredential(payload)
          : await updateCredential(credential!.id, payload);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(mode === "add" ? t("form.addedToast") : t("form.updatedToast"));
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
            {mode === "add" ? t("form.addTitle") : t("form.editTitle", { name: credential?.device_name })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Device Name */}
          <div className="space-y-1.5">
            <Label htmlFor="device_name">{t("form.deviceName")}</Label>
            <Input
              id="device_name"
              placeholder={t("form.deviceNamePlaceholder")}
              value={form.device_name}
              onChange={(e) => set("device_name", e.target.value)}
              required
            />
          </div>

          {/* IMEI */}
          <div className="space-y-1.5">
            <Label htmlFor="imei">{t("form.imei")}</Label>
            <Input
              id="imei"
              placeholder={t("form.imeiPlaceholder")}
              value={form.imei}
              onChange={(e) => set("imei", e.target.value.replace(/\D/g, "").slice(0, 15))}
              maxLength={15}
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="device_password">
              {t("form.password")}
              {mode === "edit" && (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                  ({t("form.passwordKeepHint")})
                </span>
              )}
            </Label>
            <Input
              id="device_password"
              type="password"
              placeholder={mode === "edit" ? "••••••••" : t("form.passwordPlaceholder")}
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
              {testing ? t("form.testing") : t("form.testButton")}
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
                      {t("form.testResult", {
                        id: testResult.device_id ?? "",
                        lat: testResult.lat != null ? testResult.lat.toFixed(5) : "",
                        lng: testResult.lng != null ? testResult.lng.toFixed(5) : "",
                        speed: testResult.speed != null ? Math.round(testResult.speed) : "",
                        battery: testResult.battery ?? "",
                      })}
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
              {t("form.deviceId")}
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                ({t("form.deviceIdHint")})
              </span>
            </Label>
            <Input
              id="gps903_device_id"
              type="number"
              placeholder={t("form.deviceIdPlaceholder")}
              value={form.gps903_device_id}
              onChange={(e) => set("gps903_device_id", e.target.value)}
              min={1}
            />
            {!form.gps903_device_id && (
              <p className="text-[11px] text-muted-foreground">
                {t("form.noDeviceIdHint")}
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <Label htmlFor="phone_number">
              {t("form.phone")}
            </Label>
            <Input
              id="phone_number"
              type="tel"
              placeholder="e.g. 0812345678"
              value={form.phone_number}
              onChange={(e) => set("phone_number", e.target.value)}
            />
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label htmlFor="provider">
              {t("form.provider")}
            </Label>
            <Select value={form.provider} onValueChange={(v) => set("provider", v === "none" ? "" : v)}>
              <SelectTrigger id="provider">
                <SelectValue placeholder={t("form.providerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("form.providerNone")}</SelectItem>
                <SelectItem value="AIS">AIS</SelectItem>
                <SelectItem value="TRUE">TRUE</SelectItem>
                <SelectItem value="DTAC">DTAC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active toggle */}
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">{t("form.active")}</p>
              <p className="text-xs text-muted-foreground">
                {t("form.activeHint")}
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
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "add" ? t("form.addButton") : t("form.saveButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
