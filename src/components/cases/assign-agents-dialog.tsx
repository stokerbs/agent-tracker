"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  getCaseAssignmentData,
  setCaseAssignments,
  type AssignableAgent,
} from "@/app/(dashboard)/cases/actions";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AGENT_STATUS_META } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";

export function AssignAgentsDialog({
  caseId,
  open,
  onOpenChange,
  onSaved,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("assignAgents");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCaseAssignmentData(caseId).then((res) => {
      if ("error" in res) {
        toast.error(res.error);
        onOpenChange(false);
        return;
      }
      setAgents(res.agents);
      setSelected(new Set(res.assignedIds));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, caseId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setSaving(true);
    setCaseAssignments(caseId, [...selected]).then((res) => {
      setSaving(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(t("saved", { added: res.added, removed: res.removed }));
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("noAgents")}</p>
        ) : (
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {agents.map((a) => {
              const checked = selected.has(a.id);
              const meta = AGENT_STATUS_META[a.status];
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                    checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  {/* Checkbox */}
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>

                  {/* Avatar with status dot */}
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      {a.photo_url && <AvatarImage src={a.photo_url} />}
                      <AvatarFallback>{initials(a.full_name)}</AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                        meta.dot,
                      )}
                      aria-hidden
                    />
                  </div>

                  {/* Name + role */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.agent_role ? t(`role.${a.agent_role}`) : a.agent_code}
                    </p>
                  </div>

                  {/* Status label */}
                  <span className="shrink-0 text-xs text-muted-foreground">{t(`status.${a.status}`)}</span>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("save", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
