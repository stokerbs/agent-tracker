"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/studio/types";

/**
 * Inline "approved for AI content" toggle. Generic over the server action so
 * knowledge, questions, cases and insights share one island.
 */
export function ApproveSwitch({
  id,
  approved,
  action,
  label = "อนุมัติให้ AI ใช้",
  disabled,
  disabledReason,
  className,
}: {
  id: string;
  approved: boolean;
  action: (id: string, approved: boolean) => Promise<ActionResult>;
  label?: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(approved);
  const [pending, start] = useTransition();

  function onChange(next: boolean) {
    const prev = checked;
    setChecked(next);
    start(async () => {
      const res = await action(id, next);
      if (!res.ok) {
        setChecked(prev);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "อนุมัติให้ AI ใช้แล้ว" : "ยกเลิกการอนุมัติแล้ว");
      router.refresh();
    });
  }

  const control = (
    <label className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", disabled && "opacity-60", className)}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled || pending} aria-label={label} />
    </label>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{control}</span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }
  return control;
}
