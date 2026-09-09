"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Briefcase,
  Clapperboard,
  FileText,
  FolderSearch,
  Lightbulb,
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
  group: "cases" | "clients" | "agents" | "reports" | "studioContent" | "studioIdeas" | "studioKnowledge" | "studioCases";
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
  const isAdmin = role === "admin"; // clients are admin-only (RLS) — see migration 0088
  const isOpsStaff = role === "admin" || role === "supervisor"; // /reports redirects agents

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
      // Strip PostgREST filter syntax so user input can't break/extend .or() clauses.
      const like = `%${q.replace(/[,()%\\"']/g, " ").trim()}%`;

      startSearch(async () => {
        const [casesRes, clientsRes, agentsRes, reportsRes, sContentRes, sIdeasRes, sKnowledgeRes, sCasesRes] = await Promise.all([
          supabase
            .from("cases")
            .select("id, case_number, client_name, case_type, status")
            .or(`case_number.ilike.${like},client_name.ilike.${like}`)
            .limit(5),
          isAdmin
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
          isOpsStaff
            ? supabase
                .from("reports")
                .select("id, title, status, case_id")
                .ilike("title", like)
                .limit(5)
            : Promise.resolve({ data: null }),
          // Creative Studio (admin-only tables — RLS returns nothing for other roles anyway)
          isAdmin
            ? supabase
                .from("studio_content_masters")
                .select("id, title, status, pillar")
                .or(`title.ilike.${like},hook.ilike.${like}`)
                .limit(5)
            : Promise.resolve({ data: null }),
          isAdmin
            ? supabase
                .from("studio_ideas")
                .select("id, title, pillar, status")
                .or(`title.ilike.${like},hook.ilike.${like}`)
                .limit(5)
            : Promise.resolve({ data: null }),
          isAdmin
            ? supabase
                .from("studio_knowledge_sources")
                .select("id, title, category")
                .or(`title.ilike.${like},content.ilike.${like}`)
                .limit(5)
            : Promise.resolve({ data: null }),
          isAdmin
            ? supabase
                .from("studio_cases")
                .select("id, title, case_code, case_type")
                .or(`title.ilike.${like},case_code.ilike.${like}`)
                .limit(5)
            : Promise.resolve({ data: null }),
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

        const studioContentResults: Result[] = (sContentRes.data ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: `${m.status} · ${m.pillar}`,
          href: `/studio/content/${m.id}`,
          group: "studioContent",
        }));
        const studioIdeaResults: Result[] = (sIdeasRes.data ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: `${m.status} · ${m.pillar}`,
          href: `/studio/ideas?q=${encodeURIComponent(m.title)}`,
          group: "studioIdeas",
        }));
        const studioKnowledgeResults: Result[] = (sKnowledgeRes.data ?? []).map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: m.category,
          href: `/studio/knowledge/${m.id}`,
          group: "studioKnowledge",
        }));
        const studioCaseResults: Result[] = (sCasesRes.data ?? []).map((m) => ({
          id: m.id,
          title: `${m.case_code} · ${m.title}`,
          subtitle: m.case_type,
          href: `/studio/cases/${m.id}`,
          group: "studioCases",
        }));

        setResults([
          ...caseResults,
          ...clientResults,
          ...agentResults,
          ...reportResults,
          ...studioContentResults,
          ...studioIdeaResults,
          ...studioKnowledgeResults,
          ...studioCaseResults,
        ]);
      });
    },
    [isStaff, isAdmin, isOpsStaff],
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

  const GROUPS = ["cases", "clients", "agents", "reports", "studioContent", "studioIdeas", "studioKnowledge", "studioCases"] as const;
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g, results.filter((r) => r.group === g)])) as Record<Result["group"], Result[]>;

  const ICONS: Record<Result["group"], React.ReactNode> = {
    cases:   <Briefcase className="h-4 w-4 text-primary" />,
    clients: <UserCircle className="h-4 w-4 text-violet-400" />,
    agents:  <Users className="h-4 w-4 text-emerald-400" />,
    reports: <FileText className="h-4 w-4 text-amber-400" />,
    studioContent:   <Clapperboard className="h-4 w-4 text-sky-400" />,
    studioIdeas:     <Lightbulb className="h-4 w-4 text-amber-400" />,
    studioKnowledge: <BookOpen className="h-4 w-4 text-violet-400" />,
    studioCases:     <FolderSearch className="h-4 w-4 text-emerald-400" />,
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

          {GROUPS.map((group, i) => {
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
