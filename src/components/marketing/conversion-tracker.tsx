"use client";

import { useEffect } from "react";
import { channelFromHref, track } from "@/lib/marketing/analytics";

/**
 * Site-wide conversion tracking for the marketing site. Uses one delegated,
 * capturing click listener on the document so every contact link — hero CTAs,
 * the contact section, the floating widget, article footers — is measured
 * without turning the (server-rendered) content into client components.
 *
 * Only clicks on the firm's real contact channels (LINE / WhatsApp / Facebook /
 * phone / email) fire an event; ordinary navigation is ignored. Renders nothing.
 */
export function ConversionTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const channel = channelFromHref(href);
      if (!channel) return;

      const location = anchor.closest("[data-dp-fab]")
        ? "fab"
        : anchor.closest("header")
          ? "header"
          : "page";

      track("contact_click", { channel, location, href: href ?? "" });
    }

    // Capture phase so we still record the click even if the handler/nav
    // stops propagation somewhere below.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
