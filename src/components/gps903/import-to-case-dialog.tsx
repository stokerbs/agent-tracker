"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [open, setOpen]               = useState(false);
  const [selectedCase,  setCase]      = useState("");
  const [selectedAgent, setAgent]     = useState("none");
  const [pending, start]              = useTransition();

  function handleImport() {
    if (!selectedCase) { toast.error("Select a case first"); return; }
    start(async () => {
      const res = await attachCredentialToCase(
        credentialId,
        selectedCase,
        selectedAgent === "none" ? null : selectedAgent,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Device attached to case");
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
          Attach to Case
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Attach to Case</DialogTitle>
          <DialogDescription>
            {deviceName ? deviceName : "GPS Device"} — link to a case and optionally assign an agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itc-case">Case</Label>
            <Select value={selectedCase} onValueChange={setCase}>
              <SelectTrigger id="itc-case">
                <SelectValue placeholder="Select a case…" />
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
              Agent
              <span className="ml-1 text-[10px] text-muted-foreground">(optional)</span>
            </Label>
            <Select value={selectedAgent} onValueChange={setAgent}>
              <SelectTrigger id="itc-agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No agent</SelectItem>
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
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={pending || !selectedCase}>
            {pending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Attach Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
