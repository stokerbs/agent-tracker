"use client";

import { useState } from "react";
import {
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Music,
  Paperclip,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getEvidenceUrl } from "@/app/(dashboard)/evidence/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Evidence } from "@/lib/types";

const TYPE_META = {
  photo:    { Icon: ImageIcon,  bg: "bg-blue-500/10",   text: "text-blue-400",   label: "IMG" },
  video:    { Icon: Film,       bg: "bg-violet-500/10", text: "text-violet-400", label: "VID" },
  pdf:      { Icon: FileText,   bg: "bg-red-500/10",    text: "text-red-400",    label: "PDF" },
  audio:    { Icon: Music,      bg: "bg-amber-500/10",  text: "text-amber-400",  label: "AUD" },
  document: { Icon: Paperclip,  bg: "bg-slate-500/10",  text: "text-slate-400",  label: "DOC" },
} as const;

export function EvidencePreview({ item }: { item: Evidence }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const meta = TYPE_META[item.type] ?? TYPE_META.document;
  const { Icon } = meta;

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
      <motion.button
        onClick={openPreview}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-card text-left",
          "transition-all duration-200 hover:border-border hover:shadow-sm focus-ring",
        )}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
      >
        {/* Thumbnail / type block */}
        <div
          className={cn(
            "flex h-24 w-full items-center justify-center transition-colors",
            meta.bg,
          )}
        >
          <Icon className={cn("h-8 w-8 transition-transform group-hover:scale-110", meta.text)} />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm">
              <ZoomIn className="h-4 w-4 text-foreground" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex items-center gap-1.5">
            <span className={cn("font-mono text-[9px] font-bold tracking-widest", meta.text)}>
              {meta.label}
            </span>
            {item.category && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-[10px] text-muted-foreground/70">{item.category}</span>
              </>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-foreground/90">
            {item.file_name}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">
            {formatDate(item.uploaded_at)}
          </p>
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 truncate font-mono text-sm">
              <span className={cn("text-xs font-bold tracking-widest", meta.text)}>
                {meta.label}
              </span>
              {item.file_name}
            </DialogTitle>
          </DialogHeader>
          {loading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {url && !loading && (
            <div className="overflow-hidden rounded-lg border border-border/60">
              {item.type === "photo" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={item.file_name ?? ""} className="w-full" />
              )}
              {item.type === "video" && (
                <video src={url} controls className="w-full" />
              )}
              {item.type === "audio" && (
                <div className="bg-muted/30 p-6">
                  <audio src={url} controls className="w-full" />
                </div>
              )}
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
