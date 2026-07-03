import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
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

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  case_type: string | null;
  message: string | null;
  locale: string;
  source: string;
  status: string;
  created_at: string;
}

export default async function LeadsPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  const leads = (data as Lead[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        title="ลูกค้าที่ติดต่อเข้ามา"
        description="รายชื่อที่กรอกฟอร์มติดต่อจากหน้าเว็บ detectivepulse.com"
      />
      {leads.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="ยังไม่มีลูกค้าติดต่อเข้ามา"
          description="เมื่อมีคนกรอกฟอร์มบนเว็บ รายชื่อจะแสดงที่นี่"
        />
      ) : (
        <>
          {/* Mobile: readable stacked cards with clear labels */}
          <div className="space-y-3 md:hidden">
            {leads.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-4">
                  {/* Contact person (who to call back) */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">ผู้ติดต่อกลับ</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold">{l.name}</span>
                        {l.source === "assistant" && (
                          <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">แชท AI</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(l.created_at)}</span>
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-muted-foreground">เบอร์</span>
                      <a href={`tel:${l.phone}`} className="font-medium text-primary hover:underline">{l.phone}</a>
                    </div>
                    {l.email && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">อีเมล</span>
                        <a href={`mailto:${l.email}`} className="break-all text-primary hover:underline">{l.email}</a>
                      </div>
                    )}
                    {l.case_type && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">ประเภท</span>
                        <span className="font-medium">{l.case_type}</span>
                      </div>
                    )}
                    {l.message && (
                      <div className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">รายละเอียด</span>
                        <p className="flex-1 whitespace-pre-line leading-relaxed">{l.message}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>ติดต่อ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(l.created_at)}</TableCell>
                      <TableCell className="font-medium">
                        {l.name}
                        {l.source === "assistant" && (
                          <span className="ml-2 rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-normal text-primary">แชท AI</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <a href={`tel:${l.phone}`} className="text-primary hover:underline">{l.phone}</a>
                        {l.email && (
                          <a href={`mailto:${l.email}`} className="mt-0.5 block text-xs text-muted-foreground hover:text-primary hover:underline">{l.email}</a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{l.case_type ?? "—"}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        <span className="line-clamp-2">{l.message ?? "—"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
