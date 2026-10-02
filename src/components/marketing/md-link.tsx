"use client";

import type { ComponentProps } from "react";
import { channelForHref } from "@/lib/marketing/contact-channel";
import { track, currentPage, langForPath } from "@/lib/marketing/analytics";

/** Anchor renderer for react-markdown: LINE / WhatsApp / tel / mailto links in
 *  article bodies fire `contact_click` (placement "inline"); other links are plain. */
type Props = Omit<ComponentProps<"a">, "href" | "onClick" | "target" | "rel" | "dangerouslySetInnerHTML"> & { href?: string };

export function MdLink({ href, children, ...rest }: Props) {
  const channel = channelForHref(href);
  const external = typeof href === "string" && /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
      onClick={channel ? () => { const page = currentPage(); track({ event: "contact_click", channel, placement: "inline", page, lang: langForPath(page) }); } : undefined}
    >
      {children}
    </a>
  );
}
