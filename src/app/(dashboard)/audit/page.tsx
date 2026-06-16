import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const ACTION_BADGE: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-600",
  UPDATE: "bg-amber-500/15 text-amber-600",
  DELETE: "bg-red-500/15 text-red-600",
};

export default async function AuditPage() {
  await requireRole(["admin"]);
  const t = await getTranslations("audit");
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const logs = (data ?? []) as any[];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.when")}</TableHead>
                  <TableHead>{t("table.actor")}</TableHead>
                  <TableHead>{t("table.action")}</TableHead>
                  <TableHead>{t("table.entity")}</TableHead>
                  <TableHead>{t("table.record")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {timeAgo(l.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.profiles?.full_name ?? l.profiles?.email ?? t("system")}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-transparent ${ACTION_BADGE[l.action] ?? ""}`}>
                        {l.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{l.entity}</TableCell>
                    <TableCell className="max-w-[10rem] truncate text-xs text-muted-foreground">
                      {l.entity_id ?? "—"}
                    </TableCell>
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
