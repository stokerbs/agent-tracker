"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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
import type { Gps903Credential } from "@/lib/types";
import { createCredential, updateCredential } from "@/app/(dashboard)/gps903-credentials/actions";

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
  gps903_device_id: "" as unknown as number,
  is_active:        true,
};

export function CredentialFormDialog({ open, onOpenChange, mode, credential }: Props) {
  const [form, setForm]       = useState(EMPTY);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setForm(
        mode === "edit" && credential
          ? {
              device_name:      credential.device_name,
              imei:             credential.imei,
              device_password:  "",           // never pre-filled — blank = keep existing
              gps903_device_id: credential.gps903_device_id,
              is_active:        credential.is_active,
            }
          : EMPTY,
      );
    }
  }, [open, mode, credential]);

  function set(field: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const deviceId = Number(form.gps903_device_id);
    if (isNaN(deviceId) || deviceId <= 0) {
      toast.error("GPS903 Device ID must be a positive number");
      return;
    }
    if (!/^\d{15}$/.test(form.imei.trim())) {
      toast.error("IMEI must be exactly 15 digits");
      return;
    }
    if (mode === "add" && !form.device_password) {
      toast.error("Device password is required");
      return;
    }

    startTransition(async () => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Add GPS903 Device" : `Edit — ${credential?.device_name}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-1.5">
            <Label htmlFor="gps903_device_id">GPS903 Device ID</Label>
            <Input
              id="gps903_device_id"
              type="number"
              placeholder="e.g. 3315745"
              value={form.gps903_device_id || ""}
              onChange={(e) => set("gps903_device_id", e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              The integer device ID from the GPS903 platform.
            </p>
          </div>

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
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === "add" ? "Add Device" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
