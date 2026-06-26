import { PushNotifications, type Token } from "@capacitor/push-notifications";
import { nativePlatform } from "./index";
import { logNativePushEvent } from "@/app/(dashboard)/field/actions";

/**
 * Register for native push notifications and hand the resulting device token to
 * `onToken` (which persists it server-side). Phase A only registers + stores the
 * token; actual push delivery (FCM/APNs) is wired in Phase B. Native only.
 *
 * Returns a cleanup function that removes the listeners.
 */
export async function initPushNotifications(
  onToken: (token: string, platform: string) => void,
): Promise<() => void> {
  try {
    void logNativePushEvent("init");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    void logNativePushEvent("permission", perm.receive);
    if (perm.receive !== "granted") {
      void logNativePushEvent("aborted", "permission not granted");
      return () => {};
    }

    const handles = await Promise.all([
      PushNotifications.addListener("registration", (token: Token) => {
        // Token VALUE is never logged — length only.
        void logNativePushEvent("registration", token?.value ? `tokenLen=${token.value.length}` : "no-value");
        if (token?.value) onToken(token.value, nativePlatform());
      }),
      PushNotifications.addListener("registrationError", (err) => {
        console.error("[push] registration error", err);
        void logNativePushEvent("registrationError", err?.error ?? JSON.stringify(err));
      }),
    ]);

    void logNativePushEvent("register:calling");
    await PushNotifications.register();
    void logNativePushEvent("register:returned");

    return () => {
      for (const h of handles) void h.remove().catch(() => {});
    };
  } catch (err) {
    console.error("[push] init failed", err);
    void logNativePushEvent("init-failed", err instanceof Error ? err.message : String(err));
    return () => {};
  }
}
