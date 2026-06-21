"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Clock, Images, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Props {
  counts: {
    timeline: number;
    evidence: number;
    messagesUnread: number;
  };
  staff: boolean;
}

type BadgeKind = "count" | "alert";

/**
 * Mobile-only bottom navigation for the case workspace.
 *
 * Replaces the overflowing top tab strip on phones. Renders raw Radix tab
 * triggers so it drives the SAME <Tabs> as the desktop top tabs (it must be
 * mounted inside the case page's <Tabs>). Timeline is centred as the default /
 * most-used module; Messages carries a red alert badge, Timeline/Evidence carry
 * muted content-count badges. Hidden at md+ where the top tabs take over.
 */
export function CaseBottomNav({ counts, staff: _staff }: Props) {
  const tCase = useTranslations("cases.detail");
  const tMsgs = useTranslations("messages");

  // Portal to <body> so position:fixed anchors to the viewport, not the
  // transform-animated (FadeUp) ancestor. The portal preserves the Radix Tabs
  // React context, so triggers still drive the same <Tabs>.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items: Array<{
    value: string;
    label: string;
    Icon: typeof Clock;
    badge?: { n: number; kind: BadgeKind };
  }> = [
    { value: "evidence", label: tCase("tabs.evidence"), Icon: Images,
      badge: counts.evidence > 0 ? { n: counts.evidence, kind: "count" } : undefined },
    { value: "timeline", label: tCase("tabs.timeline"), Icon: Clock,
      badge: counts.timeline > 0 ? { n: counts.timeline, kind: "count" } : undefined },
    { value: "messages", label: tMsgs("tab"), Icon: MessageSquare,
      badge: counts.messagesUnread > 0 ? { n: counts.messagesUnread, kind: "alert" } : undefined },
  ];

  if (!mounted) return null;

  return createPortal(
    <TabsPrimitive.List
      aria-label="Case modules"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid border-t border-border/60 bg-background/85 backdrop-blur-md md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
        "grid-cols-3",
      )}
    >
      {items.map(({ value, label, Icon, badge }) => (
        <TabsPrimitive.Trigger
          key={value}
          value={value}
          className="group relative flex flex-col items-center justify-center gap-1 py-2 outline-none focus-visible:bg-primary/5"
        >
          {/* top accent indicator (active only) */}
          <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary opacity-0 transition-opacity group-data-[state=active]:opacity-100" />

          {/* icon capsule */}
          <span className="relative flex h-8 w-12 items-center justify-center rounded-xl transition-colors group-data-[state=active]:bg-primary/12">
            <Icon
              className="h-[22px] w-[22px] text-muted-foreground/80 transition-colors group-data-[state=active]:text-primary"
              strokeWidth={2}
            />
            {badge && (
              <span
                className={cn(
                  "absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ring-2 ring-background",
                  badge.kind === "alert"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted font-semibold text-muted-foreground",
                )}
              >
                {badge.kind === "alert"
                  ? badge.n > 9 ? "9+" : badge.n
                  : badge.n > 99 ? "99+" : badge.n}
              </span>
            )}
          </span>

          {/* label */}
          <span className="max-w-full truncate px-0.5 text-[10px] leading-[1.35] text-muted-foreground/80 transition-colors group-data-[state=active]:font-semibold group-data-[state=active]:text-primary">
            {label}
          </span>
        </TabsPrimitive.Trigger>
      ))}
    </TabsPrimitive.List>,
    document.body,
  );
}
