"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  FileText,
  Siren,
  UserPlus,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, timeAgo } from "@/lib/utils";
import type { Notification, NotificationType } from "@/lib/types";

const TYPE_META: Record<
  NotificationType,
  { Icon: React.ElementType; color: string; dot: string }
> = {
  emergency:  { Icon: Siren,     color: "text-destructive",       dot: "bg-destructive" },
  case:       { Icon: Briefcase, color: "text-primary",           dot: "bg-primary" },
  report:     { Icon: FileText,  color: "text-success",           dot: "bg-success" },
  assignment: { Icon: UserPlus,  color: "text-violet-400",        dot: "bg-violet-400" },
  system:     { Icon: Info,      color: "text-muted-foreground",  dot: "bg-muted-foreground" },
};

export function NotificationBell({ userId }: { userId: string }) {
  const t = useTranslations("header");
  const [items, setItems] = useState<Notification[]>([]);
  const supabase = createClient();

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notification[]) ?? []);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unread = items.filter((i) => !i.is_read).length;

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    load();
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && unread > 0 && markAllRead()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={t("notifications")}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("notifications")}</span>
          {unread > 0 && (
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {unread} unread
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("allCaughtUp")}
            </p>
          ) : (
            items.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.system;
              const { Icon } = meta;
              return (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  className={cn(
                    "flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent",
                    !n.is_read && "bg-primary/5",
                  )}
                >
                  {/* Type icon */}
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      !n.is_read ? "bg-primary/10" : "bg-muted/50",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={cn("truncate text-sm", !n.is_read && "font-semibold")}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                      )}
                    </div>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
