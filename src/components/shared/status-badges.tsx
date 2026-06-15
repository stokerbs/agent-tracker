import { Badge } from "@/components/ui/badge";
import {
  AGENT_STATUS_META,
  CASE_PRIORITY_META,
  CASE_STATUS_META,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AgentStatus, CasePriority, CaseStatus } from "@/lib/types";

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const meta = AGENT_STATUS_META[status];
  return (
    <Badge className={cn("border-transparent", meta.badge)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const meta = CASE_STATUS_META[status];
  return <Badge className={cn("border-transparent", meta.badge)}>{meta.label}</Badge>;
}

export function CasePriorityBadge({ priority }: { priority: CasePriority }) {
  const meta = CASE_PRIORITY_META[priority];
  return <Badge className={cn("border-transparent", meta.badge)}>{meta.label}</Badge>;
}
