"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { revokeWebhookToken } from "@/app/(dashboard)/air-tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  tokenId: string;
  /** Display label shown in the confirm dialog — the token's own label, or its masked prefix if untitled. */
  displayName: string;
  /** Invoked after a successful revoke, so the parent list can refetch. */
  onRevoked?: () => void;
}

/** Revoke-confirm dialog for a single webhook token — mirrors DeleteAirTagDialog's confirm/destructive-action pattern. */
export function RevokeWebhookTokenDialog({ tokenId, displayName, onRevoked }: Props) {
  const t = useTranslations("airTags.webhook.revoke");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleRevoke() {
    start(async () => {
      const res = await revokeWebhookToken({ tokenId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setOpen(false);
      onRevoked?.();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Ban className="h-3.5 w-3.5" />
        {t("trigger")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive" />
              {t("title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("message")}</p>
            <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 font-mono text-xs font-medium">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground/70">{t("irreversible")}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={handleRevoke}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
