"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { deleteCase } from "./actions";

export function CaseDetailActions({ id, caseCode }: { id: string; caseCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href={`/studio/cases/${id}?edit=1`}>
          <Pencil className="h-3.5 w-3.5" /> แก้ไข
        </Link>
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" /> ลบ
      </Button>
      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`ลบเคส ${caseCode}?`}
        description="เคสและบทเรียนทั้งหมดที่สกัดจากเคสนี้จะถูกลบถาวร ไอเดียที่เคยสร้างจะยังอยู่แต่ตามกลับมาที่แหล่งข้อมูลไม่ได้"
        onConfirm={async () => {
          const res = await deleteCase(id);
          if (!res.ok) { toast.error(res.error); return { error: res.error }; }
          toast.success("ลบเคสแล้ว");
          router.push("/studio/cases");
          router.refresh();
        }}
      />
    </>
  );
}
