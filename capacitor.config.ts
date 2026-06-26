import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config for the Detective Pulse Field Agent app.
 *
 * Remote-URL mode: the native shell loads the live Next.js site in the system
 * WebView and boots into the Field Agent experience (/field). The app is SSR
 * (server actions, force-dynamic) so it can't be statically exported — instead
 * the hosted site is loaded directly and native plugins (camera, geolocation,
 * push) bridge into the page. Cookie-based Supabase auth works unchanged.
 *
 * Override the loaded host for local dev by setting CAP_SERVER_URL, e.g.
 *   CAP_SERVER_URL=http://192.168.1.20:3000/field npx cap sync
 */
const SERVER_URL = process.env.CAP_SERVER_URL ?? "https://detectivepulse.app/field";

const config: CapacitorConfig = {
  appId: "app.detectivepulse.field",
  appName: "Detective Pulse Field",
  // webDir is required by the CLI but unused in server.url mode; a tiny shell
  // page lives here as a fallback if the remote URL is unreachable.
  webDir: "capacitor-shell",
  server: {
    url: SERVER_URL,
    cleartext: SERVER_URL.startsWith("http://"),
    // Keep navigations to our own host inside the app; everything else (social
    // links, tel:, mailto:) opens in the system browser.
    allowNavigation: ["detectivepulse.app", "*.supabase.co"],
  },
  ios: {
    contentInset: "always",
  },
  android: {
    // Allow the WebView to use mixed content only when explicitly on cleartext dev.
    allowMixedContent: SERVER_URL.startsWith("http://"),
  },
  plugins: {
    SplashScreen: {
      // Keep the splash up until the web app mounts and calls hide()
      // (NativeBootstrap) — avoids a white flash while the remote URL loads.
      launchAutoHide: false,
      backgroundColor: "#0b0f14",
      showSpinner: false,
    },
    PushNotifications: {
      // No foreground "alert" banner — when the app is open we show an in-app
      // toast instead (NativeBootstrap) to avoid a duplicate system banner.
      // Background/terminated notifications are presented by iOS regardless.
      presentationOptions: ["badge", "sound"],
    },
  },
};

export default config;
