"use client";

/**
 * Plain-language "how do I build the iOS Shortcut" help panel for the
 * webhook-token automation feature. Renders as a collapsible disclosure
 * (closed by default so it doesn't crowd the token list) inside
 * webhook-tokens-panel.tsx.
 *
 * NEXT_PUBLIC_APP_URL mirrors the fallback already used in src/lib/email.ts
 * — a `NEXT_PUBLIC_`-prefixed var is safe to read directly in a client
 * component (Next.js inlines it at build time; it is not a secret). No real
 * domain is hardcoded beyond that same "detectivepulse.app" placeholder
 * fallback already established there.
 */

import { useState } from "react";
import { ChevronDown, Copy, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://detectivepulse.app";
const WEBHOOK_URL = `${APP_URL}/api/air-tags/webhook/ping`;

const STEP_KEYS = ["automation", "findMy", "getContents", "test"] as const;

export function ShortcutsSetupGuide() {
  const t = useTranslations("airTags.webhook.guide");
  const [open, setOpen] = useState(false);

  function copy(text: string, toastKey: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t(toastKey as Parameters<typeof t>[0])))
      .catch(() => {});
  }

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-sky-500" />
          {t("title")}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border/60 px-4 py-4 text-sm">
          <p className="text-muted-foreground">{t("intro")}</p>

          <ol className="space-y-4">
            {STEP_KEYS.map((key, i) => (
              <li key={key} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-[11px] font-bold text-sky-500 ring-1 ring-sky-500/30">
                  {i + 1}
                </span>
                <div className="space-y-1">
                  <p className="font-medium">{t(`steps.${key}.title`)}</p>
                  <p className="text-muted-foreground">{t(`steps.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Technical reference for the "Get Contents of URL" action */}
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("referenceTitle")}
            </p>

            <ReferenceRow
              label={t("methodLabel")}
              value="POST"
              onCopy={() => copy("POST", "toasts.methodCopied")}
            />
            <ReferenceRow
              label={t("endpointLabel")}
              value={WEBHOOK_URL}
              onCopy={() => copy(WEBHOOK_URL, "toasts.endpointCopied")}
            />
            <ReferenceRow
              label={t("headerLabel")}
              value="Authorization: Bearer <your token>"
              onCopy={() => copy("Authorization: Bearer <your token>", "toasts.headerCopied")}
            />
            <ReferenceRow
              label={t("bodyLabel")}
              value={'{ "lat": <Find My Latitude>, "lng": <Find My Longitude> }'}
              onCopy={() => copy('{ "lat": <Find My Latitude>, "lng": <Find My Longitude> }', "toasts.bodyCopied")}
            />

            <p className="pt-1 text-xs text-muted-foreground">{t("referenceHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
        <code className="block overflow-x-auto whitespace-nowrap font-mono text-xs">{value}</code>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}
