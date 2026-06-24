"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/native";

/**
 * Hides the native splash screen on first mount, on ANY route.
 *
 * The Capacitor config sets `launchAutoHide: false`, so the native splash
 * stays up until JS calls SplashScreen.hide(). The heavier native setup in
 * NativeBootstrap only mounts inside the (dashboard) layout — so when the app
 * boots unauthenticated into /field and is redirected to /login (auth group),
 * the splash would otherwise never hide and cover the fully-loaded login page.
 *
 * Mounted in the root layout, this guarantees the splash is dismissed
 * regardless of which route renders first. hide() is idempotent, so it's safe
 * for NativeBootstrap to also call it once the dashboard loads. No-ops on web.
 */
export function SplashGate() {
  useEffect(() => {
    if (!isNative()) return;
    (async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        // splash-screen plugin optional
      }
    })();
  }, []);

  return null;
}
