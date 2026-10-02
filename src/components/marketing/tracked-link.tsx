"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { channelForHref, type ContactChannel } from "@/lib/marketing/contact-channel";
import { track, currentPage, langForPath, type ContactPlacement } from "@/lib/marketing/analytics";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick" | "target" | "rel" | "dangerouslySetInnerHTML"> & {
  href: string;
  /** Where on the page this CTA sits — the GA4 dimension that tells us which
   *  placements actually produce LINE / WhatsApp / phone contacts. */
  placement: ContactPlacement;
  /** Override the channel inferred from the href. */
  channel?: ContactChannel;
  /** Open in a new tab with safe rel. Defaults to true for http(s) links. */
  external?: boolean;
  children: ReactNode;
};

/**
 * Anchor that fires `contact_click` for LINE / WhatsApp / phone / email /
 * Facebook / WeChat hrefs (inferred via channelForHref). Non-contact hrefs
 * (e.g. "#contact") render a plain anchor and fire nothing. Safe to use from
 * server components (this is the client island).
 */
export function TrackedLink({ href, placement, channel, external, children, ...rest }: Props) {
  const resolved = channel ?? channelForHref(href);
  const isHttp = /^(https?:)?\/\//i.test(href);
  const openExternal = external ?? isHttp;
  return (
    <a
      href={href}
      {...(openExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
      onClick={() => {
        if (!resolved) return;
        const page = currentPage();
        track({ event: "contact_click", channel: resolved, placement, page, lang: langForPath(page) });
      }}
    >
      {children}
    </a>
  );
}
