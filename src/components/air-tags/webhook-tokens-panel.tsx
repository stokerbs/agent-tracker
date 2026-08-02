"use client";

/**
 * "Automation" tab content — lists this tracker's webhook tokens (for the
 * iOS Shortcuts auto-post integration), lets the user mint a new one
 * (GenerateWebhookTokenDialog) or revoke an existing one
 * (RevokeWebhookTokenDialog), and surfaces the plain-language Shortcuts
 * setup guide below the list. Self-contained client component: fetches via
 * listWebhookTokens and owns its own loading/error(retry)/empty/data states,
 * mirroring AirTagPositionTable's pattern.
 *
 * token_hash is never fetched or displayed here — listWebhookTokens()
 * intentionally omits it (see actions.ts), so there is nothing in this
 * component's state that could leak a usable secret.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBangkokTime } from "@/lib/maps/shared";
import { cn } from "@/lib/utils";
import { listWebhookTokens, type AirTagWebhookTokenSummary } from "@/app/(dashboard)/air-tags/actions";
import { GenerateWebhookTokenDialog } from "./generate-webhook-token-dialog";
import { RevokeWebhookTokenDialog } from "./revoke-webhook-token-dialog";
import { ShortcutsSetupGuide } from "./shortcuts-setup-guide";
import { isTokenActive, maskTokenPrefix, sortWebhookTokens } from "./air-tag-webhook-utils";

export function WebhookTokensPanel({ airTagId }: { airTagId: string }) {
  const t = useTranslations("airTags.webhook");
  const [tokens, setTokens] = useState<AirTagWebhookTokenSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTokens(null);
    setError(false);
    (async () => {
      const res = await listWebhookTokens({ airTagId });
      if (cancelled) return;
      if (!res.ok) {
        setError(true);
        return;
      }
      setTokens(res.tokens);
    })();
    return () => {
      cancelled = true;
    };
  }, [airTagId, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  const sorted = tokens ? sortWebhookTokens(tokens) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-sky-500" />
            {t("panelTitle")}
          </p>
          <p className="text-xs text-muted-foreground">{t("panelDescription")}</p>
        </div>
        <GenerateWebhookTokenDialog airTagId={airTagId} onGenerated={reload} />
      </div>

      {/* Loading state */}
      {tokens === null && !error && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Error state — with retry */}
      {error && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <KeyRound className="h-6 w-6 text-destructive/40" />
          <p className="text-xs text-muted-foreground">{t("error")}</p>
          <button
            onClick={reload}
            className="rounded-md border border-border/60 px-3 py-1 text-xs hover:bg-muted"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {/* Empty state */}
      {sorted && sorted.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <KeyRound className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">{t("empty")}</p>
          <p className="text-xs text-muted-foreground/70">{t("emptyHint")}</p>
        </div>
      )}

      {/* Data state */}
      {sorted && sorted.length > 0 && (
        <ul className="space-y-2">
          {sorted.map((token) => {
            const active = isTokenActive(token);
            const displayName = token.label?.trim() || maskTokenPrefix(token.token_prefix);
            return (
              <li
                key={token.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2.5",
                  active ? "border-border/60" : "border-border/40 opacity-60",
                )}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{token.label?.trim() || t("untitled")}</p>
                    {!active && (
                      <Badge variant="destructive" className="text-[10px]">
                        {t("revokedBadge")}
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{maskTokenPrefix(token.token_prefix)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("created", { date: formatBangkokTime(token.created_at) })}
                    {" · "}
                    {token.last_used_at
                      ? t("lastUsed", { date: formatBangkokTime(token.last_used_at) })
                      : t("neverUsed")}
                  </p>
                </div>

                {active && (
                  <RevokeWebhookTokenDialog tokenId={token.id} displayName={displayName} onRevoked={reload} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ShortcutsSetupGuide />
    </div>
  );
}
