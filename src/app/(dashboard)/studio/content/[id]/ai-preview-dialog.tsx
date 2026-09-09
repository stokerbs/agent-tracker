"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiModelTag } from "@/components/studio/ai-status";

export interface AiPreviewState {
  title: string;
  description?: string;
  /** Proposed text (rendered pre-wrap). Use `children` for custom layouts. */
  text?: string | null;
  changeNote?: string | null;
  model?: string | null;
  /** Called when the owner accepts; may be async (pending state shown). */
  onApply: () => void | Promise<void>;
  applyLabel?: string;
  children?: React.ReactNode;
}

/**
 * Every AI proposal goes through this: the owner sees the exact text that
 * would replace their copy and picks "ใช้แทน" or "ยกเลิก". Nothing is written
 * before that click.
 */
export function AiPreviewDialog({
  state,
  onClose,
  pending,
  loading,
  loadingLabel = "AI กำลังเขียน… (10–60 วินาที)",
}: {
  state: AiPreviewState | null;
  onClose: () => void;
  pending?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const open = !!state || !!loading;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !pending && !loading && onClose()}>
      <DialogContent className="max-w-2xl">
        {loading && !state ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <p className="text-sm text-muted-foreground">{loadingLabel}</p>
          </div>
        ) : state ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" /> {state.title}
              </DialogTitle>
              <DialogDescription>{state.description ?? "ตรวจข้อความที่ AI เสนอ — ระบบจะไม่เปลี่ยนเนื้อหาจนกว่าคุณจะกดใช้แทน"}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {state.text != null && (
                <pre className="whitespace-pre-wrap rounded-md border border-border/70 bg-muted/30 px-3 py-2.5 font-sans text-sm leading-relaxed text-foreground">{state.text}</pre>
              )}
              {state.children}
              {state.changeNote && <p className="text-xs text-muted-foreground">สิ่งที่เปลี่ยน: {state.changeNote}</p>}
            </div>
            <DialogFooter className="items-center gap-2 sm:justify-between">
              <div>{state.model && <AiModelTag model={state.model} />}</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
                  ยกเลิก
                </Button>
                <Button size="sm" onClick={() => void state.onApply()} disabled={pending}>
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {state.applyLabel ?? "ใช้แทน"}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
