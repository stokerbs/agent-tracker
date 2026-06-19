"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, MapPin, Pencil, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  updateTimelineEntry,
  deleteTimelineEntry,
  improveTimelineEntry,
} from "@/app/(dashboard)/timeline/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LinkedEvidence, TimelineEntry } from "@/lib/types";

type EntryWithAgent = TimelineEntry & {
  agents?: { full_name: string; nickname?: string | null } | null;
};

interface Props {
  entry: EntryWithAgent;
  canEdit: boolean;
  linkedEvidence?: LinkedEvidence[];
}

export function TimelineEntryCard({ entry, canEdit, linkedEvidence }: Props) {
  const t = useTranslations("timeline.entry");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [improving, startImprove] = useTransition();
  const [editing, setEditing] = useState(false);

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

  if (editing) {
    return (
      <div className="ml-4 flex-1 rounded-lg border border-primary/40 bg-card p-3 ring-1 ring-primary/20">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-7 text-xs"
            disabled={pending}
          />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-7 text-xs"
            disabled={pending}
          />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="col-span-2 h-7 text-xs"
            disabled={pending}
          />
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2 min-h-[70px] text-sm"
          disabled={pending || improving}
        />
        <div className="mt-1 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={handleImprove}
            disabled={improving || pending}
          >
            {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Improve with AI
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={pending || improving || !text.trim()} className="h-7 gap-1 text-xs">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {t("save")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={pending} className="h-7 gap-1 text-xs">
            <X className="h-3 w-3" /> {t("cancel")}
          </Button>
          {isDirty && (
            <span className="text-[11px] text-amber-500">Unsaved changes</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ml-4 flex-1 rounded-lg border bg-card p-3 transition-colors hover:border-border group-hover:border-border/80">
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
          <p className="mt-1 text-sm">{entry.entry}</p>
          {entry.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {entry.location}
            </p>
          )}
          {entry.updated_at && (
            <p className="mt-1 text-[10px] text-muted-foreground/40 italic">edited</p>
          )}

          {/* Linked evidence thumbnails */}
          {linkedEvidence && linkedEvidence.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {linkedEvidence.map((ev) =>
                ev.mime_type?.startsWith("image/") && ev.signedUrl ? (
                  <a
                    key={ev.id}
                    href={ev.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-14 w-14 shrink-0 overflow-hidden rounded border hover:opacity-80"
                  >
                    <img
                      src={ev.signedUrl}
                      alt={ev.file_name ?? "Evidence"}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ) : (
                  <a
                    key={ev.id}
                    href={ev.signedUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded border bg-muted text-[9px] leading-tight text-muted-foreground hover:opacity-80"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="max-w-[52px] truncate px-1">{ev.file_name ?? "file"}</span>
                  </a>
                ),
              )}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setEditing(true)}
              disabled={pending}
              title={t("edit")}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={pending}
              title={t("delete")}
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
