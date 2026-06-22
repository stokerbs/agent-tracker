"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AGENT_STATUS_META } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import type { AgentStatus } from "@/lib/types";

export interface TeamMember {
  id: string;
  full_name: string;
  agent_code: string;
  photo_url: string | null;
  status: AgentStatus;
}

export function AssignedTeamCard({ members }: { members: TeamMember[] }) {
  const t = useTranslations("assignAgents");

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4 text-muted-foreground" />
        {t("assignedTeam")}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {t("nAssigned", { count: members.length })}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noneAssigned")}</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {members.map((m) => {
            const meta = AGENT_STATUS_META[m.status];
            return (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background py-1.5 pl-1.5 pr-3">
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8">
                    {m.photo_url && <AvatarImage src={m.photo_url} />}
                    <AvatarFallback>{initials(m.full_name)}</AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                      meta.dot,
                    )}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">{m.full_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{m.agent_code}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
