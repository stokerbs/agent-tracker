"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
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

interface UnreadCase {
  caseId: string;
  caseNumber: string;
  clientName: string | null;
  count: number;
  latestAt: string;
  latestBody: string;
}

/**
 * Global live unread-messages indicator for the staff header.
 *
 * Unread = case_messages from someone other than me, newer than my last-seen
 * (case_message_views) for that case. RLS scopes the query to my cases, so a
 * plain select returns only what I'm allowed to see. Realtime keeps it live:
 * new messages bump it up, reading a thread (a case_message_views write) bumps
 * it down.
 */
export function MessagesBell({ userId }: { userId: string }) {
  const t = useTranslations("messages");
  const supabase = createClient();
  const [groups, setGroups] = useState<UnreadCase[]>([]);

  async function load() {
    const [{ data: views }, { data: msgs }] = await Promise.all([
      supabase
        .from("case_message_views")
        .select("case_id, last_seen_at")
        .eq("profile_id", userId),
      supabase
        .from("case_messages")
        .select("id, case_id, sender_id, body, created_at, cases(case_number, client_name)")
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const seen = new Map((views ?? []).map((v) => [v.case_id, v.last_seen_at as string]));
    const map = new Map<string, UnreadCase>();

    for (const m of (msgs ?? []) as any[]) {
      const lastSeen = seen.get(m.case_id);
      const isUnread = !lastSeen || new Date(m.created_at) > new Date(lastSeen);
      if (!isUnread) continue;

      const existing = map.get(m.case_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(m.case_id, {
          caseId: m.case_id,
          caseNumber: m.cases?.case_number ?? "—",
          clientName: m.cases?.client_name ?? null,
          count: 1,
          latestAt: m.created_at,
          latestBody: m.body,
        });
      }
    }

    setGroups([...map.values()].sort((a, b) => b.latestAt.localeCompare(a.latestAt)));
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("messages-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_messages" },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "case_message_views",
          filter: `profile_id=eq.${userId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const total = groups.reduce((s, g) => s + g.count, 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={t("bell.title")}
        >
          <MessageSquare className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("bell.title")}</span>
          {total > 0 && (
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {t("bell.unreadCount", { count: total })}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
          {groups.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("bell.empty")}
            </p>
          ) : (
            groups.map((g) => (
              <Link
                key={g.caseId}
                href={`/cases/${g.caseId}?tab=messages`}
                className="flex items-start gap-3 rounded-md bg-primary/5 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{g.caseNumber}</p>
                    {g.clientName && (
                      <span className="truncate text-xs text-muted-foreground">{g.clientName}</span>
                    )}
                    <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {g.count}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{g.latestBody}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60">
                    {timeAgo(g.latestAt)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
