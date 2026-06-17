"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  AGENT_STATUS_META,
  CASE_PRIORITY_META,
  CASE_STATUS_META,
} from "@/lib/constants";
import type { AgentStatus, CasePriority, CaseStatus } from "@/lib/types";

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const t = useTranslations("status.agent");
  const meta = AGENT_STATUS_META[status];
  const isLive = status === "online" || status === "moving";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        meta.badge,
        "border border-transparent",
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        {isLive && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              meta.dot,
            )}
          />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", meta.dot)} />
      </span>
      {t(status)}
    </span>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const t = useTranslations("status.case");
  const meta = CASE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        meta.badge,
        "border border-transparent",
      )}
    >
      {t(status)}
    </span>
  );
}

export function CasePriorityBadge({ priority }: { priority: CasePriority }) {
  const t = useTranslations("status.priority");
  const meta = CASE_PRIORITY_META[priority];
  const isHigh = priority === "critical" || priority === "high";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        meta.badge,
        "border border-transparent",
      )}
    >
      {isHigh && <span className="h-1 w-1 rounded-full bg-current opacity-80" />}
      {t(priority)}
    </span>
  );
}
