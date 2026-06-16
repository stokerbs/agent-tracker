"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { verifyOtp, type AuthState } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  email: string;
  next: string;
}

export function OtpVerifyForm({ email, next }: Props) {
  const t = useTranslations("auth.verify");

  const [state, action, pending] = useActionState<AuthState, FormData>(
    verifyOtp,
    undefined,
  );

  return (
    <form action={action} className="mt-8 space-y-4">
      {/* Carry email and redirect target through the form */}
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="token">{t("code")}</Label>
        <Input
          id="token"
          name="token"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder={t("codePlaceholder")}
          autoComplete="one-time-code"
          autoFocus
          required
        />
        <p className="text-xs text-muted-foreground">{t("codeHint")}</p>
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
          <ShieldCheck className="h-4 w-4" />
        )}
        {t("verify")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("noCode")}{" "}
        <Link
          href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          {t("resend")}
        </Link>
      </p>
    </form>
  );
}
