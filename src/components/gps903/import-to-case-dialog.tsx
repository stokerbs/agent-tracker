"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { attachCredentialToCase } from "@/app/(dashboard)/gps903-discovery/actions";
import type { CaseOption, AgentOption } from "@/app/(dashboard)/gps903-discovery/types";

interface Props {
  credentialId: string;
  deviceName:   string | null;
  cases:        CaseOption[];
  agents:       AgentOption[];
}

export function ImportToCaseDialog({ credentialId, deviceName, cases, agents }: Props) {
  const router = useRouter();
  const t = useTranslations("gps903Discovery");
  const tCommon = useTranslations("common");
  const [open, setOpen]               = useState(false);
  const [selectedCase,  setCase]      = useState("");
  const [selectedAgent, setAgent]     = useState("none");
  const [pending, start]              = useTransition();

  function handleImport() {
    if (!selectedCase) { toast.error(t("importDialog.selectCaseFirst")); return; }
    start(async () => {
      const res = await attachCredentialToCase(
        credentialId,
        selectedCase,
        selectedAgent === "none" ? null : selectedAgent,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("importDialog.attachedToast"));
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
          <Link2 className="h-3 w-3" />
          {t("importDialog.title")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("importDialog.title")}</DialogTitle>
          <DialogDescription>
            {deviceName ? deviceName : t("importDialog.defaultDeviceName")} — {t("importDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itc-case">{t("importDialog.caseLabel")}</Label>
            <Select value={selectedCase} onValueChange={setCase}>
              <SelectTrigger id="itc-case">
                <SelectValue placeholder={t("importDialog.casePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.case_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="itc-agent">
              {t("importDialog.agentLabel")}
            </Label>
            <Select value={selectedAgent} onValueChange={setAgent}>
              <SelectTrigger id="itc-agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("importDialog.noAgent")}</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.full_name} ({a.agent_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{tCommon("cancel")}</Button>
          <Button onClick={handleImport} disabled={pending || !selectedCase}>
            {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t("importDialog.attachButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
