"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<{ error?: string } | void>;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const confirmed = typed === "DELETE";

  function handleConfirm() {
    if (!confirmed) return;
    start(async () => {
      await onConfirm();
      setTyped("");
      onOpenChange(false);
    });
  }

  function handleOpenChange(v: boolean) {
    if (!pending) {
      setTyped("");
      onOpenChange(v);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <DialogTitle className="text-destructive">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            พิมพ์ <span className="font-mono font-bold text-destructive">DELETE</span> เพื่อยืนยัน
          </p>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            className="font-mono"
            disabled={pending}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!confirmed || pending}
              onClick={handleConfirm}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ลบถาวร"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
