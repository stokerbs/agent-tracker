"use client";

import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { pollDeviceNow } from "@/app/(dashboard)/gps-devices/actions";
import { Button } from "@/components/ui/button";

interface Props {
  deviceId: string;
  size?: "sm" | "xs";
}

export function PollNowButton({ deviceId, size = "sm" }: Props) {
  const [pending, start] = useTransition();

  function handlePoll() {
    start(async () => {
      const res = await pollDeviceNow(deviceId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Position updated — ${res.lat?.toFixed(5)}, ${res.lng?.toFixed(5)}`);
      }
    });
  }

  if (size === "xs") {
    return (
      <button
        type="button"
        onClick={handlePoll}
        disabled={pending}
        title="Poll now"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        {pending
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <RefreshCw className="h-3 w-3" />
        }
      </button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePoll}
      disabled={pending}
      className="h-7 gap-1.5 text-xs"
    >
      {pending
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <RefreshCw className="h-3 w-3" />
      }
      Poll Now
    </Button>
  );
}
