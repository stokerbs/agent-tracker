"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Radio, SendHorizonal } from "lucide-react";
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
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-[0_0_32px_hsl(var(--primary)/0.18)]">
          <Radio className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Form */}
      <form action={action} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            {t("phone")}
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder={t("phonePlaceholder")}
            autoComplete="tel"
            autoFocus
            defaultValue={prefillPhone}
            required
            className="h-11 text-base transition-shadow focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
          />
          <p className="text-xs text-muted-foreground">{t("phoneHint")}</p>
        </div>

        <AnimatePresence mode="wait">
          {state?.error && (
            <motion.p
              key={state.error}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {state.error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          className="w-full h-11 gap-2 text-sm font-semibold"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <SendHorizonal className="h-4 w-4" />
              {t("sendCode")}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/30" />}>
      <LoginForm />
    </Suspense>
  );
}
