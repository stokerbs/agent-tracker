import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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

export default async function ClientsPage() {
  await requireRole(["admin", "supervisor"]);
  const t = await getTranslations("clients");
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").order("name");
  const clients = (data as Client[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title={t("noTitle")}
                description={t("noDescription")}
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
