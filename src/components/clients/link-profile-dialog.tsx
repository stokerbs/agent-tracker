"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { linkClientProfile, unlinkClientProfile } from "@/app/(dashboard)/clients/actions";

interface AvailableProfile {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface Props {
  clientId: string;
  isLinked: boolean;
  availableProfiles: AvailableProfile[];
  isAdmin: boolean;
}

export function LinkProfileDialog({ clientId, isLinked, availableProfiles, isAdmin }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  if (!isAdmin) return null;

  function handleLink() {
    if (!selectedId) return;
    start(async () => {
      const res = await linkClientProfile(clientId, selectedId);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Portal account linked.");
      setOpen(false);
      setSelectedId("");
      router.refresh();
    });
  }

  function handleUnlink() {
    start(async () => {
      const res = await unlinkClientProfile(clientId);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Portal account unlinked.");
      router.refresh();
    });
  }

  if (isLinked) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
        onClick={handleUnlink}
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />}
        Unlink account
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2 h-7 gap-1.5 text-xs">
          <Link2 className="h-3.5 w-3.5" />
          Link portal account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Link portal account</DialogTitle>
          <DialogDescription>
            Select a registered client user to grant them portal access to this record.
          </DialogDescription>
        </DialogHeader>

        {availableProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No unlinked client accounts found. Ask the client to register first.
          </p>
        ) : (
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Select user…" />
            </SelectTrigger>
            <SelectContent>
              {availableProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? p.email ?? p.id}
                  {p.full_name && p.email && (
                    <span className="ml-1 text-muted-foreground">({p.email})</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleLink}
            disabled={!selectedId || pending}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
