"use client";

import { useState, useTransition } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { setPin, disablePin } from "@/app/(dashboard)/settings/security-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Settings card: set / change / turn off the app-lock PIN. */
export function SetPinSection({ hasPin }: { hasPin: boolean }) {
  const t = useTranslations("lock.settings");
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [enabled, setEnabled] = useState(hasPin);
  const [pending, start] = useTransition();

  function save() {
    if (!/^\d{4,6}$/.test(pin)) return toast.error(t("invalid"));
    if (pin !== confirm) return toast.error(t("mismatch"));
    start(async () => {
      const res = await setPin(pin);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("saved"));
      setPinValue(""); setConfirm(""); setEnabled(true);
    });
  }

  function turnOff() {
    start(async () => {
      const res = await disablePin();
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(t("disabled"));
      setEnabled(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {enabled ? t("descriptionOn") : t("descriptionOff")}
        </p>
        <div className="grid max-w-xs gap-3">
          <div className="space-y-1">
            <Label htmlFor="pin" className="text-xs text-muted-foreground">{enabled ? t("newPin") : t("pin")}</Label>
            <Input id="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6}
              value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm" className="text-xs text-muted-foreground">{t("confirm")}</Label>
            <Input id="confirm" type="password" inputMode="numeric" autoComplete="off" maxLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} disabled={pending} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending || !pin} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {enabled ? t("change") : t("enable")}
          </Button>
          {enabled && (
            <Button variant="outline" onClick={turnOff} disabled={pending} className="text-destructive">
              {t("turnOff")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
