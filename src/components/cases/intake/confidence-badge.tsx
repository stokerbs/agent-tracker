import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Confidence pill. <70 shows a warning (red), 70–89 amber, 90+ green.
 */
export function ConfidenceBadge({ value, className }: { value: number; className?: string }) {
  const low = value < 70;
  const mid = value >= 70 && value < 90;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        low && "bg-red-500/15 text-red-500",
        mid && "bg-amber-500/15 text-amber-500",
        !low && !mid && "bg-emerald-500/15 text-emerald-500",
        className,
      )}
      title={low ? "Low confidence — please verify" : undefined}
    >
      {low && <AlertTriangle className="h-2.5 w-2.5" />}
      {value}%
    </span>
  );
}
