"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AssignAgentsDialog } from "./assign-agents-dialog";

export function AssignCaseButton({ caseId }: { caseId: string }) {
  const t = useTranslations("assignAgents");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" />
        {t("button")}
      </Button>
      <AssignAgentsDialog caseId={caseId} open={open} onOpenChange={setOpen} />
    </>
  );
}
