"use client";

import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Pickaxe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import type { InboxStats } from "@/lib/studio/faq-mining";
import { formatDate } from "@/lib/utils";
import { mineLineInboxNow } from "./actions";

/**
 * LINE OA inbox → FAQ mining status. Messages from non-agent senders are
 * captured (PII-redacted, sender hashed) by the LINE webhook; the weekly cron
 * mines them into questions. This card shows the queue and lets the owner
 * mine on demand.
 */
export function LineInboxCard({ stats, aiAvailable }: { stats: InboxStats | null; aiAvailable: boolean }) {
  const router = useRouter();
  const [pending, safe] = useSafeTransition();

  function mine() {
    safe(async () => {
      const res = await mineLineInboxNow();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const r = res.data;
      if (r.skipped === "too_few" || r.messages === 0) toast.info("ยังไม่มีข้อความใหม่จาก LINE ให้ขุด");
      else toast.success(`ขุดจาก ${r.messages} ข้อความ → คำถามใหม่ ${r.inserted} · รวมกับที่มี ${r.merged}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">ข้อความจาก LINE OA</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ข้อความจากลูกค้าที่ทักเข้า @detectivepluse ถูกเก็บแบบตัดข้อมูลส่วนตัวออกแล้ว ระบบขุดคำถามซ้ำ ๆ ให้ทุกวันจันทร์ 01:30
            </p>
            {stats ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">รอขุด</dt>
                  <dd className="text-base font-semibold tabular-nums">{stats.unprocessed}</dd>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">ผู้ทัก 7 วัน</dt>
                  <dd className="text-base font-semibold tabular-nums">{stats.senders7d}</dd>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">ขุดล่าสุด</dt>
                  <dd className="text-xs font-medium">{stats.lastProcessedAt ? formatDate(stats.lastProcessedAt) : "ยังไม่เคย"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">โหลดสถานะกล่องข้อความไม่สำเร็จ</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1.5"
              onClick={mine}
              disabled={pending || !aiAvailable || !stats || stats.unprocessed === 0}
              title={!aiAvailable ? "AI ยังใช้งานไม่ได้" : stats && stats.unprocessed === 0 ? "ยังไม่มีข้อความรอขุด" : undefined}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pickaxe className="h-4 w-4" />}
              ขุดคำถามตอนนี้
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
