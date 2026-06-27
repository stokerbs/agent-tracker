"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Folder, Map as MapIcon, Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Bottom tab bar for the Federal Tactical field experience (mobile only —
 * desktop keeps the sidebar). Inherits the `.theme-tactical` tokens from the
 * field layout wrapper. Active tab matches by path prefix.
 */
export function FieldTabBar() {
  const pathname = usePathname();
  const t = useTranslations("field.tabs");

  const tabs = [
    { href: "/field", label: t("field"), icon: Radar },
    { href: "/cases", label: t("cases"), icon: Folder },
    { href: "/map", label: t("map"), icon: MapIcon },
    { href: "/emergency", label: t("alerts"), icon: Bell },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t("field")}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/field" ? pathname === "/field" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
