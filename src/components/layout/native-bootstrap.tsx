"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { isNative } from "@/lib/native";
import { registerDeviceToken, issueGpsToken } from "@/app/(dashboard)/field/actions";

/** Navigate to an internal app path; missing/unknown/external → field dashboard. */
function navigateInApp(url: unknown): void {
  if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
    window.location.assign(url);
  } else {
    window.location.assign("/field");
  }
}

/**
 * Invisible client component that runs native-only setup once the app has
 * loaded inside the Capacitor shell: registers for push notifications and
 * persists the device token, and routes notification taps to their link.
 * No-ops on the web.
 */
export function NativeBootstrap() {
  useEffect(() => {
    if (!isNative()) return;
    let cleanupPush: (() => void) | undefined;
    let stopGps: (() => void) | undefined;
    let backHandle: { remove: () => void } | undefined;
    let recvHandle: { remove: () => void } | undefined;
    let cancelled = false;

    // Flag for native-only CSS (safe-area, no text-selection / overscroll).
    document.documentElement.classList.add("capacitor-native");

    (async () => {
      // ── Make the WebView feel native: status bar below content, hide splash,
      //    hardware back button navigates in-app instead of closing. ──
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: false }); // don't underlap notch
        await StatusBar.setBackgroundColor({ color: "#0b0f14" }).catch(() => {}); // Android
      } catch {
        // status-bar plugin optional
      }

      const { App } = await import("@capacitor/app");
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        // splash-screen plugin optional
      }
      // Android hardware back: go back in history, or background the app at the root.
      backHandle = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && window.history.length > 1) window.history.back();
        else void App.minimizeApp();
      });
      if (cancelled) backHandle.remove();

      // Background GPS: mint a bearer token, then start the background watcher
      // (covers foreground + background; posts to /api/agents/location).
      try {
        const res = await issueGpsToken();
        if (!cancelled && "token" in res) {
          const { startBackgroundGps } = await import("@/lib/native/native-bg-geo");
          const stop = await startBackgroundGps(res.token);
          if (cancelled) stop();
          else stopGps = stop;
        }
      } catch {
        // GPS optional — continue with push setup.
      }

      // Push registration → persist token server-side.
      const { initPushNotifications } = await import("@/lib/native/native-push");
      const cleanup = await initPushNotifications((token, platform) => {
        void registerDeviceToken(token, platform);
      });
      if (cancelled) cleanup();
      else cleanupPush = cleanup;

      // Push tap (background / terminated) → deep-link into the app.
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const tapHandle = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const data = action.notification?.data ?? {};
          navigateInApp(data.url ?? data.link);
        },
      );
      if (cancelled) void tapHandle.remove();

      // Push received while the app is in foreground → in-app toast instead of a
      // duplicate system banner (presentationOptions drops "alert"). "View" deep-links.
      recvHandle = await PushNotifications.addListener("pushNotificationReceived", (notif) => {
        const url = notif.data?.url ?? notif.data?.link;
        toast(notif.title ?? "Notification", {
          description: notif.body || undefined,
          action:
            typeof url === "string" && url.startsWith("/")
              ? { label: "View", onClick: () => navigateInApp(url) }
              : undefined,
        });
      });
      if (cancelled) recvHandle.remove();
    })();

    return () => {
      cancelled = true;
      cleanupPush?.();
      stopGps?.();
      backHandle?.remove();
      recvHandle?.remove();
    };
  }, []);

  return null;
}
