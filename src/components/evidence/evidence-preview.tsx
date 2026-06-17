"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  MapPin,
  Music,
  Paperclip,
  Trash2,
  ZoomIn,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { getEvidenceUrl, deleteEvidence } from "@/app/(dashboard)/evidence/actions";
import type { Evidence } from "@/lib/types";

// ── Type metadata ─────────────────────────────────────────────────────────────

export const TYPE_META = {
  photo:    { Icon: ImageIcon, bg: "bg-blue-500/10",    text: "text-blue-400",   border: "border-blue-500/20",   label: "IMG" },
  video:    { Icon: Film,      bg: "bg-violet-500/10",  text: "text-violet-400", border: "border-violet-500/20", label: "VID" },
  pdf:      { Icon: FileText,  bg: "bg-red-500/10",     text: "text-red-400",    border: "border-red-500/20",    label: "PDF" },
  audio:    { Icon: Music,     bg: "bg-amber-500/10",   text: "text-amber-400",  border: "border-amber-500/20",  label: "AUD" },
  document: { Icon: Paperclip, bg: "bg-slate-500/10",   text: "text-slate-400",  border: "border-slate-500/20",  label: "DOC" },
} as const;

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isGps(item: Evidence): boolean {
  const cat = (item.category ?? "").toLowerCase();
  const notes = (item.notes ?? "").toLowerCase();
  return cat.includes("gps") || cat.includes("location") || notes.includes("gps");
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function EvidenceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className="h-36 w-full animate-pulse bg-muted" />
      <div className="space-y-1.5 p-3">
        <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

// ── Preview card ──────────────────────────────────────────────────────────────

interface Props {
  item: Evidence;
  onOpen: () => void;
  thumbnailUrl?: string;
  uploaderName?: string;
  isAdmin?: boolean;
}

export function EvidencePreview({
  item,
  onOpen,
  thumbnailUrl,
  uploaderName,
  isAdmin = false,
}: Props) {
  const tEvidence = useTranslations("evidence");
  const meta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.document;
  const { Icon } = meta;
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [delPending, startDel] = useTransition();

  const showThumbnail = !!thumbnailUrl && !imgError;
  const gps = isGps(item);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    const src = thumbnailUrl;
    if (src) {
      const a = document.createElement("a");
      a.href = src;
      a.download = item.file_name ?? "evidence";
      a.target = "_blank";
      a.click();
      return;
    }
    // For non-image types, fetch a signed URL on demand.
    const res = await getEvidenceUrl(item.storage_path);
    if ("error" in res) { toast.error(res.error); return; }
    const a = document.createElement("a");
    a.href = res.url;
    a.download = item.file_name ?? "evidence";
    a.target = "_blank";
    a.click();
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`ลบหลักฐาน "${item.file_name}" ถาวร?`)) return;
    startDel(async () => {
      const res = await deleteEvidence(item.id);
      if (res?.error) toast.error(res.error);
      else toast.success("ลบหลักฐานแล้ว");
    });
  }

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border/60 bg-card",
        "transition-shadow duration-200 hover:border-border hover:shadow-md",
        delPending && "opacity-50 pointer-events-none",
      )}
    >
      {/* ── Thumbnail area ── */}
      <button
        type="button"
        onClick={onOpen}
        className="relative block h-36 w-full overflow-hidden focus-ring rounded-t-lg"
        aria-label={`Preview ${item.file_name}`}
      >
        {/* Skeleton shimmer while image loads */}
        {showThumbnail && !imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        )}

        {showThumbnail ? (
          <Image
            src={thumbnailUrl}
            alt={item.file_name ?? "evidence"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-cover transition-all duration-300",
              imgLoaded ? "opacity-90 group-hover:opacity-100 group-hover:scale-105" : "opacity-0",
            )}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center", meta.bg)}>
            <Icon
              className={cn(
                "h-10 w-10 transition-transform duration-200 group-hover:scale-110",
                meta.text,
              )}
            />
          </div>
        )}

        {/* Hover overlay with primary action */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow-lg ring-1 ring-border/60">
                <ZoomIn className="h-4 w-4 text-foreground" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Type badge — top left */}
        <div className="absolute left-2 top-2">
          <TypeBadge type={item.type} gps={gps} />
        </div>
      </button>

      {/* ── Hover action strip (appears below thumbnail on hover) ── */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-border/60"
          >
            <div className="flex items-center justify-between gap-1 bg-muted/60 px-3 py-1.5">
              <div className="flex items-center gap-1">
                <ActionBtn title="Preview" onClick={onOpen}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </ActionBtn>
                <ActionBtn title="Download" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" />
                </ActionBtn>
                {item.case_id && (
                  <Link
                    href={`/cases/${item.case_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Open case"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              {isAdmin && (
                <ActionBtn
                  title="Delete"
                  onClick={handleDelete}
                  destructive
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </ActionBtn>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Info footer ── */}
      <div className="p-3">
        {/* Category / GPS tag */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.category && (
            <span className="text-[10px] text-muted-foreground/70 capitalize">{item.category}</span>
          )}
          {gps && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-500">
              <MapPin className="h-2.5 w-2.5" />
              GPS
            </span>
          )}
        </div>

        {/* Filename */}
        <p className="mt-0.5 truncate text-xs font-medium text-foreground/90" title={item.file_name ?? undefined}>
          {item.file_name ?? "—"}
        </p>

        {/* Uploader + date */}
        {uploaderName && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground/60">
            {uploaderName}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
          <span>{formatDate(item.uploaded_at)}</span>
          {item.file_size && (
            <>
              <span>·</span>
              <span>{formatBytes(item.file_size)}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type, gps }: { type: string; gps: boolean }) {
  const meta = TYPE_META[type as keyof typeof TYPE_META] ?? TYPE_META.document;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest backdrop-blur-sm",
        meta.text,
        meta.border,
        "bg-background/70",
      )}
    >
      {meta.label}
      {gps && <MapPin className="h-2 w-2 text-emerald-400" />}
    </span>
  );
}

// ── Tiny icon-only action button ──────────────────────────────────────────────

function ActionBtn({
  children,
  title,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
        destructive
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
