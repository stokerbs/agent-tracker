import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateClientDialog } from "@/components/clients/create-client-dialog";
import { ClientSearch } from "@/components/clients/client-search";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Client } from "@/lib/types";

export const metadata: Metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ClientsPage({ searchParams }: Props) {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("clients");
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").order("name");
  const all = (data as Client[]) ?? [];

  const search = q?.toLowerCase().trim() ?? "";
  const clients = search
    ? all.filter((c) =>
        `${c.name} ${c.company ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(search),
      )
    : all;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <CreateClientDialog />
      </PageHeader>

      <div className="flex items-center justify-between gap-3">
        <Suspense>
          <ClientSearch defaultValue={q ?? ""} />
        </Suspense>
        {search && (
          <span className="text-xs text-muted-foreground">
            {clients.length} of {all.length}
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title={search ? "No clients match" : t("noTitle")}
                description={search ? "Try a different search term." : t("noDescription")}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.company")}</TableHead>
                  <TableHead>{t("table.email")}</TableHead>
                  <TableHead>{t("table.phone")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} className="relative cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/clients/${c.id}`}
                        className="absolute inset-0"
                        aria-label={c.name}
                      />
                      {c.name}
                    </TableCell>
                    <TableCell className="text-sm">{c.company ?? "—"}</TableCell>
                    <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
