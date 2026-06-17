"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Settings, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { signOut } from "@/app/(auth)/actions";
import { SidebarNav } from "./sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_META } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const PAGE_KEYS: Record<string, string> = {
  "/dashboard": "dashboard",
  "/map": "map",
  "/analytics": "analytics",
  "/cases": "cases",
  "/timeline": "timeline",
  "/agents": "agents",
  "/evidence": "evidence",
  "/reports": "reports",
  "/expenses": "expenses",
  "/emergency": "emergency",
  "/clients": "clients",
  "/users": "users",
  "/audit": "audit",
  "/settings": "settings",
};

function Breadcrumb() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const parts = pathname.split("/").filter(Boolean);
  const topLevel = "/" + (parts[0] ?? "");
  const navKey = PAGE_KEYS[topLevel];

  const navLabels: Record<string, string> = {
    dashboard: tNav("items.dashboard"),
    map: tNav("items.map"),
    analytics: tNav("items.analytics"),
    cases: tNav("items.cases"),
    timeline: tNav("items.timeline"),
    agents: tNav("items.agents"),
    evidence: tNav("items.evidence"),
    reports: tNav("items.reports"),
    expenses: tNav("items.expenses"),
    emergency: tNav("items.emergency"),
    clients: tNav("items.clients"),
    users: tNav("items.users"),
    audit: tNav("items.audit"),
    settings: tNav("items.settings"),
  };

  const label = (navKey ? navLabels[navKey] : null) ?? parts[0] ?? "";

  return (
    <div className="hidden items-center gap-1.5 text-sm lg:flex">
      <span className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground/50">
        {tNav("opsPrefix")}
      </span>
      <span className="text-muted-foreground/30">/</span>
      <span className="font-medium text-foreground/90">{label}</span>
      {parts.length > 1 && (
        <>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {parts[1]}
          </span>
        </>
      )}
    </div>
  );
}

export function Header({ profile }: { profile: Profile }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleMeta = ROLE_META[profile.role];
  const t = useTranslations("header");
  const tNav = useTranslations("nav");
  const tUsers = useTranslations("users.roles");
  const tAuth = useTranslations("auth");

  const roleLabel = tUsers(profile.role);

  return (
    <header className="sticky top-0 z-30 flex h-13 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      {/* Mobile menu */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="left-0 top-0 h-full max-w-[15rem] translate-x-0 translate-y-0 rounded-none border-r p-0 sm:rounded-none">
          <DialogTitle className="sr-only">{t("navigation")}</DialogTitle>
          <SidebarNav role={profile.role} onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>

      <Breadcrumb />

      <div className="flex-1" />

      <GlobalSearch role={profile.role} />

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <NotificationBell userId={profile.id} />
        <LanguageSwitcher />
        <ThemeToggle />

        <div className="ml-1 h-5 w-px bg-border/60" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Avatar className="h-7 w-7 ring-1 ring-border">
                {profile.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ""} />
                )}
                <AvatarFallback className="text-xs">{initials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-xs font-medium leading-none">{profile.full_name?.split(" ")[0]}</span>
                <span
                  className={cn(
                    "mt-0.5 text-[9px] font-semibold uppercase tracking-wider",
                    roleMeta.badge.includes("blue") ? "text-blue-400" :
                    roleMeta.badge.includes("violet") ? "text-violet-400" :
                    roleMeta.badge.includes("emerald") ? "text-emerald-400" :
                    "text-amber-400",
                  )}
                >
                  {roleLabel}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="pb-2">
              <p className="text-sm font-medium leading-none">{profile.full_name}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {profile.email ?? profile.phone}
              </p>
              <Badge className={`mt-2 text-xs ${roleMeta.badge}`}>{roleLabel}</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="gap-2">
                <UserIcon className="h-3.5 w-3.5" /> {t("profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="gap-2">
                <Settings className="h-3.5 w-3.5" /> {tNav("items.settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOut} className="w-full">
                <button type="submit" className="flex w-full items-center gap-2 text-destructive">
                  <LogOut className="h-3.5 w-3.5" /> {tAuth("signOut")}
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
