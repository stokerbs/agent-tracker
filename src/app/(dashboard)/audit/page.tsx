import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditFilters } from "@/components/audit/audit-filters";
import { timeAgo } from "@/lib/utils";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ACTION_BADGE: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-600",
  UPDATE: "bg-amber-500/15 text-amber-600",
  DELETE: "bg-red-500/15 text-red-600",
  LOGIN:  "bg-sky-500/15 text-sky-600",
};

const ENTITY_HREF: Record<string, (id: string) => string> = {
  cases:    (id) => `/cases/${id}`,
  agents:   ()   => `/agents`,
  reports:  ()   => `/reports`,
  profiles: ()   => `/users`,
  clients:  ()   => `/clients`,
  invoices: ()   => `/invoices`,
};

interface Props {
  searchParams: Promise<{
    action?: string;
    entity?: string;
    actor?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AuditPage({ searchParams }: Props) {
  await requireRole(["admin"]);
  const sp = await searchParams;
  const t = await getTranslations("audit");
  const page = Math.max(0, parseInt(sp.page ?? "0", 10));
  const supabase = await createClient();

  // Build filtered count + data query
  let query = supabase
    .from("audit_logs")
    .select("*, profiles(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (sp.action && sp.action !== "all") query = query.eq("action", sp.action);
  if (sp.entity && sp.entity !== "all") query = query.eq("entity", sp.entity);
  if (sp.actor  && sp.actor  !== "all") query = query.eq("actor_id", sp.actor);
  if (sp.from) query = query.gte("created_at", sp.from + "T00:00:00.000Z");
  if (sp.to)   query = query.lte("created_at", sp.to   + "T23:59:59.999Z");

  const { data, count } = await query.range(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE - 1,
  );

  const logs = (data ?? []) as any[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Sidebar data for filter dropdowns
  const [{ data: entitiesRaw }, { data: profilesRaw }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("entity")
      .order("entity"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const entities = [
    ...new Set((entitiesRaw ?? []).map((r: any) => r.entity).filter(Boolean)),
  ] as string[];

  const actors = (profilesRaw ?? []).map((p: any) => ({
    id: p.id as string,
    name: (p.full_name ?? p.email ?? "Unknown") as string,
  }));

  const allActions = ["INSERT", "UPDATE", "DELETE", "LOGIN"];

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (sp.action && sp.action !== "all") params.set("action", sp.action);
    if (sp.entity && sp.entity !== "all") params.set("entity", sp.entity);
    if (sp.actor  && sp.actor  !== "all") params.set("actor",  sp.actor);
    if (sp.from) params.set("from", sp.from);
    if (sp.to)   params.set("to",   sp.to);
    if (p > 0)   params.set("page", String(p));
    const qs = params.toString();
    return `/audit${qs ? "?" + qs : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Suspense>
        <AuditFilters
          actions={allActions}
          entities={entities}
          actors={actors}
          count={totalCount}
        />
      </Suspense>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ScrollText className="h-6 w-6" />}
                title={t("noTitle")}
                description={t("noDescription")}
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">{t("table.when")}</TableHead>
                    <TableHead>{t("table.actor")}</TableHead>
                    <TableHead className="w-28">{t("table.action")}</TableHead>
                    <TableHead>{t("table.entity")}</TableHead>
                    <TableHead>{t("table.record")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => {
                    const entityHref = l.entity_id && ENTITY_HREF[l.entity]
                      ? ENTITY_HREF[l.entity](l.entity_id)
                      : null;

                    return (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">
                          <span className="block text-sm font-mono text-foreground">
                            {new Date(l.created_at).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {timeAgo(l.created_at)}
                          </span>
                        </TableCell>

                        <TableCell className="text-sm">
                          {l.profiles?.full_name ?? l.profiles?.email ?? (
                            <span className="text-muted-foreground">{t("system")}</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            className={`border-transparent font-mono text-xs ${
                              ACTION_BADGE[l.action] ?? "bg-muted text-muted-foreground"
                            }`}
                          >
                            {l.action}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-sm font-medium capitalize">
                          {l.entity}
                        </TableCell>

                        <TableCell className="max-w-[12rem]">
                          {entityHref ? (
                            <Link
                              href={entityHref}
                              className="truncate font-mono text-xs text-primary underline-offset-2 hover:underline"
                            >
                              {l.entity_id}
                            </Link>
                          ) : (
                            <span className="truncate font-mono text-xs text-muted-foreground">
                              {l.entity_id ?? "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {t("pagination.page", { page: page + 1, total: totalPages })}
                  </span>
                  <div className="flex gap-2">
                    {page > 0 ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageUrl(page - 1)}>
                          <ChevronLeft className="h-4 w-4" />
                          {t("pagination.prev")}
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-4 w-4" />
                        {t("pagination.prev")}
                      </Button>
                    )}
                    {page < totalPages - 1 ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={buildPageUrl(page + 1)}>
                          {t("pagination.next")}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" disabled>
                        {t("pagination.next")}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
