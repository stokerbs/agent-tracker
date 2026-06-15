"use client";

import { useState } from "react";
import {
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Music,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { getEvidenceUrl } from "@/app/(dashboard)/evidence/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { Evidence } from "@/lib/types";

const ICON = {
  photo: ImageIcon,
  video: Film,
  pdf: FileText,
  audio: Music,
  document: Paperclip,
} as const;

export function EvidencePreview({ item }: { item: Evidence }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const Icon = ICON[item.type] ?? Paperclip;

  async function openPreview() {
    setOpen(true);
    if (url) return;
    setLoading(true);
    const res = await getEvidenceUrl(item.storage_path);
    setLoading(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setUrl(res.url);
  }

  return (
    <>
      <button
        onClick={openPreview}
        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {item.category ?? item.type} · {formatDate(item.uploaded_at)}
          </p>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{item.file_name}</DialogTitle>
          </DialogHeader>
          {loading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {url && !loading && (
            <div className="overflow-hidden rounded-lg">
              {item.type === "photo" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={item.file_name ?? ""} className="w-full" />
              )}
              {item.type === "video" && (
                <video src={url} controls className="w-full" />
              )}
              {item.type === "audio" && <audio src={url} controls className="w-full" />}
              {(item.type === "pdf" || item.type === "document") && (
                <iframe src={url} className="h-[70vh] w-full" title={item.file_name ?? ""} />
              )}
            </div>
          )}
          {item.notes && (
            <p className="text-sm text-muted-foreground">{item.notes}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
