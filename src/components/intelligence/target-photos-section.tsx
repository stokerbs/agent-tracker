"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Loader2, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  uploadTargetPhoto,
  setPrimaryPhoto,
  deleteTargetPhoto,
} from "@/app/(dashboard)/cases/[id]/intelligence-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { cn } from "@/lib/utils";
import type { TargetPhoto } from "@/lib/types";

interface Props {
  caseId: string;
  photos: TargetPhoto[];
  isStaff: boolean;
}

export function TargetPhotosSection({ caseId, photos, isStaff }: Props) {
  const t = useTranslations("intelligence.photos");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<TargetPhoto | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      try {
        await uploadTargetPhoto(caseId, fd);
        toast.success(t("uploadSuccess"));
        router.refresh();
      } catch {
        toast.error(t("uploadError"));
      }
    });
    e.target.value = "";
  }

  function handleSetPrimary(photo: TargetPhoto) {
    start(async () => {
      try {
        await setPrimaryPhoto(photo.id, caseId);
        router.refresh();
      } catch {
        toast.error("Failed to set primary photo.");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      try {
        await deleteTargetPhoto(deleteTarget.id, caseId, deleteTarget.storage_path);
        toast.success(t("deleteSuccess"));
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error(t("deleteError"));
      }
    });
  }

  const lightboxImages = photos.map((p) => ({ url: p.signedUrl ?? "", alt: p.caption ?? "Target photo" }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t("title")}</h4>
        {isStaff && (
          <>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => inputRef.current?.click()} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t("upload")}
            </Button>
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <ImageIcon className="mr-2 h-4 w-4" />
          <span className="text-xs">{t("empty")}</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className={cn(
                "group relative aspect-square cursor-pointer overflow-hidden rounded-md border",
                photo.is_primary && "ring-2 ring-primary ring-offset-1",
              )}
              onClick={() => setLightboxIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.signedUrl ?? ""} alt={photo.caption ?? "Target photo"} className="h-full w-full object-cover" />
              {photo.is_primary && (
                <span className="absolute left-1 top-1 rounded bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground">
                  PRIMARY
                </span>
              )}
              {isStaff && (
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  {!photo.is_primary && (
                    <button onClick={() => handleSetPrimary(photo)} className="flex-1 rounded text-[10px] text-yellow-400 hover:text-yellow-300" title={t("setPrimary")}>
                      <Star className="mx-auto h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(photo)} className="flex-1 rounded text-[10px] text-red-400 hover:text-red-300" title={t("delete")}>
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen lightbox with swipe + pinch-zoom */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" /> {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
