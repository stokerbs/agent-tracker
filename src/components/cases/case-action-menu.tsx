"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
  archiveCase,
  unarchiveCase,
  cancelCase,
  deleteCase,
} from "@/app/(dashboard)/cases/actions";
import type { CaseStatus } from "@/lib/types";

interface CaseActionMenuProps {
  caseId: string;
  caseNumber: string;
  status: CaseStatus;
  isArchived: boolean;
  isAdmin: boolean;
}

export function CaseActionMenu({
  caseId,
  caseNumber,
  status,
  isArchived,
  isAdmin,
}: CaseActionMenuProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, start] = useTransition();

  function run(action: () => Promise<{ error?: string } | { ok: boolean }>) {
    start(async () => {
      const res = await action();
      if (res && "error" in res && res.error) {
        toast.error(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
          {!isArchived && status !== "cancelled" && (
            <DropdownMenuItem onClick={() => run(() => cancelCase(caseId))}>
              <XCircle className="mr-2 h-4 w-4 text-rose-500" />
              ยกเลิกคดี
            </DropdownMenuItem>
          )}
          {!isArchived ? (
            <DropdownMenuItem onClick={() => run(() => archiveCase(caseId))}>
              <Archive className="mr-2 h-4 w-4" />
              เก็บถาวร
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => run(() => unarchiveCase(caseId))}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              ยกเลิกการเก็บถาวร
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                ลบถาวร
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`ลบคดี ${caseNumber}`}
        description="การดำเนินการนี้ไม่สามารถย้อนกลับได้ บันทึกคดีทั้งหมด ไทม์ไลน์ หลักฐาน และรายงานที่เชื่อมโยงจะถูกลบถาวร"
        onConfirm={() => deleteCase(caseId)}
      />
    </>
  );
}
