"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { requestPortalOtp, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PortalLoginForm() {
  const t = useTranslations("auth.login");
  const tPortal = useTranslations("portal");
  const params = useSearchParams();
  const prefillPhone = params.get("phone") ?? "";

  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestPortalOtp,
    undefined,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {tPortal("login.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{tPortal("login.subtitle")}</p>
      </div>

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={t("phonePlaceholder")}
            autoComplete="tel"
            autoFocus
            defaultValue={prefillPhone}
            required
          />
          <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
        </div>

        {state?.error && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Smartphone className="h-4 w-4" />
          )}
          {tPortal("login.sendCode")}
        </Button>
      </form>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/30" />}>
      <PortalLoginForm />
    </Suspense>
  );
}
