import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireProfile, isStaff } from "@/lib/auth";
import { getCases } from "@/lib/queries";
import { decryptField } from "@/lib/security/encryption";
import { PageHeader } from "@/components/shared/page-header";
import { CreateCaseDialog } from "@/components/cases/create-case-dialog";
import {
  CasePriorityBadge,
  CaseStatusBadge,
} from "@/components/shared/status-badges";
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
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Cases" };
export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const profile = await requireProfile();
  const t = await getTranslations("cases");
  const cases = await getCases();

  const year = new Date().getFullYear();
  const seq = String(cases.length + 1).padStart(4, "0");
  const suggestedNumber = `CASE-${year}-${seq}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        {isStaff(profile.role) && (
          <CreateCaseDialog suggestedNumber={suggestedNumber} />
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {cases.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Briefcase className="h-6 w-6" />}
                title={t("noTitle")}
                description={t("noDescription")}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.case")}</TableHead>
                  <TableHead>{t("table.client")}</TableHead>
                  <TableHead>{t("table.type")}</TableHead>
                  <TableHead>{t("table.target")}</TableHead>
                  <TableHead>{t("table.priority")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>{t("table.start")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                        {c.case_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.client_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.case_type ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">{c.target_name_enc ? decryptField(c.target_name_enc) : "—"}</TableCell>
                    <TableCell><CasePriorityBadge priority={c.priority} /></TableCell>
                    <TableCell><CaseStatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.start_date)}
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
