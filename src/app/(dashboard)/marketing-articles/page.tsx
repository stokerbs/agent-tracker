import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateArticleNow } from "./actions";
import { GenerateButton } from "./generate-button";

export const metadata: Metadata = { title: "AI Articles" };
export const dynamic = "force-dynamic";
export const maxDuration = 120; // generation runs inside the "generate now" action

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
        description="สร้างบทความอัตโนมัติด้วย AI (เจาะคีย์เวิร์ดจากแอด) — ระบบจะร่างให้ แล้วส่งลิงก์อนุมัติเข้า LINE · ปกติรันอัตโนมัติ อังคาร & ศุกร์"
      />

      <form action={generateArticleNow} className="mb-6">
        <GenerateButton />
        <p className="mt-2 text-xs text-muted-foreground">
          กดแล้ว AI จะร่างบทความใหม่ 1 ชิ้น (TH+EN) แล้วส่งลิงก์รีวิวเข้า LINE ของคุณให้กดอนุมัติ
        </p>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="ยังไม่มีบทความ AI"
          description="กด “สร้างบทความใหม่ตอนนี้” เพื่อให้ AI ร่างบทความแรก"
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
