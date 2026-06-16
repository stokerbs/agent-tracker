"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";
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
    <div className="flex h-full flex-col gap-1">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-3 py-4 font-semibold"
        onClick={onNavigate}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Radio className="h-5 w-5" />
        </div>
        <span className="leading-tight">
          {tMeta("appName")}
          <span className="block text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
            {tMeta("subtitle")}
          </span>
        </span>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-2 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.sectionKey}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tNav(`sections.${section.sectionKey}`)}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
                    {tNav(`items.${item.labelKey}`)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
