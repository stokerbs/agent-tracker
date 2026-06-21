"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** When set, listens for a `case:openSection` CustomEvent with matching detail.section and auto-opens + scrolls into view. */
  triggerId?: string;
}

/**
 * Card that collapses on mobile (< md) and is always expanded on desktop.
 *
 * Uses the CSS grid-rows 0fr→1fr trick for smooth height animation without
 * needing to know the content height. The desktop override (md:grid-rows-[1fr])
 * wins over the JS-controlled class because Tailwind outputs responsive
 * variants after base utilities in the stylesheet, so no !important is needed.
 */
export function CollapsibleCard({
  title,
  icon,
  count,
  defaultOpen = false,
  headerAction,
  children,
  className,
  triggerId,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerId) return;
    function onOpenSection(e: Event) {
      const section = (e as CustomEvent<{ section: string }>).detail?.section;
      if (section !== triggerId) return;
      setOpen(true);
      // Small delay so the grid-rows animation has a frame to start before scroll
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
    document.addEventListener("case:openSection", onOpenSection);
    return () => document.removeEventListener("case:openSection", onOpenSection);
  }, [triggerId]);

  return (
    <div ref={cardRef} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}>
      {/* Header row — button drives mobile toggle, non-interactive on desktop */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            "flex flex-1 items-center gap-2 px-4 py-3 text-left",
            "text-sm font-semibold leading-none tracking-tight",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-tl-lg",
            // Desktop: looks like a regular CardHeader, not interactive
            "md:cursor-default md:pointer-events-none md:px-6 md:py-4 md:text-base",
          )}
        >
          {icon && (
            <span className="shrink-0 text-muted-foreground">{icon}</span>
          )}
          <span className="flex-1">{title}</span>
          {count != null && (
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              ({count})
            </span>
          )}
          <ChevronDown
            className={cn(
              "ml-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 md:hidden",
              open && "rotate-180",
            )}
          />
        </button>

        {/* Optional right-side action (e.g. import button in GPS header) */}
        {headerAction && (
          <div className="shrink-0 pr-3 md:pr-4">{headerAction}</div>
        )}
      </div>

      {/* Animated content via grid-rows 0fr→1fr. md always open. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          "md:grid-rows-[1fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 pt-0 md:px-6 md:pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
