"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { requestSmsOtp, type AuthState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const t = useTranslations("auth.login");
  const params = useSearchParams();
  const prefillPhone = params.get("phone") ?? "";

  const [state, action, pending] = useActionState<AuthState, FormData>(
    requestSmsOtp,
    undefined,
  );

  return (
    <form action={action} className="mt-8 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder={t("phonePlaceholder")}
          autoComplete="tel"
          defaultValue={prefillPhone}
          required
        />
        <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
      </div>

      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Smartphone className="h-4 w-4" />
        )}
        {t("sendCode")}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const t = useTranslations("auth.login");
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      <Suspense fallback={<div className="mt-8 h-32" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
