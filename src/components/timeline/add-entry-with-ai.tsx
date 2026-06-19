"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  addTimelineEntry,
  parseTimelineEntry,
  improveTimelineEntry,
} from "@/app/(dashboard)/timeline/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  caseId: string;
  /** Pre-fill the date field (e.g. the date of the section being expanded). */
  defaultDate?: string;
}

export function AddEntryWithAI({ caseId, defaultDate }: Props) {
  const t = useTranslations("timeline.addEntry");
  const tai = useTranslations("timeline.ai");
  const router = useRouter();

  const formRef = useRef<HTMLFormElement>(null);

  const [today, setToday] = useState(defaultDate ?? "");
  const [currentTime, setCurrentTime] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [date, setDate] = useState(defaultDate ?? "");
  const [time, setTime] = useState("");
  const [entry, setEntry] = useState("");
  const [location, setLocation] = useState("");

  const [pending, start] = useTransition();
  const [parsing, startParse] = useTransition();
  const [improving, startImprove] = useTransition();

  useEffect(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);
    if (!defaultDate) {
      setToday(todayStr);
      setDate(todayStr);
    }
    setCurrentTime(timeStr);
    setTime(timeStr);
  }, [defaultDate]);

  function handleParseWithAI() {
    if (!quickInput.trim()) return;
    startParse(async () => {
      const result = await parseTimelineEntry(quickInput, today || date);
      if (result.error && !result.entry) {
        toast.error(result.error);
        return;
      }
      if (result.time) setTime(result.time);
      if (result.date) setDate(result.date);
      if (result.entry) setEntry(result.entry);
      toast.success(tai("parseSuccess"));
    });
  }

  function handleImproveWithAI() {
    if (!entry.trim()) return;
    startImprove(async () => {
      const result = await improveTimelineEntry(entry);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.improved) setEntry(result.improved);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry.trim()) return;
    const formData = new FormData();
    formData.set("case_id", caseId);
    formData.set("entry_date", date || today);
    formData.set("entry_time", time || currentTime);
    formData.set("entry", entry);
    formData.set("location", location);
    start(async () => {
      const res = await addTimelineEntry(formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setQuickInput("");
      setEntry("");
      setLocation("");
      // Reset time to current
      const now = new Date();
      setTime(now.toTimeString().slice(0, 5));
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-dashed bg-card/50 p-4"
    >
      {/* Section A: Quick Entry */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{tai("quickEntry")}</p>
        <div className="flex gap-2">
          <Textarea
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={tai("quickEntryPlaceholder")}
            className="min-h-[56px] resize-none text-sm"
            disabled={parsing || pending}
            rows={2}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-auto shrink-0 gap-1 self-start text-xs"
            onClick={handleParseWithAI}
            disabled={parsing || pending || !quickInput.trim()}
          >
            {parsing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {parsing ? tai("parsing") : tai("parseWithAI")}
          </Button>
        </div>
      </div>

      {/* Section B: Form fields */}
      <div className="space-y-2 border-t pt-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-7 text-xs"
            disabled={pending}
            aria-label="Date"
          />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-7 text-xs"
            disabled={pending}
            aria-label="Time"
          />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="col-span-2 h-7 text-xs"
            disabled={pending}
            aria-label={t("locationPlaceholder")}
          />
        </div>

        <Textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder={t("entryPlaceholder")}
          required
          className="min-h-[70px] text-sm"
          disabled={pending}
        />

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={handleImproveWithAI}
            disabled={improving || pending || !entry.trim()}
          >
            {improving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {improving ? tai("improving") : tai("improveWithAI")}
          </Button>

          <Button type="submit" size="sm" disabled={pending || !entry.trim()} className="h-7 gap-1 text-xs">
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {t("addButton")}
          </Button>
        </div>
      </div>
    </form>
  );
}
