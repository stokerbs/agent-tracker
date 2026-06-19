"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileText,
  Loader2,
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

interface Props {
  caseId: string;
  defaultDate?: string;
}

type FilePreview = { file: File; previewUrl: string | null };

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function nowBangkok(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ObservationUploader({ caseId, defaultDate }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"single" | "multi">("single");
  const [date, setDate] = useState(defaultDate ?? todayBangkok());
  const [time, setTime] = useState(() => nowBangkok());
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [saving, startSave] = useTransition();

  function addFiles(list: FileList | null) {
    if (!list) return;
    const previews: FilePreview[] = [];
    for (const f of Array.from(list)) {
      previews.push({
        file: f,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      });
    }
    setFiles((prev) => [...prev, ...previews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const p = prev[idx];
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
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
      if (entryRes?.error) {
        toast.error(entryRes.error);
        return;
      }

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
          toast.success(`Observation saved with ${files.length} file(s)`);
        }
      } else {
        toast.success("Observation saved");
      }

      files.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
      setDescription("");
      setLocation("");
      setFiles([]);
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

  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-card/50 p-4">
      {/* Date / Time / Location */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 w-36 text-xs"
          disabled={saving}
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-7 w-28 text-xs"
          disabled={saving}
        />
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="h-7 min-w-[100px] flex-1 text-xs"
          disabled={saving}
        />
      </div>

      {/* Description */}
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={"10.15 เป้าหมายออกจากบ้าน\n13.45 เป้าหมายกลับบ้าน"}
        className="min-h-[72px] text-sm"
        disabled={saving}
        rows={3}
      />

      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, idx) => (
            <div key={idx} className="relative">
              {f.previewUrl ? (
                <img
                  src={f.previewUrl}
                  alt={f.file.name}
                  className="h-16 w-16 rounded border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded border bg-muted text-[9px] leading-tight text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="max-w-[56px] truncate px-1">{f.file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={saving}
        >
          <Camera className="h-3.5 w-3.5" />
          {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "Add Photos"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />

        <button
          type="button"
          onClick={() => setMode("multi")}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
        >
          Paste multiple entries →
        </button>

        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleSave}
          disabled={saving || !description.trim()}
        >
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
