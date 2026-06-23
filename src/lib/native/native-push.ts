import { PushNotifications, type Token } from "@capacitor/push-notifications";
import { nativePlatform } from "./index";

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
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return () => {};

    const handles = await Promise.all([
      PushNotifications.addListener("registration", (token: Token) => {
        if (token?.value) onToken(token.value, nativePlatform());
      }),
      PushNotifications.addListener("registrationError", (err) => {
        console.error("[push] registration error", err);
      }),
    ]);

    await PushNotifications.register();

    return () => {
      for (const h of handles) void h.remove().catch(() => {});
    };
  } catch (err) {
    console.error("[push] init failed", err);
    return () => {};
  }
}
