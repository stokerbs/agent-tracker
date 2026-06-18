"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  updateGpsDevice,
} from "@/app/(dashboard)/cases/gps-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Agent, GpsDevice } from "@/lib/types";

interface Props {
  caseId: string;
  device: GpsDevice;
  agents?: Pick<Agent, "id" | "full_name" | "agent_code">[];
}

/**
 * Edit-only dialog for GPS device agent assignment and notes.
 * Device metadata (IMEI, SIM, provider) is now managed in GPS Credentials.
 */
export function GpsDeviceFormDialog({ caseId, device, agents = [] }: Props) {
  const t = useTranslations("cases.gps");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const res = await updateGpsDevice(device.id, caseId, formData);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.updated"));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Pencil className="h-3 w-3" />
          {tCommon("edit")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>
            {t("editDescription")}
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Device metadata (IMEI, SIM, provider) is managed in GPS Credentials.
          </p>

          {/* Agent link */}
          {agents.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="gps-agent">
                {t("fields.linkedAgent")}
                <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional") ?? "optional"})</span>
              </Label>
              <Select name="agent_id" defaultValue={device.agent_id ?? "none"}>
                <SelectTrigger id="gps-agent">
                  <SelectValue placeholder={t("fields.linkedAgentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("fields.noAgent")}</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name} ({a.agent_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{t("fields.linkedAgentHint")}</p>
            </div>
          )}

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
              defaultValue={device.notes ?? ""}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
