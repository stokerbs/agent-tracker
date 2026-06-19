"use client";

import { useCallback, useState } from "react";
import { Film, FileText, ImageIcon } from "lucide-react";
import { EvidenceLightbox } from "@/components/evidence/evidence-lightbox";
import type { Evidence, LinkedEvidence } from "@/lib/types";

interface Props {
  items: LinkedEvidence[];
}

function toEvidence(ev: LinkedEvidence): Evidence {
  return {
    id: ev.id,
    case_id: ev.case_id,
    type: ev.type,
    category: ev.category,
    storage_path: ev.storage_path,
    file_name: ev.file_name,
    file_size: ev.file_size,
    mime_type: ev.mime_type,
    notes: ev.notes,
    uploaded_by: ev.uploaded_by,
    uploaded_at: ev.uploaded_at,
    timeline_entry_id: null,
  };
}

export function TimelineEvidenceGallery({ items }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const photos  = items.filter((e) => e.type === "photo");
  const videos  = items.filter((e) => e.type === "video");
  const files   = items.filter((e) => e.type !== "photo" && e.type !== "video");

  const allItems   = [...photos, ...videos, ...files];
  const evidenceItems = allItems.map(toEvidence);
  const thumbnailUrls = Object.fromEntries(
    allItems.map((e) => [e.storage_path, e.signedUrl]),
  );

  const close = useCallback(() => setOpenIdx(null), []);
  const prev  = useCallback(() => setOpenIdx((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const next  = useCallback(
    () => setOpenIdx((i) => (i !== null && i < allItems.length - 1 ? i + 1 : i)),
    [allItems.length],
  );

  if (items.length === 0) return null;

  const photoStart = 0;
  const videoStart = photos.length;
  const fileStart  = photos.length + videos.length;

  return (
    <div className="mt-2 space-y-2">
      {/* Photo thumbnails — max 4, overflow badge */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {photos.slice(0, 4).map((ev, i) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => setOpenIdx(photoStart + i)}
              className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
              aria-label={ev.file_name ?? "Photo"}
            >
              {ev.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ev.signedUrl}
                  alt={ev.file_name ?? ""}
                  className="h-full w-full object-cover transition-opacity hover:opacity-80"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-500/10">
                  <ImageIcon className="h-5 w-5 text-blue-400" />
                </div>
              )}
            </button>
          ))}
          {photos.length > 4 && (
            <button
              type="button"
              onClick={() => setOpenIdx(4)}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted text-xs font-medium text-muted-foreground hover:bg-muted/70"
            >
              +{photos.length - 4}
            </button>
          )}
        </div>
      )}

      {/* Count chips */}
      <div className="flex flex-wrap gap-1.5">
        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenIdx(photoStart)}
            className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <ImageIcon className="h-3 w-3" />
            {photos.length} Photo{photos.length !== 1 ? "s" : ""}
          </button>
        )}
        {videos.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenIdx(videoStart)}
            className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-400 hover:bg-violet-500/20 transition-colors"
          >
            <Film className="h-3 w-3" />
            {videos.length} Video{videos.length !== 1 ? "s" : ""}
          </button>
        )}
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenIdx(fileStart)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-500/20 transition-colors"
          >
            <FileText className="h-3 w-3" />
            {files.length} File{files.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {openIdx !== null && (
        <EvidenceLightbox
          items={evidenceItems}
          index={openIdx}
          onClose={close}
          onPrev={prev}
          onNext={next}
          thumbnailUrls={thumbnailUrls}
        />
      )}
    </div>
  );
}
