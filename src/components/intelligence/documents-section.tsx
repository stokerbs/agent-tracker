"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileImage,
  FileText,
  FileVideo,
  File,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  uploadIntelDocument,
  deleteIntelDocument,
} from "@/app/(dashboard)/cases/[id]/intelligence-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Evidence } from "@/lib/types";

interface IntelDoc extends Evidence {
  signedUrl?: string;
}

interface Props {
  caseId: string;
  documents: IntelDoc[];
  isStaff: boolean;
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.startsWith("video/")) return <FileVideo className="h-5 w-5 text-purple-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsSection({ caseId, documents, isStaff }: Props) {
  const t = useTranslations("intelligence.documents");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IntelDoc | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) return;
    const fd = new FormData(e.currentTarget);
    fd.set("file", selectedFile);
    start(async () => {
      try {
        await uploadIntelDocument(caseId, fd);
        toast.success(t("uploadSuccess"));
        setUploadOpen(false);
        setSelectedFile(null);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? t("uploadError"));
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    start(async () => {
      try {
        await deleteIntelDocument(deleteTarget.id, caseId, deleteTarget.storage_path);
        toast.success(t("deleteSuccess"));
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast.error(t("deleteError"));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t("title")}</h4>
        {isStaff && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              {t("upload")}
            </Button>

            {/* Upload dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("uploadTitle")}</DialogTitle>
                  <DialogDescription>{t("uploadDescription")}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="intel-file">{t("fileLabel")}</Label>
                    <input
                      ref={fileRef}
                      id="intel-file"
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx"
                      className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="intel-notes">{t("notesLabel")}</Label>
                    <Input
                      id="intel-notes"
                      name="notes"
                      placeholder={t("notesPlaceholder")}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setUploadOpen(false); setSelectedFile(null); }}
                      disabled={pending}
                    >
                      {t("cancel")}
                    </Button>
                    <Button type="submit" disabled={pending || !selectedFile}>
                      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("uploadButton")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-muted-foreground">
          <Paperclip className="mr-2 h-4 w-4" />
          <span className="text-xs">{t("empty")}</span>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-md border">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileIcon mime={doc.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{doc.file_name ?? t("untitled")}</p>
                <div className="flex items-center gap-2">
                  {doc.notes && (
                    <p className="truncate text-xs text-muted-foreground">{doc.notes}</p>
                  )}
                  {doc.file_size && (
                    <span className="shrink-0 text-[10px] text-muted-foreground/60">
                      {formatBytes(doc.file_size)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {doc.signedUrl && (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={doc.file_name ?? undefined}
                    title={t("download")}
                  >
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" asChild>
                      <span>
                        <Download className="h-3.5 w-3.5" />
                      </span>
                    </Button>
                  </a>
                )}
                {isStaff && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(doc)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {deleteTarget?.file_name && (
                <span className="font-medium">{deleteTarget.file_name}</span>
              )}
              {" "}{t("deleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending} className="gap-2">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Trash2 className="h-4 w-4" />
              {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
