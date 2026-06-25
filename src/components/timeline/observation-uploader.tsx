"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { addTimelineEntry } from "@/app/(dashboard)/timeline/actions";
import { uploadEvidence } from "@/app/(dashboard)/evidence/actions";
import { AddEntryWithAI } from "@/components/timeline/add-entry-with-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bangkokDateKey, cn } from "@/lib/utils";

interface Props {
  caseId: string;
  defaultDate?: string;
  onSuccess?: () => void;
}

type FilePreview = {
  file: File;
  previewUrl: string | null;
  kind: "photo" | "video" | "file";
};

function todayBangkok(): string {
  return bangkokDateKey();
}

function nowBangkok(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindForFile(file: File): FilePreview["kind"] {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function ObservationUploader({ caseId, defaultDate, onSuccess }: Props) {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"single" | "multi">("single");
  const [date, setDate] = useState(defaultDate ?? todayBangkok());
  const [time, setTime] = useState(() => nowBangkok());
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [saving, startSave] = useTransition();

  function addFiles(list: FileList | null) {
    if (!list) return;
    const previews: FilePreview[] = [];
    for (const f of Array.from(list)) {
      previews.push({
        file: f,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        kind: kindForFile(f),
      });
    }
    setFiles((prev) => [...prev, ...previews]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const p = prev[idx];
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function handleSave() {
    if (!description.trim()) return;
    startSave(async () => {
      const fd = new FormData();
      fd.set("case_id", caseId);
      fd.set("entry_date", date);
      fd.set("entry_time", time);
      fd.set("entry", description.trim());
      fd.set("location", location);

      const entryRes = await addTimelineEntry(fd);
      if (entryRes?.error) { toast.error(entryRes.error); return; }

      if (files.length > 0 && entryRes.id) {
        const uploadResults = await Promise.all(
          files.map(({ file }) => {
            const efd = new FormData();
            efd.set("case_id", caseId);
            efd.set("file", file);
            efd.set("timeline_entry_id", entryRes.id!);
            return uploadEvidence(efd);
          }),
        );
        const failed = uploadResults.filter((r) => r?.error).length;
        if (failed > 0) {
          toast.warning(`Observation saved. ${failed} file(s) failed to upload.`);
        } else {
          toast.success(`Observation saved with ${files.length} file${files.length > 1 ? "s" : ""}`);
        }
      } else {
        toast.success("Observation saved");
      }

      files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      setDescription("");
      setLocation("");
      setFiles([]);
      onSuccess?.();
      router.refresh();
    });
  }

  if (mode === "multi") {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setMode("single")}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          ← Single observation
        </button>
        <AddEntryWithAI caseId={caseId} defaultDate={defaultDate} />
      </div>
    );
  }

  const photos = files.filter((f) => f.kind === "photo");
  const videos = files.filter((f) => f.kind === "video");
  const docs   = files.filter((f) => f.kind === "file");

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-card/50 p-4">
      {/* Date / Time / Location */}
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 w-36 text-xs" disabled={saving} />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-7 w-28 text-xs" disabled={saving} />
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="h-7 min-w-[100px] flex-1 text-xs"
          disabled={saving}
        />
      </div>

      {/* Drop zone + textarea */}
      <div
        className={cn(
          "relative rounded-md border transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-transparent",
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary">
            <span className="text-sm font-medium text-primary">Drop files here</span>
          </div>
        )}
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={"10.15 เป้าหมายออกจากบ้าน"}
          className="min-h-[72px] text-sm border-0 focus-visible:ring-0 bg-transparent"
          disabled={saving}
          rows={3}
        />
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, idx) => (
            <div key={idx} className="relative">
              {f.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.previewUrl} alt={f.file.name} className="h-16 w-16 rounded-md border object-cover" />
              ) : f.kind === "video" ? (
                <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border bg-violet-500/10 text-[9px] text-violet-400">
                  <Film className="h-4 w-4" />
                  <span className="max-w-[56px] truncate px-1">{f.file.name}</span>
                </div>
              ) : (
                <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-md border bg-muted text-[9px] text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  <span className="max-w-[56px] truncate px-1">{f.file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:opacity-80"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Upload buttons */}
        <button
          type="button"
          onClick={() => { photoInputRef.current?.click(); }}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
        >
          <ImageIcon className="h-3 w-3" />
          {photos.length > 0 ? `${photos.length} Photo${photos.length > 1 ? "s" : ""}` : "Photos"}
        </button>

        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-400 hover:bg-violet-500/20 disabled:opacity-50"
        >
          <Film className="h-3 w-3" />
          {videos.length > 0 ? `${videos.length} Video${videos.length > 1 ? "s" : ""}` : "Videos"}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md border border-slate-500/30 bg-slate-500/10 px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-500/20 disabled:opacity-50"
        >
          <Paperclip className="h-3 w-3" />
          {docs.length > 0 ? `${docs.length} File${docs.length > 1 ? "s" : ""}` : "Files"}
        </button>

        {/* Hidden inputs */}
        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
          onChange={(e) => { addFiles(e.target.files); if (photoInputRef.current) photoInputRef.current.value = ""; }} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" multiple className="sr-only"
          onChange={(e) => { addFiles(e.target.files); if (videoInputRef.current) videoInputRef.current.value = ""; }} />
        <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="sr-only"
          onChange={(e) => { addFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }} />

        {/* Multi-entry toggle + save */}
        <button
          type="button"
          onClick={() => setMode("multi")}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
        >
          Multi-entry →
        </button>

        <Button
          type="button" size="sm" className="h-8 gap-1.5 text-xs"
          onClick={handleSave}
          disabled={saving || !description.trim()}
        >
          {saving ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Saving…</>
          ) : (
            <><Plus className="h-3 w-3" />Save</>
          )}
        </Button>
      </div>

      {files.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          Drag & drop also supported — drop anywhere in this form
        </p>
      )}
    </div>
  );
}
