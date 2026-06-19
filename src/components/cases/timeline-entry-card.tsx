"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  updateTimelineEntry,
  deleteTimelineEntry,
  improveTimelineEntry,
} from "@/app/(dashboard)/timeline/actions";
import { uploadEvidence, deleteEvidence } from "@/app/(dashboard)/evidence/actions";
import { TimelineEvidenceGallery } from "@/components/timeline/timeline-evidence-gallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { LinkedEvidence, TimelineEntry } from "@/lib/types";

type EntryWithAgent = TimelineEntry & {
  agents?: { full_name: string; nickname?: string | null } | null;
};

interface Props {
  entry: EntryWithAgent;
  canEdit: boolean;
  isAdmin?: boolean;
  linkedEvidence?: LinkedEvidence[];
}

export function TimelineEntryCard({ entry, canEdit, isAdmin = false, linkedEvidence = [] }: Props) {
  const t = useTranslations("timeline.entry");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [improving, startImprove] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(entry.entry_date);
  const [time, setTime] = useState(entry.entry_time.slice(0, 5));
  const [text, setText] = useState(entry.entry);
  const [location, setLocation] = useState(entry.location ?? "");

  const isDirty =
    date !== entry.entry_date ||
    time !== entry.entry_time.slice(0, 5) ||
    text !== entry.entry ||
    location !== (entry.location ?? "");

  function handleCancel() {
    if (isDirty && !confirm(t("unsavedWarning"))) return;
    setDate(entry.entry_date);
    setTime(entry.entry_time.slice(0, 5));
    setText(entry.entry);
    setLocation(entry.location ?? "");
    setEditing(false);
  }

  function handleSave() {
    start(async () => {
      const res = await updateTimelineEntry(entry.id, entry.case_id, {
        entry_date: date,
        entry_time: time,
        entry: text,
        location: location || null,
      });
      if (res?.error) { toast.error(t("toast.saveError")); return; }
      toast.success(t("toast.saved"));
      setEditing(false);
      router.refresh();
    });
  }

  function handleImprove() {
    if (!text.trim()) return;
    startImprove(async () => {
      const res = await improveTimelineEntry(text);
      if (res.error) { toast.error(res.error); return; }
      if (res.improved) setText(res.improved);
    });
  }

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    start(async () => {
      const res = await deleteTimelineEntry(entry.id, entry.case_id);
      if (res?.error) { toast.error(t("toast.deleteError")); return; }
      toast.success(t("toast.deleted"));
      router.refresh();
    });
  }

  function handleAttachFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    startUpload(async () => {
      const results = await Promise.all(
        files.map((f) => {
          const fd = new FormData();
          fd.set("case_id", entry.case_id);
          fd.set("file", f);
          fd.set("timeline_entry_id", entry.id);
          return uploadEvidence(fd);
        }),
      );
      const failed = results.filter((r) => r?.error).length;
      if (failed > 0) {
        toast.warning(`${files.length - failed} file(s) attached, ${failed} failed.`);
      } else {
        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} attached`);
      }
      router.refresh();
    });
  }

  function handleDeleteEvidence(evidenceId: string, fileName: string | null) {
    if (!confirm(`Delete "${fileName ?? "file"}"?`)) return;
    startUpload(async () => {
      const res = await deleteEvidence(evidenceId);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Attachment removed");
      router.refresh();
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    handleAttachFiles(e.dataTransfer.files);
  }

  // ── EDIT MODE ────────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div
        className={cn(
          "ml-4 flex-1 rounded-lg border border-primary/40 bg-card p-3 ring-1 ring-primary/20 transition-colors",
          isDragOver && "border-primary ring-primary/50 bg-primary/5",
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Date / time / location */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 text-xs" disabled={pending} />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-7 text-xs" disabled={pending} />
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="col-span-2 h-7 text-xs" disabled={pending} />
        </div>

        {/* Textarea — also acts as drop target */}
        <div className="relative mt-2">
          {isDragOver && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/5">
              <span className="text-sm font-medium text-primary">Drop files here</span>
            </div>
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[70px] text-sm"
            disabled={pending || improving}
          />
        </div>

        {/* AI improve */}
        <div className="mt-1 flex items-center gap-2">
          <Button
            type="button" size="sm" variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={handleImprove}
            disabled={improving || pending}
          >
            {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Improve with AI
          </Button>
        </div>

        {/* ── Existing attachments ── */}
        {linkedEvidence.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Attachments ({linkedEvidence.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {linkedEvidence.map((ev) => (
                <div key={ev.id} className="relative">
                  {ev.type === "photo" && ev.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.signedUrl}
                      alt={ev.file_name ?? ""}
                      className="h-14 w-14 rounded-md border object-cover"
                    />
                  ) : ev.type === "video" ? (
                    <div className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md border bg-violet-500/10 text-[9px] text-violet-400">
                      <Film className="h-4 w-4" />
                      <span className="max-w-[52px] truncate px-1">{ev.file_name}</span>
                    </div>
                  ) : (
                    <div className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-md border bg-muted text-[9px] text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span className="max-w-[52px] truncate px-1">{ev.file_name}</span>
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvidence(ev.id, ev.file_name)}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:opacity-80"
                      aria-label="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Upload buttons ── */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Add:</span>

          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
          >
            <ImageIcon className="h-3 w-3" /> Photos
          </button>

          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-400 hover:bg-violet-500/20 disabled:opacity-50"
          >
            <Film className="h-3 w-3" /> Videos
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded-md border border-slate-500/30 bg-slate-500/10 px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-500/20 disabled:opacity-50"
          >
            <Paperclip className="h-3 w-3" /> Files
          </button>

          {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}

          <p className="w-full text-[10px] text-muted-foreground/60 mt-0.5">
            Or drag & drop files anywhere above
          </p>
        </div>

        {/* Hidden file inputs */}
        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
          onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = ""; }} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" multiple className="sr-only"
          onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="sr-only"
          onChange={(e) => { handleAttachFiles(e.target.files); e.target.value = ""; }} />

        {/* Save / Cancel */}
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={pending || improving || !text.trim()} className="h-7 gap-1 text-xs">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {t("save")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={pending} className="h-7 gap-1 text-xs">
            <X className="h-3 w-3" /> {t("cancel")}
          </Button>
          {isDirty && <span className="text-[11px] text-amber-500">Unsaved changes</span>}
        </div>
      </div>
    );
  }

  // ── VIEW MODE ────────────────────────────────────────────────────────────────
  return (
    <div className="ml-4 flex-1 rounded-lg border bg-card p-2 sm:p-3 transition-colors hover:border-border group-hover:border-border/80">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              {entry.entry_date} · {entry.entry_time.slice(0, 5)}
            </p>
            <span className="text-xs text-muted-foreground/60">
              {entry.agents?.full_name ?? "Agent"}
            </span>
          </div>
          {/* Tap-to-expand on mobile; full text on sm+ */}
          <button
            type="button"
            className="mt-1 block w-full text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            <p className={cn("text-sm", !expanded && "line-clamp-3 sm:line-clamp-none")}>
              {entry.entry}
            </p>
          </button>
          {entry.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {entry.location}
            </p>
          )}
          {entry.updated_at && (
            <p className="mt-1 text-[10px] text-muted-foreground/40 italic">edited</p>
          )}

          {/* Evidence gallery */}
          <TimelineEvidenceGallery items={linkedEvidence} />
        </div>

        {canEdit && (
          <div className="flex shrink-0 gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
            <Button
              size="icon" variant="ghost" className="h-6 w-6"
              onClick={() => setEditing(true)} disabled={pending} title={t("edit")}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon" variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleDelete} disabled={pending} title={t("delete")}
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
