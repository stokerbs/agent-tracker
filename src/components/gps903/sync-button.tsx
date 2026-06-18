"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncGps903Devices } from "@/app/(dashboard)/gps903-discovery/actions";

export function SyncButton() {
  const [pending, start] = useTransition();

  function handleSync() {
    start(async () => {
      const res = await syncGps903Devices();
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`${res.count} devices synced from GPS903`);
      }
    });
  }

  return (
    <Button onClick={handleSync} disabled={pending} className="gap-2">
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Syncing…" : "Sync Devices"}
    </Button>
  );
}
