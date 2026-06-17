"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  createGpsDevice,
  updateGpsDevice,
} from "@/app/(dashboard)/cases/gps-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { GpsDevice, GpsProvider } from "@/lib/types";

const PROVIDERS: GpsProvider[] = ["AIS", "TRUE", "DTAC"];

interface Props {
  caseId: string;
  device?: GpsDevice;
}

export function GpsDeviceFormDialog({ caseId, device }: Props) {
  const t = useTranslations("cases.gps");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const isEdit = !!device;

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = isEdit
        ? await updateGpsDevice(device.id, caseId, formData)
        : await createGpsDevice(caseId, formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(isEdit ? t("toast.updated") : t("toast.created"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Pencil className="h-3 w-3" />
            {tCommon("edit")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("addDevice")}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("addDescription")}
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          {/* IMEI */}
          <div className="space-y-2">
            <Label htmlFor="gps-imei">
              {t("fields.imei")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional") ?? "optional"})</span>
            </Label>
            <Input
              id="gps-imei"
              name="imei"
              placeholder="867912345678901"
              maxLength={15}
              pattern="\d{15}"
              defaultValue={device?.imei ?? ""}
              inputMode="numeric"
            />
            <p className="text-[11px] text-muted-foreground">{t("fields.imeiHint")}</p>
          </div>

          {/* SIM Number */}
          <div className="space-y-2">
            <Label htmlFor="gps-phone">
              {t("fields.phoneNumber")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional") ?? "optional"})</span>
            </Label>
            <Input
              id="gps-phone"
              name="phone_number"
              type="tel"
              placeholder="0812345678"
              defaultValue={device?.phone_number ?? ""}
            />
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="gps-provider">
              {t("fields.provider")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional") ?? "optional"})</span>
            </Label>
            <Select name="provider" defaultValue={device?.provider ?? ""}>
              <SelectTrigger id="gps-provider">
                <SelectValue placeholder={t("fields.providerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="gps-notes">
              {t("fields.notes")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional") ?? "optional"})</span>
            </Label>
            <Textarea
              id="gps-notes"
              name="notes"
              rows={2}
              placeholder={t("fields.notesPlaceholder")}
              defaultValue={device?.notes ?? ""}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? tCommon("save") : t("addDevice")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
