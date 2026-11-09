import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "AI Articles" };
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  th_title: string;
  status: string;
  approve_token: string;
  th_slug: string;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "border-warning/40 bg-warning/10 text-warning",
  published: "border-success/40 bg-success/10 text-success",
  rejected: "border-border bg-muted text-muted-foreground",
};

export default async function MarketingArticlesPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketing_articles")
    .select("id, th_title, status, approve_token, th_slug, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data as Row[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        title="บทความ AI"
        description="Codex ร่างบทความไทย อังกฤษ และจีนผ่านงานตามเวลาใน ChatGPT — อังคารและศุกร์ 09:00 น. เวลาไทย · ตรวจและอนุมัติร่างก่อนเผยแพร่"
      />

      <div className="mb-6 rounded-lg border bg-muted/30 p-4 text-sm">
        <p>
          ระบบสร้างร่างผ่านงานตามเวลาใน Codex โดยใช้โควตาแพ็กเกจ ChatGPT ของเจ้าของ
          และแจ้งผลใน ChatGPT แทน LINE ร่างที่สร้างสำเร็จจะแสดงในรายการด้านล่าง
        </p>
        <p className="mt-2 text-muted-foreground">
          หากต้องการสร้างร่างเพิ่มเติม ให้สั่ง Codex ใน ChatGPT
          หรือจัดการงานชื่อ “ร่างบทความ Detective Pulse” ในหน้ารวมงานตามเวลา
          การรันขึ้นอยู่กับโควตาและสิทธิ์เข้าถึงแอปที่เชื่อมต่อ
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="ยังไม่มีบทความ AI"
          description="ร่างจากงานตามเวลาใน Codex จะแสดงที่นี่เมื่อสร้างสำเร็จ"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>หัวข้อ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ลิงก์</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{r.th_title}</TableCell>
                    <TableCell>
                      <span className={`inline-block rounded border px-2 py-0.5 text-[11px] ${STATUS_STYLE[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.status === "published" ? (
                        <a href={`https://detectivepulse.com/articles/${encodeURIComponent(r.th_slug)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          ดูบนเว็บ
                        </a>
                      ) : r.status === "draft" ? (
                        <a href={`/review/${r.approve_token}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          รีวิว/อนุมัติ
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
