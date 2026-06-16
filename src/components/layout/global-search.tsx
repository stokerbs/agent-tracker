"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  FileText,
  Loader2,
  Search,
  UserCircle,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { UserRole } from "@/lib/types";

interface Result {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: "cases" | "clients" | "agents" | "reports";
}

const MIN_CHARS = 2;

export function GlobalSearch({ role }: { role: UserRole }) {
  const t = useTranslations("search");
  const tHeader = useTranslations("header");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, startSearch] = useTransition();

  const isStaff = role === "admin" || role === "supervisor" || role === "agent";

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback(
    (q: string) => {
      if (q.length < MIN_CHARS) {
        setResults([]);
        return;
      }

      const supabase = createClient();
      const like = `%${q}%`;

      startSearch(async () => {
        const [casesRes, clientsRes, agentsRes, reportsRes] = await Promise.all([
          supabase
            .from("cases")
            .select("id, case_number, client_name, case_type, status")
            .or(`case_number.ilike.${like},client_name.ilike.${like}`)
            .limit(5),
          isStaff
            ? supabase
                .from("clients")
                .select("id, name, company, email")
                .or(`name.ilike.${like},company.ilike.${like}`)
                .limit(5)
            : Promise.resolve({ data: null }),
          isStaff
            ? supabase
                .from("agents")
                .select("id, full_name, nickname, agent_code, position")
                .or(`full_name.ilike.${like},nickname.ilike.${like},agent_code.ilike.${like}`)
                .limit(5)
            : Promise.resolve({ data: null }),
          supabase
            .from("reports")
            .select("id, title, status, case_id")
            .ilike("title", like)
            .limit(5),
        ]);

        const caseResults: Result[] = (casesRes.data ?? []).map((c) => ({
          id: c.id,
          title: c.case_number,
          subtitle: `${c.client_name ?? "—"} · ${c.case_type ?? "Surveillance"} · ${c.status}`,
          href: `/cases/${c.id}`,
          group: "cases",
        }));

        const clientResults: Result[] = (clientsRes.data ?? []).map((c) => ({
          id: (c as any).id,
          title: (c as any).name,
          subtitle: (c as any).company ?? (c as any).email ?? "—",
          href: `/clients`,
          group: "clients",
        }));

        const agentResults: Result[] = (agentsRes.data ?? []).map((a) => ({
          id: (a as any).id,
          title: (a as any).full_name,
          subtitle: [(a as any).agent_code, (a as any).nickname, (a as any).position].filter(Boolean).join(" · "),
          href: `/agents`,
          group: "agents",
        }));

        const reportResults: Result[] = (reportsRes.data ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: `${r.status} · Case ${r.case_id?.slice(0, 8) ?? "—"}`,
          href: `/reports`,
          group: "reports",
        }));

        setResults([...caseResults, ...clientResults, ...agentResults, ...reportResults]);
      });
    },
    [isStaff],
  );

  useEffect(() => {
    search(query);
  }, [query, search]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  const byGroup = {
    cases:   results.filter((r) => r.group === "cases"),
    clients: results.filter((r) => r.group === "clients"),
    agents:  results.filter((r) => r.group === "agents"),
    reports: results.filter((r) => r.group === "reports"),
  };

  const ICONS = {
    cases:   <Briefcase className="h-4 w-4 text-primary" />,
    clients: <UserCircle className="h-4 w-4 text-violet-400" />,
    agents:  <Users className="h-4 w-4 text-emerald-400" />,
    reports: <FileText className="h-4 w-4 text-amber-400" />,
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 w-52 items-center justify-between gap-2 rounded-lg border-border/60 bg-muted/30 px-3 text-xs text-muted-foreground hover:bg-muted/50 sm:flex"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          {tHeader("search")}
        </span>
        <kbd className="font-mono text-[10px] tracking-widest opacity-60">
          {tHeader("searchShortcut")}
        </kbd>
      </Button>

      {/* Mobile icon-only trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 sm:hidden"
        onClick={() => setOpen(true)}
        aria-label={tHeader("search")}
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) { setQuery(""); setResults([]); }
        }}
        title={t("title")}
      >
        <CommandInput
          placeholder={t("placeholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && query.length >= MIN_CHARS && results.length === 0 && (
            <CommandEmpty>{t("noResults")}</CommandEmpty>
          )}

          {!loading && query.length < MIN_CHARS && (
            <CommandEmpty className="py-8 text-xs">
              {t("placeholder")}
            </CommandEmpty>
          )}

          {(["cases", "clients", "agents", "reports"] as const).map((group, i) => {
            const items = byGroup[group];
            if (items.length === 0) return null;
            return (
              <span key={group}>
                {i > 0 && <CommandSeparator />}
                <CommandGroup heading={t(`groups.${group}`)}>
                  {items.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`${group}-${r.id}-${r.title}`}
                      onSelect={() => navigate(r.href)}
                      className="gap-3"
                    >
                      {ICONS[group]}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </span>
            );
          })}
        </CommandList>

        {query.length >= MIN_CHARS && !loading && (
          <div className="flex items-center justify-end gap-4 border-t px-3 py-2">
            <span className="text-[10px] text-muted-foreground">
              <kbd className="mr-1 font-mono">↵</kbd>{t("hints.navigate")}
            </span>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="mr-1 font-mono">esc</kbd>{t("hints.close")}
            </span>
          </div>
        )}
      </CommandDialog>
    </>
  );
}
