"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  acknowledgeAlert,
  resolveAlert,
} from "@/app/(dashboard)/emergency/actions";
import { Button } from "@/components/ui/button";
import type { AlertStatus } from "@/lib/types";

export function AlertActions({
  alertId,
  status,
}: {
  alertId: string;
  status: AlertStatus;
}) {
  const t = useTranslations("emergency.alert");
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ error?: string } | { ok: boolean }>) {
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) { toast.error(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {status === "active" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => acknowledgeAlert(alertId))}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("acknowledge")}
        </Button>
      )}
      {status !== "resolved" && (
        <Button
          size="sm"
          variant="success"
          onClick={() => run(() => resolveAlert(alertId))}
          disabled={pending}
        >
          <CheckCheck className="h-4 w-4" /> {t("resolve")}
        </Button>
      )}
    </div>
  );
}
