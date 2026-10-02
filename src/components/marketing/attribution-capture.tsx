"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/marketing/attribution";

/** Mounted once in the marketing chrome: records first-touch attribution
 *  (landing page, referrer, utm_*, gclid) so lead writes can carry it. */
export function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
