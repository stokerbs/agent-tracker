"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { deleteAirTagTracker } from "@/app/(dashboard)/air-tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  airTagId: string;
  label: string;
  /** Where to send the user after a successful delete (typically the parent case). */
  redirectTo: string;
}

/** Staff-only soft-delete confirm dialog for an AirTag tracker (mirrors GpsDeviceCard's delete flow). */
export function DeleteAirTagDialog({ airTagId, label, redirectTo }: Props) {
  const t = useTranslations("airTags.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleDelete() {
    start(async () => {
      const res = await deleteAirTagTracker({ airTagId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setOpen(false);
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {t("trigger")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              {t("title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("message")}</p>
            <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-medium">{label}</p>
            <p className="text-xs text-muted-foreground/70">{t("irreversible")}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={handleDelete}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
