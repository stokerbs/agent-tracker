"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (public/sw.js). The SW serves a cached
 * offline screen when a navigation fails with no connection — so the field app
 * shows something useful instead of a blank WebView in dead-signal areas.
 * No-op where service workers are unsupported.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
