"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createPayment } from "@/app/(dashboard)/payroll/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent, Case } from "@/lib/types";

interface Props {
  agents: Agent[];
  cases: Case[];
}

export function AddPaymentDialog({ agents, cases }: Props) {
  const t = useTranslations("payroll");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [agentId, setAgentId] = useState("");
  const [caseId, setCaseId] = useState("none");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (agentId) data.set("agent_id", agentId);
    if (caseId && caseId !== "none") data.set("case_id", caseId);
    else data.delete("case_id");

    startTransition(async () => {
      try {
        await createPayment(data);
        toast.success(t("dialog.toast.success"));
        setOpen(false);
        form.reset();
        setAgentId("");
        setCaseId("none");
      } catch {
        toast.error("Failed to save payment entry.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" />
          {t("addPayment")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("dialog.agentLabel")}</Label>
            <Select value={agentId} onValueChange={setAgentId} required>
              <SelectTrigger>
                <SelectValue placeholder={t("dialog.agentPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name} ({a.agent_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("dialog.caseLabel")}</Label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger>
                <SelectValue placeholder={t("dialog.casePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("dialog.casePlaceholder")}</SelectItem>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="work_date">{t("dialog.dateLabel")}</Label>
            <Input
              id="work_date"
              name="work_date"
              type="date"
              defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">{t("dialog.amountLabel")}</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("dialog.notesLabel")}</Label>
            <Input
              id="notes"
              name="notes"
              placeholder={t("dialog.notesPlaceholder")}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !agentId}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("dialog.submitButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
