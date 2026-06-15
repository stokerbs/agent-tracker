import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { requireProfile, isStaff } from "@/lib/auth";
import { getCases } from "@/lib/queries";
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
  const cases = await getCases();

  const year = new Date().getFullYear();
  const seq = String(cases.length + 1).padStart(4, "0");
  const suggestedNumber = `CASE-${year}-${seq}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Case Management" description="All surveillance assignments.">
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
                title="No cases yet"
                description="Open your first case to begin tracking a surveillance operation."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start</TableHead>
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
                    <TableCell className="text-sm">{c.target_name ?? "—"}</TableCell>
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
