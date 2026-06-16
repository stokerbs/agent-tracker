"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { navForRole } from "./nav-config";
import { NavIcon } from "./icon";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const sections = navForRole(role);
  const tNav = useTranslations("nav");
  const tMeta = useTranslations("meta");

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="group flex items-center gap-3 border-b border-border/60 px-4 py-4 transition-opacity hover:opacity-90"
      >
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
          <Radio className="h-4 w-4 text-primary" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-card" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight leading-none">
            {tMeta("appName")}
          </p>
          <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
            {tMeta("subtitle")}
          </p>
        </div>
        <Zap className="ml-auto h-3 w-3 shrink-0 text-primary/50 group-hover:text-primary transition-colors" />
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.sectionKey} className="mb-4">
            <p className="mb-1 px-4 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
              {tNav(`sections.${section.sectionKey}`)}
            </p>
            <div className="space-y-px px-2">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-150",
                      active
                        ? "nav-item-active bg-primary/8 font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-indicator"
                        className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-primary"
                        transition={{ type: "spring", stiffness: 400, damping: 35 }}
                      />
                    )}
                    <NavIcon
                      name={item.icon}
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground/70",
                      )}
                    />
                    <span className="truncate">{tNav(`items.${item.labelKey}`)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer status */}
      <div className="border-t border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          <span className="font-mono uppercase tracking-wider">{tNav("systemNominal")}</span>
        </div>
      </div>
    </div>
  );
}
