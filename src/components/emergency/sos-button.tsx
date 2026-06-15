"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Siren } from "lucide-react";
import { toast } from "sonner";
import { triggerSos } from "@/app/(dashboard)/emergency/actions";
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
import { Textarea } from "@/components/ui/textarea";

export function SosButton() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function fire() {
    start(async () => {
      // Best-effort geolocation capture.
      const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          () => resolve(null),
          { timeout: 5000 },
        );
      });

      const res = await triggerSos({
        lat: coords?.latitude,
        lng: coords?.longitude,
        notes: notes || undefined,
      });
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Emergency alert sent — supervisors notified");
      setOpen(false);
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Siren className="h-4 w-4" /> SOS
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Siren className="h-5 w-5" /> Trigger Emergency Alert
          </DialogTitle>
          <DialogDescription>
            This immediately notifies all supervisors with your current GPS
            location. Use only in a genuine emergency.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional: describe the situation…"
        />
        <DialogFooter>
          <Button variant="destructive" onClick={fire} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Siren className="h-4 w-4" />
            )}
            Send SOS now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
