"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ShieldCheck, Delete, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { verifyPin } from "@/app/(dashboard)/settings/security-actions";
import { signOut } from "@/app/(auth)/actions";
import { isNative } from "@/lib/native";
import { cn } from "@/lib/utils";

const UNLOCK_KEY = "dp_app_unlocked";
const INACTIVITY_MS = 5 * 60 * 1000; // re-lock after 5 min backgrounded

/**
 * App-lock gate. When the user has a PIN set, the app is locked on cold start
 * and after the app has been backgrounded for a while. The session itself stays
 * valid (persistent cookies), so unlocking needs only the PIN — no fresh OTP.
 */
export function AppLockProvider({ hasPin, children }: { hasPin: boolean; children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const bgAt = useRef<number | null>(null);

  useEffect(() => {
    if (!hasPin) return;
    setLocked(sessionStorage.getItem(UNLOCK_KEY) !== "1");
  }, [hasPin]);

  useEffect(() => {
    if (!hasPin) return;
    const onHidden = () => { bgAt.current = Date.now(); };
    const onVisible = () => {
      if (bgAt.current && Date.now() - bgAt.current > INACTIVITY_MS) {
        sessionStorage.removeItem(UNLOCK_KEY);
        setLocked(true);
      }
      bgAt.current = null;
    };
    const onVis = () => (document.visibilityState === "hidden" ? onHidden() : onVisible());
    document.addEventListener("visibilitychange", onVis);

    let remove: (() => void) | undefined;
    if (isNative()) {
      import("@capacitor/app")
        .then(({ App }) =>
          App.addListener("appStateChange", ({ isActive }) => (isActive ? onVisible() : onHidden())).then(
            (handle) => { remove = () => handle.remove(); },
          ),
        )
        .catch(() => {});
    }
    return () => { document.removeEventListener("visibilitychange", onVis); remove?.(); };
  }, [hasPin]);

  if (!hasPin || !locked) return <>{children}</>;
  return (
    <PinLockOverlay
      onUnlock={() => {
        sessionStorage.setItem(UNLOCK_KEY, "1");
        setLocked(false);
      }}
    />
  );
}

function PinLockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const t = useTranslations("lock");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(value: string) {
    start(async () => {
      const res = await verifyPin(value);
      if ("ok" in res) { onUnlock(); return; }
      setPin("");
      setError(res.error);
      if (res.locked) await signOut();
    });
  }

  function press(d: string) {
    if (pending) return;
    setError("");
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length === 6) submit(next);
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="text-base font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex items-center gap-3" aria-label={t("title")}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-3 rounded-full border transition-colors",
              i < pin.length ? "border-primary bg-primary" : "border-muted-foreground/40",
            )}
          />
        ))}
      </div>

      <div className="h-5 text-sm text-destructive">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : error}</div>

      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            disabled={pending}
            className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-xl font-medium hover:bg-accent active:scale-95 disabled:opacity-50"
          >
            {k}
          </button>
        ))}
        <div />
        <button
          onClick={() => press("0")}
          disabled={pending}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-xl font-medium hover:bg-accent active:scale-95 disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={() => { setPin((p) => p.slice(0, -1)); setError(""); }}
          disabled={pending || pin.length === 0}
          aria-label={t("delete")}
          className="flex h-16 w-16 items-center justify-center rounded-full text-muted-foreground hover:bg-accent active:scale-95 disabled:opacity-30"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>

      <button onClick={() => signOut()} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
        {t("useCode")}
      </button>
    </div>
  );
}
