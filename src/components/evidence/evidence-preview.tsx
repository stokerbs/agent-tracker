"use client";

import {
  FileText,
  Film,
  ImageIcon,
  Music,
  Paperclip,
  ZoomIn,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { Evidence } from "@/lib/types";

export const TYPE_META = {
  photo:    { Icon: ImageIcon,  bg: "bg-blue-500/10",   text: "text-blue-400",   label: "IMG" },
  video:    { Icon: Film,       bg: "bg-violet-500/10", text: "text-violet-400", label: "VID" },
  pdf:      { Icon: FileText,   bg: "bg-red-500/10",    text: "text-red-400",    label: "PDF" },
  audio:    { Icon: Music,      bg: "bg-amber-500/10",  text: "text-amber-400",  label: "AUD" },
  document: { Icon: Paperclip,  bg: "bg-slate-500/10",  text: "text-slate-400",  label: "DOC" },
} as const;

interface Props {
  item: Evidence;
  onOpen: () => void;
  /** If provided, rendered as the thumbnail instead of the type icon. */
  thumbnailUrl?: string;
}

export function EvidencePreview({ item, onOpen, thumbnailUrl }: Props) {
  const tEvidence = useTranslations("evidence");
  const meta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.document;
  const { Icon } = meta;

  const typeLabels: Record<keyof typeof TYPE_META, string> = {
    photo: tEvidence("typeLabels.photo"),
    video: tEvidence("typeLabels.video"),
    pdf: tEvidence("typeLabels.pdf"),
    audio: tEvidence("typeLabels.audio"),
    document: tEvidence("typeLabels.document"),
  };
  const label = typeLabels[item.type as keyof typeof TYPE_META] ?? typeLabels.document;

  return (
    <motion.button
      onClick={onOpen}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-lg border border-border/60 bg-card text-left",
        "transition-all duration-200 hover:border-border hover:shadow-sm focus-ring",
      )}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          "relative flex h-28 w-full items-center justify-center overflow-hidden transition-colors",
          thumbnailUrl ? "bg-black" : meta.bg,
        )}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={item.file_name ?? ""}
            className="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
          />
        ) : (
          <Icon
            className={cn("h-8 w-8 transition-transform group-hover:scale-110", meta.text)}
          />
        )}
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
            {label}
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
  );
}
