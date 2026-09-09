"use client";

import { useState, useTransition } from "react";
import { Database, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { loadDemo, removeDemo } from "./actions";

export interface DemoCounts {
  knowledge: number;
  cases: number;
  questions: number;
  ideas: number;
  masters: number;
}

export function DemoDataForm({ counts }: { counts: DemoCounts }) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const total = counts.knowledge + counts.cases + counts.questions + counts.ideas + counts.masters;

  function load() {
    start(async () => {
      try {
        const res = await loadDemo();
        if (!res.ok) return void toast.error(res.error);
        const s = res.data;
        const inserted = s.knowledge + s.cases + s.insights + s.questions + s.ideas + s.masters;
        toast.success(
          inserted === 0
            ? "มีข้อมูลตัวอย่างครบอยู่แล้ว — ไม่ได้เพิ่มอะไร"
            : `โหลดแล้ว: ความรู้ ${s.knowledge} · เคส ${s.cases} · บทเรียน ${s.insights} · คำถาม ${s.questions} · ไอเดีย ${s.ideas} · คอนเทนต์ ${s.masters}`,
        );
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  async function remove() {
    try {
      const res = await removeDemo();
      if (res.ok) toast.success("ลบข้อมูลตัวอย่างแล้ว");
      else toast.error(res.error);
    } catch {
      toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
    }
  }

  const rows: { label: string; value: number }[] = [
    { label: "ความรู้ (demo)", value: counts.knowledge },
    { label: "เคส DEMO-00x", value: counts.cases },
    { label: "คำถามลูกค้า (demo)", value: counts.questions },
    { label: "ไอเดีย (tag demo)", value: counts.ideas },
    { label: "คอนเทนต์ (tag demo)", value: counts.masters },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {rows.map((r) => (
          <div key={r.label} className="rounded-lg border bg-muted/30 p-3">
            <p className="font-mono text-lg font-semibold tabular-nums">{r.value}</p>
            <p className="text-[11px] text-muted-foreground">{r.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {total === 0 ? "ยังไม่มีข้อมูลตัวอย่างในระบบ" : `มีข้อมูลตัวอย่างอยู่ ${total} รายการ`} — การโหลดซ้ำจะข้ามรายการที่มีอยู่แล้ว (idempotent)
        </p>
        <div className="flex gap-2">
          <Button onClick={load} disabled={pending} size="sm" variant="outline">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            โหลดข้อมูลตัวอย่าง (DEMO)
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={pending || total === 0} size="sm" variant="destructive">
            <Trash2 className="h-4 w-4" /> ลบข้อมูลตัวอย่าง
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="ลบข้อมูลตัวอย่างทั้งหมด"
        description="ลบเฉพาะแถวที่ is_demo = true และคอนเทนต์/ไอเดียที่ติด tag demo (รวมสถิติและบทเรียนที่ผูกอยู่) — FAQ จริงของบริษัทและข้อมูลที่คุณสร้างเองจะไม่ถูกลบ"
        onConfirm={remove}
      />
    </div>
  );
}
