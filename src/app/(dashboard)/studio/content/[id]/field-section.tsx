"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Labelled editor field with an auto-growing textarea. Owner can always type
 * here — AI actions only ever propose replacements.
 */
export function FieldSection({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
  minRows = 3,
  maxChars,
  actions,
  disabled,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  minRows?: number;
  maxChars?: number;
  actions?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minRows * 24 + 16)}px`;
  }, [value, minRows]);

  const over = maxChars != null && value.length > maxChars;

  return (
    <section className={cn("rounded-lg border border-border/70 bg-card", className)} aria-labelledby={`${id}-label`}>
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <label id={`${id}-label`} htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </label>
          {hint && <span className="ml-2 text-[11px] text-muted-foreground/70">{hint}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {maxChars != null && (
            <span className={cn("text-[11px] tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")} aria-live="polite">
              {value.length.toLocaleString()} / {maxChars.toLocaleString()}
            </span>
          )}
          {actions}
        </div>
      </header>
      <textarea
        ref={ref}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={minRows}
        className={cn(
          "block w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-b-lg disabled:cursor-not-allowed disabled:opacity-60",
          mono && "font-mono text-[13px]",
        )}
      />
    </section>
  );
}
