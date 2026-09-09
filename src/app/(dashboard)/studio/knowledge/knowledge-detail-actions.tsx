"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { deleteKnowledge } from "./actions";

export function KnowledgeDetailActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href={`/studio/knowledge/${id}?edit=1`}>
          <Pencil className="h-3.5 w-3.5" /> แก้ไข
        </Link>
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" /> ลบ
      </Button>
      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="ลบความรู้รายการนี้?"
        description={`"${title}" จะถูกลบถาวร คอนเทนต์ที่เคยอ้างอิงจะยังอยู่แต่ไม่สามารถตามกลับมาที่แหล่งข้อมูลนี้ได้`}
        onConfirm={async () => {
          const res = await deleteKnowledge(id);
          if (!res.ok) { toast.error(res.error); return { error: res.error }; }
          toast.success("ลบความรู้แล้ว");
          router.push("/studio/knowledge");
          router.refresh();
        }}
      />
    </>
  );
}
