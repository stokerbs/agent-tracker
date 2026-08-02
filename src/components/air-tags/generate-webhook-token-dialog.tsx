"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { generateWebhookToken } from "@/app/(dashboard)/air-tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEBHOOK_TOKEN_LABEL_MAX, isWebhookTokenLabelValid } from "./air-tag-webhook-utils";

interface Props {
  airTagId: string;
  /** Invoked after a successful generate, so the parent list can refetch. */
  onGenerated?: () => void;
}

interface RevealedToken {
  token: string;
  tokenPrefix: string;
}

/**
 * "Generate Token" dialog for the webhook automation feature. The plaintext
 * token returned by generateWebhookToken() is held ONLY in this component's
 * local state, and ONLY for the duration this dialog stays open — closing
 * the dialog (via Cancel/Done/Escape/overlay click, all routed through
 * handleClose) unconditionally clears it. There is no server call, storage,
 * or other path that can recover it afterwards: generateWebhookToken()
 * returns the plaintext exactly once and listWebhookTokens() never selects
 * token_hash, so re-opening this dialog can only mint a brand-new token, not
 * reveal the old one.
 */
export function GenerateWebhookTokenDialog({ airTagId, onGenerated }: Props) {
  const t = useTranslations("airTags.webhook.generate");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<RevealedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const labelValid = isWebhookTokenLabelValid(label);

  function resetState() {
    setLabel("");
    setRevealed(null);
    setCopied(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetState();
  }

  function handleGenerate() {
    if (!labelValid) {
      toast.error(t("labelTooLong"));
      return;
    }
    start(async () => {
      const res = await generateWebhookToken({ airTagId, label: label.trim() || undefined });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRevealed({ token: res.token, tokenPrefix: res.tokenPrefix });
      onGenerated?.();
    });
  }

  function handleCopy() {
    if (!revealed) return;
    navigator.clipboard
      .writeText(revealed.token)
      .then(() => {
        setCopied(true);
        toast.success(t("copiedToast"));
      })
      .catch(() => toast.error(t("copyFailed")));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <KeyRound className="h-4 w-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        {!revealed ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-sky-500" />
                {t("title")}
              </DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="webhook-token-label">
                {t("labelField")}
                <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional")})</span>
              </Label>
              <Input
                id="webhook-token-label"
                value={label}
                maxLength={WEBHOOK_TOKEN_LABEL_MAX}
                placeholder={t("labelPlaceholder")}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {label.length}/{WEBHOOK_TOKEN_LABEL_MAX}
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
                {tCommon("cancel")}
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={pending || !labelValid}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("submit")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-500" />
                {t("revealTitle")}
              </DialogTitle>
              <DialogDescription>{t("revealDescription")}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{revealed.token}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 gap-1 px-2 text-xs"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("copied") : t("copy")}
                </Button>
              </div>

              <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p>{t("warning")}</p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                {t("done")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
