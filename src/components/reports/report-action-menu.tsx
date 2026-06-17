"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreVertical, Trash2 } from "lucide-react";
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
  archiveReport,
  unarchiveReport,
  deleteReport,
} from "@/app/(dashboard)/reports/actions";

interface ReportActionMenuProps {
  reportId: string;
  reportTitle: string;
  isArchived: boolean;
  isAdmin: boolean;
}

export function ReportActionMenu({
  reportId,
  reportTitle,
  isArchived,
  isAdmin,
}: ReportActionMenuProps) {
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
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isArchived ? (
            <DropdownMenuItem onClick={() => run(() => archiveReport(reportId))}>
              <Archive className="mr-2 h-4 w-4" />
              เก็บถาวร
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => run(() => unarchiveReport(reportId))}>
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
        title="ลบรายงานนี้"
        description={`"${reportTitle}" จะถูกลบถาวรและไม่สามารถกู้คืนได้`}
        onConfirm={() => deleteReport(reportId)}
      />
    </>
  );
}
