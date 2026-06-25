import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  /** Short, human-readable headline (caller supplies translated copy). */
  title: string;
  /** Optional supporting copy (caller supplies translated copy). */
  description?: string;
  /**
   * Optional label for the reset/retry control. When omitted, no reset
   * control is rendered. Caller supplies translated copy.
   */
  resetLabel?: string;
  /** Invoked when the reset/retry control is activated (e.g. boundary `reset()`). */
  onReset?: () => void;
  /**
   * Presentation context. `portal` is the client-facing variant and never
   * surfaces technical internals. `internal` may show extra technical detail.
   */
  variant?: "portal" | "internal";
  /**
   * Optional technical detail (e.g. error digest/message). Only rendered in
   * the `internal` variant; ignored entirely in the `portal` variant.
   */
  detail?: string;
  /** Optional override icon; falls back to a warning glyph. */
  icon?: React.ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  description,
  resetLabel,
  onReset,
  variant = "portal",
  detail,
  icon,
  className,
}: ErrorStateProps) {
  const showDetail = variant === "internal" && detail;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-destructive/40 bg-destructive/5 text-destructive">
        {icon ?? <AlertTriangle className="h-6 w-6" aria-hidden="true" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
          {description}
        </p>
      )}
      {showDetail && (
        <pre className="mt-3 max-w-md overflow-x-auto rounded-md bg-muted/40 px-3 py-2 text-left font-mono text-[10px] leading-relaxed text-muted-foreground">
          {detail}
        </pre>
      )}
      {resetLabel && onReset && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="mt-5"
        >
          {resetLabel}
        </Button>
      )}
    </div>
  );
}
