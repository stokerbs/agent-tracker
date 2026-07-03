import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
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

export const metadata: Metadata = { title: "Recruitment" };
export const dynamic = "force-dynamic";

interface Application {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  position: string | null;
  experience: string | null;
  message: string | null;
  locale: string;
  status: string;
  created_at: string;
}

export default async function RecruitmentPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("recruitment_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  const applications = (data as Application[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        title="ผู้สมัครร่วมงาน"
        description="รายชื่อผู้ที่สมัครร่วมงานผ่านหน้าเว็บ detectivepulse.com/careers"
      />
      {applications.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="ยังไม่มีผู้สมัคร"
          description="เมื่อมีคนกรอกใบสมัครบนเว็บ รายชื่อจะแสดงที่นี่"
        />
      ) : (
        <>
          {/* Mobile: readable cards */}
          <div className="space-y-3 md:hidden">
            {applications.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{a.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <a href={`tel:${a.phone}`} className="font-medium text-primary hover:underline">{a.phone}</a>
                    {a.email && (
                      <a href={`mailto:${a.email}`} className="text-sm text-muted-foreground hover:text-primary hover:underline">{a.email}</a>
                    )}
                  </div>
                  {a.position && (
                    <div className="mt-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{a.position}</span>
                    </div>
                  )}
                  {a.experience && <p className="mt-2 text-sm font-medium text-foreground/80">{a.experience}</p>}
                  {a.message && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{a.message}</p>}
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
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>
                        <a href={`tel:${a.phone}`} className="text-primary hover:underline">{a.phone}</a>
                        {a.email && (
                          <a href={`mailto:${a.email}`} className="mt-0.5 block text-xs text-muted-foreground hover:text-primary hover:underline">{a.email}</a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{a.position ?? "—"}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {a.experience && <span className="block font-medium text-foreground/80">{a.experience}</span>}
                        <span className="line-clamp-2">{a.message ?? "—"}</span>
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
