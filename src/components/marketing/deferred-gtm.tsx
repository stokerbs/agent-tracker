"use client";

import { GoogleTagManager } from "@next/third-parties/google";
import { useEffect, useState } from "react";

/**
 * Loads Google Tag Manager only *after* the first user interaction (or a short
 * idle fallback), instead of during the initial page load.
 *
 * GTM + the GA4/Ads tags it fires cost ~800ms of main-thread blocking (TBT) if
 * loaded eagerly, which tanks the mobile performance score and delays the hero.
 * Deferring keeps analytics intact — dataLayer.push() calls (pageview,
 * lead_submitted, etc.) queue on window.dataLayer before GTM loads and are
 * replayed once it initialises — while removing GTM from the critical path.
 *
 * The idle fallback guarantees visitors who never interact (and most bots) are
 * still counted; the pageview timestamp is just shifted by a few seconds.
 */
export function DeferredGTM({ gtmId }: { gtmId: string }) {
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (load) return;
    const trigger = () => setLoad(true);
    const events = ["scroll", "pointerdown", "keydown", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, trigger, { once: true, passive: true }));
    // Fallback so idle users / crawlers still register a pageview.
    const idle = window.setTimeout(trigger, 3500);
    return () => {
      events.forEach((e) => window.removeEventListener(e, trigger));
      window.clearTimeout(idle);
    };
  }, [load]);

  return load ? <GoogleTagManager gtmId={gtmId} /> : null;
}
