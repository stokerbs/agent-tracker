"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/native";
import { registerDeviceToken } from "@/app/(dashboard)/field/actions";

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
    let cancelled = false;

    (async () => {
      // Push registration → persist token server-side.
      const { initPushNotifications } = await import("@/lib/native/native-push");
      const cleanup = await initPushNotifications((token, platform) => {
        void registerDeviceToken(token, platform);
      });
      if (cancelled) cleanup();
      else cleanupPush = cleanup;

      // Route notification taps to the in-app link.
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const tapHandle = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const link = action.notification?.data?.link;
          if (typeof link === "string" && link.startsWith("/")) {
            window.location.assign(link);
          }
        },
      );
      if (cancelled) void tapHandle.remove();

      // Native status-bar styling to match the dark app shell.
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // status-bar plugin optional
      }
    })();

    return () => {
      cancelled = true;
      cleanupPush?.();
    };
  }, []);

  return null;
}
