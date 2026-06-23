import { Capacitor } from "@capacitor/core";

/**
 * True when running inside the Capacitor native shell (iOS/Android app),
 * false in a normal web browser. All native-only code paths must be guarded
 * by this so the web build/runtime is unaffected.
 */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** "ios" | "android" | "web" */
export function nativePlatform(): string {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}
