"use client";

import { useTranslations } from "next-intl";

/**
 * Animated "<name> is typing…" row. Renders nothing when name is null.
 */
export function TypingIndicator({ name }: { name: string | null }) {
  const t = useTranslations("messages");
  if (!name) return null;

  return (
    <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
      </span>
      <span>{t("typing", { name })}</span>
    </div>
  );
}
