"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Link2Off, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { relinkAgent } from "@/app/(dashboard)/gps-devices/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Agent {
  id: string;
  full_name: string;
  agent_code: string;
}

interface Props {
  deviceId: string;
  currentAgentId: string | null;
  agents: Agent[];
}

export function RelinkAgentDialog({ deviceId, currentAgentId, agents }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentAgentId ?? "none");
  const [pending, start] = useTransition();

  function handleSave() {
    start(async () => {
      const agentId = selected === "none" ? null : selected;
      const res = await relinkAgent(deviceId, agentId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(agentId ? "Agent linked" : "Agent unlinked");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <Link2 className="h-3 w-3" />
          Change Agent
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            Link Agent to Device
          </DialogTitle>
          <DialogDescription>
            GPS903 pings for this device will update the selected agent on the Live Map.
          </DialogDescription>
        </DialogHeader>

        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder="Select agent…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Link2Off className="h-3.5 w-3.5" />
                None — no Live Map update
              </span>
            </SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.full_name} ({a.agent_code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
