"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getEvidenceUrl } from "@/app/(dashboard)/evidence/actions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { TYPE_META } from "./evidence-preview";
import type { Evidence } from "@/lib/types";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  items: Evidence[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  thumbnailUrls?: Record<string, string>;
  uploaderNames?: Record<string, string>;
}

export function EvidenceLightbox({
  items,
  index,
  onClose,
  onPrev,
  onNext,
  thumbnailUrls = {},
  uploaderNames = {},
}: Props) {
  const t = useTranslations("evidence.lightbox");
  const item = items[index];
  const meta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.document;

  // URL cache: storage_path -> signed url (pre-seeded from gallery thumbnail URLs)
  const urlCache = useRef<Record<string, string>>({ ...thumbnailUrls });
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // Fetch signed URL when item changes
  useEffect(() => {
    setZoomed(false);
    const cached = urlCache.current[item.storage_path];
    if (cached) { setUrl(cached); return; }

    setUrl(null);
    setLoading(true);
    getEvidenceUrl(item.storage_path).then((res) => {
      setLoading(false);
      if ("error" in res) { toast.error(res.error); return; }
      urlCache.current[item.storage_path] = res.url;
      setUrl(res.url);
    });
  }, [item.storage_path]);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  async function handleDownload() {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = item.file_name ?? "evidence";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error(t("downloadError"));
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        <span className={cn("font-mono text-[10px] font-bold tracking-widest", meta.text)}>
          {meta.label}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {item.file_name}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={!url}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            title={t("download")}
          >
            <Download className="h-4 w-4" />
          </button>

          {/* Zoom toggle (photos only) */}
          {item.type === "photo" && url && (
            <button
              onClick={() => setZoomed((z) => !z)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={zoomed ? t("zoomOut") : t("zoomIn")}
            >
              {zoomed ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}

          {/* Counter */}
          <span className="px-2 text-xs text-muted-foreground">
            {index + 1} / {items.length}
          </span>

          {/* Close */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {/* Prev */}
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-20"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Media */}
        <div
          className={cn(
            "max-h-full transition-all duration-200",
            zoomed ? "w-full" : "max-w-4xl w-full",
          )}
        >
          {loading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {url && !loading && (
            <>
              {item.type === "photo" && (
                <div
                  className={cn(
                    "overflow-hidden rounded-lg",
                    zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
                  )}
                  onClick={() => setZoomed((z) => !z)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={item.file_name ?? ""}
                    className={cn(
                      "w-full transition-transform duration-300 origin-center",
                      zoomed ? "scale-150" : "scale-100",
                    )}
                  />
                </div>
              )}
              {item.type === "video" && (
                <video
                  src={url}
                  controls
                  className="w-full rounded-lg"
                  autoPlay={false}
                />
              )}
              {item.type === "audio" && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-8">
                  <audio src={url} controls className="w-full" />
                </div>
              )}
              {(item.type === "pdf" || item.type === "document") && (
                <iframe
                  src={url}
                  className="h-[70vh] w-full rounded-lg border border-border/60"
                  title={item.file_name ?? ""}
                />
              )}
            </>
          )}
        </div>

        {/* Next */}
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-20"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Footer — metadata */}
      <div className="shrink-0 border-t border-border/60 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {item.uploaded_by && uploaderNames[item.uploaded_by] && (
            <span className="font-medium text-foreground/70">{uploaderNames[item.uploaded_by]}</span>
          )}
          <span>{formatDate(item.uploaded_at)}</span>
          {item.category && <span className="capitalize">{item.category}</span>}
          {item.file_size && <span>{formatBytes(item.file_size)}</span>}
          {item.notes && <span className="italic">"{item.notes}"</span>}
        </div>
      </div>
    </div>
  );
}
