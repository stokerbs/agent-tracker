"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { assignAgent, unassignAgent } from "@/app/(dashboard)/cases/actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/lib/utils";
import type { Agent } from "@/lib/types";

export function AssignAgentControl({
  caseId,
  assigned,
  available,
  canManage,
}: {
  caseId: string;
  assigned: Agent[];
  available: Agent[];
  canManage: boolean;
}) {
  const t = useTranslations("assignAgent");
  const [selected, setSelected] = useState<string>("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const unassigned = available.filter(
    (a) => !assigned.some((x) => x.id === a.id),
  );

  function add() {
    if (!selected) return;
    start(async () => {
      const res = await assignAgent(caseId, selected);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.assigned"));
      setSelected("");
      router.refresh();
    });
  }

  function remove(agentId: string) {
    start(async () => {
      const res = await unassignAgent(caseId, agentId);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.removed"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {assigned.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noAgentsAssigned")}</p>
      )}
      <div className="space-y-2">
        {assigned.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border p-2"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {a.photo_url && <AvatarImage src={a.photo_url} />}
                <AvatarFallback>{initials(a.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{a.full_name}</p>
                <p className="text-xs text-muted-foreground">{a.agent_code}</p>
              </div>
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(a.id)}
                disabled={pending}
                aria-label="Remove agent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canManage && unassigned.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t("placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {unassigned.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name} ({a.agent_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={pending || !selected} size="icon">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
