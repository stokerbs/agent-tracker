import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KnowledgeForm } from "../knowledge-form";

export const metadata: Metadata = { title: "เพิ่มความรู้ · Creative Studio" };

export default async function NewKnowledgePage() {
  await requireRole(["admin"]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="เพิ่มความรู้" description="บันทึกความรู้จริงจากงานของ Detective Pulse ให้ AI ใช้อ้างอิง — เขียนแบบ generalise ไม่ระบุตัวบุคคล">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link href="/studio/knowledge">
            <ArrowLeft className="h-4 w-4" /> กลับคลังความรู้
          </Link>
        </Button>
      </PageHeader>
      <Card>
        <CardContent className="p-4 sm:p-6">
          <KnowledgeForm />
        </CardContent>
      </Card>
    </div>
  );
}
