"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Lock, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { verifyOtp } from "../../actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  phone: string;
  next: string;
}

const DIGITS = 6;
const RESEND_SECONDS = 300;

export function OtpVerifyForm({ phone, next }: Props) {
  const t = useTranslations("auth.verify");
  const [isPending, startTransition] = useTransition();

  const [digits, setDigits] = useState<string[]>(Array(DIGITS).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(DIGITS).fill(null));
  const submittedRef = useRef(false);

  const token = digits.join("");
  const isComplete = digits.every((d) => d !== "");

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (isComplete && !isPending && !submittedRef.current) {
      submittedRef.current = true;
      doSubmit(token);
    }
    if (!isComplete) submittedRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  function doSubmit(tok: string) {
    setError(null);
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("next", next);
    fd.set("token", tok);
    startTransition(async () => {
      const result = await verifyOtp(undefined, fd);
      if (result?.error) {
        setError(result.error);
        submittedRef.current = false;
        setShaking(true);
        setTimeout(() => {
          setShaking(false);
          setDigits(Array(DIGITS).fill(""));
          inputRefs.current[0]?.focus();
        }, 450);
      }
    });
  }

  function handleChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      const next = [...digits];
      next[idx] = "";
      setDigits(next);
      return;
    }
    const digit = raw[raw.length - 1];
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (error) setError(null);
    if (idx < DIGITS - 1) inputRefs.current[idx + 1]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = "";
        setDigits(next);
      } else if (idx > 0) {
        const next = [...digits];
        next[idx - 1] = "";
        setDigits(next);
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < DIGITS - 1) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
    } else if (e.key === "Enter" && isComplete && !isPending) {
      doSubmit(token);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGITS);
    if (!pasted) return;
    const next = Array(DIGITS).fill("").map((_, i) => pasted[i] ?? "");
    setDigits(next);
    if (error) setError(null);
    inputRefs.current[Math.min(pasted.length, DIGITS) - 1]?.focus();
  }

  function fmtCountdown(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  const hasError = !!error;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-[0_0_32px_hsl(var(--primary)/0.18)]">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("sentTo")}</p>
        {phone && (
          <p className="mt-1 font-mono font-semibold text-foreground">{phone}</p>
        )}
      </div>

      {/* OTP boxes */}
      <div className="space-y-3">
        <motion.div
          className="flex justify-center gap-2 sm:gap-3"
          animate={shaking ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {digits.map((d, i) => (
            <motion.div
              key={i}
              animate={d && !hasError ? { scale: [1.14, 1] } : {}}
              transition={{ duration: 0.12, ease: "easeOut" }}
            >
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={2}
                value={d}
                onChange={(e) => handleChange(i, e)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                disabled={isPending}
                aria-label={`Digit ${i + 1} of ${DIGITS}`}
                className={cn(
                  "h-14 w-11 rounded-xl border-2 text-center text-xl font-bold tabular-nums",
                  "bg-muted/40 text-foreground caret-transparent",
                  "outline-none transition-all duration-200",
                  "sm:h-16 sm:w-12 sm:text-2xl",
                  "disabled:opacity-50",
                  hasError
                    ? "border-destructive bg-destructive/5 shadow-[0_0_0_3px_hsl(var(--destructive)/0.12)]"
                    : d
                    ? "border-primary/60 bg-background focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
                    : "border-border focus:border-primary focus:bg-background focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]",
                )}
              />
            </motion.div>
          ))}
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">{t("codeHint")}</p>
      </div>

      {/* Error */}
      <AnimatePresence mode="wait">
        {hasError && (
          <motion.div
            key={error}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="space-y-4">
        <Button
          type="button"
          className="w-full h-11 gap-2 text-sm font-semibold"
          disabled={!isComplete || isPending}
          onClick={() => isComplete && !isPending && doSubmit(token)}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              {t("verify")}
            </>
          )}
        </Button>

        {/* Resend row */}
        <div className="flex items-center justify-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{t("noCode")}</span>
          {countdown > 0 ? (
            <span className="font-mono font-semibold tabular-nums text-primary">
              {fmtCountdown(countdown)}
            </span>
          ) : (
            <a
              href={`/login${phone ? `?phone=${encodeURIComponent(phone)}` : ""}`}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("resend")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
