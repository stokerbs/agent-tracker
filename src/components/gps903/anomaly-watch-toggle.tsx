"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { setAnomalyWatch } from "@/app/(dashboard)/gps-devices/actions";
import { Button } from "@/components/ui/button";

interface Props {
  deviceId: string;
  enabled: boolean;
}

/**
 * Toggle proactive AI anomaly alerts for one device. Optimistic, reverts on
 * error. Admin/supervisor-gated server-side by the setAnomalyWatch action.
 */
export function AnomalyWatchToggle({ deviceId, enabled }: Props) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      const res = await setAnomalyWatch(deviceId, next);
      if (res?.error) {
        setOn(!next); // revert
        toast.error(res.error);
        return;
      }
      toast.success(next ? "เปิดการเฝ้าระวังความผิดปกติ" : "ปิดการเฝ้าระวังความผิดปกติ");
      router.refresh();
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={pending}
      className="h-7 gap-1.5 text-xs"
      title={on ? "AI แจ้งเตือนความผิดปกติของอุปกรณ์นี้ (กดเพื่อปิด)" : "ปิดการแจ้งเตือนอยู่ (กดเพื่อเปิด)"}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : on ? (
        <ShieldAlert className="h-3 w-3 text-primary" />
      ) : (
        <ShieldOff className="h-3 w-3 text-muted-foreground" />
      )}
      {on ? "เฝ้าระวัง: เปิด" : "เฝ้าระวัง: ปิด"}
    </Button>
  );
}
