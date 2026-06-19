"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Sparkles, Wand2, X, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  addTimelineEntry,
  parseTimelineEntry,
  improveTimelineEntry,
  parseMultipleEntries,
  addMultipleTimelineEntries,
} from "@/app/(dashboard)/timeline/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  caseId: string;
  /** Pre-fill the date field (e.g. the date of the section being expanded). */
  defaultDate?: string;
}

type ParsedEntry = { time: string; date: string; entry: string };
type Mode = "input" | "preview";

function todayBangkok(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function AddEntryWithAI({ caseId, defaultDate }: Props) {
  const t = useTranslations("timeline.addEntry");
  const tai = useTranslations("timeline.ai");
  const router = useRouter();

  // ── Input mode state ──────────────────────────────────────────────────────
  const [today] = useState<string>(defaultDate ?? todayBangkok());
  const [currentTime, setCurrentTime] = useState("");
  const [quickInput, setQuickInput] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayBangkok());
  const [time, setTime] = useState("");
  const [entry, setEntry] = useState("");
  const [location, setLocation] = useState("");

  // ── Multi-entry mode state ────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("input");
  const [parsed, setParsed] = useState<ParsedEntry[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editEntry, setEditEntry] = useState("");

  // ── Transitions ───────────────────────────────────────────────────────────
  const [pending, startPending] = useTransition();
  const [parsing, startParse] = useTransition();
  const [multiParsing, startMultiParse] = useTransition();
  const [saving, startSave] = useTransition();
  const [improving, startImprove] = useTransition();

  useEffect(() => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    setCurrentTime(timeStr);
    setTime(timeStr);
  }, []);

  // ── Single-entry parse (existing "Parse with AI" for the lower form) ──────
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

  // ── Multi-entry parse → switch to preview mode ────────────────────────────
  function handleMultiParseWithAI() {
    if (!quickInput.trim()) return;
    startMultiParse(async () => {
      const result = await parseMultipleEntries(quickInput, date);
      if (result.error && !result.entries) {
        toast.error(result.error);
        return;
      }
      const entries = result.entries ?? [];
      if (!entries.length) {
        toast.error("No entries detected");
        return;
      }
      setParsed(entries);
      setMode("preview");
    });
  }

  // ── Add without AI (single entry, whole raw text) ─────────────────────────
  function handleAddWithoutAI() {
    if (!quickInput.trim()) return;
    const formData = new FormData();
    formData.set("case_id", caseId);
    formData.set("entry_date", date || today);
    formData.set("entry_time", currentTime || time);
    formData.set("entry", quickInput.trim());
    formData.set("location", location);
    startPending(async () => {
      const res = await addTimelineEntry(formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setQuickInput("");
      router.refresh();
    });
  }

  // ── Improve entry text with AI ────────────────────────────────────────────
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

  // ── Single-entry form submit ──────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry.trim()) return;
    const formData = new FormData();
    formData.set("case_id", caseId);
    formData.set("entry_date", date || today);
    formData.set("entry_time", time || currentTime);
    formData.set("entry", entry);
    formData.set("location", location);
    startPending(async () => {
      const res = await addTimelineEntry(formData);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setQuickInput("");
      setEntry("");
      setLocation("");
      const now = new Date();
      setTime(now.toTimeString().slice(0, 5));
      router.refresh();
    });
  }

  // ── Preview mode: remove entry ────────────────────────────────────────────
  function removeEntry(idx: number) {
    setParsed((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Preview mode: start editing a row ────────────────────────────────────
  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditTime(parsed[idx].time);
    setEditEntry(parsed[idx].entry);
  }

  // ── Preview mode: save inline edit ───────────────────────────────────────
  function commitEdit(idx: number) {
    setParsed((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, time: editTime, entry: editEntry } : p,
      ),
    );
    setEditingIdx(null);
  }

  // ── Preview mode: save all entries ───────────────────────────────────────
  function handleSaveAll() {
    if (!parsed.length) return;
    startSave(async () => {
      const result = await addMultipleTimelineEntries(
        parsed.map((p) => ({
          caseId,
          date: p.date,
          time: p.time,
          entry: p.entry,
          location: location,
        })),
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(tai("saveSuccess", { count: result.count ?? parsed.length }));
      setQuickInput("");
      setEntry("");
      setLocation("");
      setParsed([]);
      setMode("input");
      router.refresh();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (mode === "preview") {
    return (
      <div className="space-y-3 rounded-lg border border-dashed bg-card/50 p-4">
        <p className="text-xs font-medium text-muted-foreground">
          {tai("detected", { count: parsed.length })}
        </p>

        <div className="space-y-2">
          {parsed.map((p, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-md border border-border/50 bg-background px-3 py-2"
            >
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />

              {editingIdx === idx ? (
                <div className="flex flex-1 flex-col gap-1.5">
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-6 w-24 text-xs"
                  />
                  <Textarea
                    value={editEntry}
                    onChange={(e) => setEditEntry(e.target.value)}
                    className="min-h-[48px] text-xs"
                    rows={2}
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="h-6 text-xs"
                      onClick={() => commitEdit(idx)}
                    >
                      {tai("save") || "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs"
                      onClick={() => setEditingIdx(null)}
                    >
                      {tai("cancel") || "Cancel"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {p.time}
                  </span>
                  <span className="flex-1 text-xs">{p.entry}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1.5 text-[10px] text-muted-foreground"
                    onClick={() => startEdit(idx)}
                    aria-label={tai("editEntry")}
                  >
                    {tai("editEntry")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-5 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => removeEntry(idx)}
                    aria-label={tai("removeEntry")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={parsed[0]?.date ?? date}
            onChange={(e) => {
              const newDate = e.target.value;
              setParsed((prev) => prev.map((p) => ({ ...p, date: newDate })));
            }}
            className="h-7 w-36 text-xs"
            aria-label="Date"
          />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="flex-1 h-7 text-xs"
            aria-label={t("locationPlaceholder")}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => { setMode("input"); setEditingIdx(null); }}
            disabled={saving}
          >
            <ChevronLeft className="h-3 w-3" />
            {tai("back")}
          </Button>

          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleSaveAll}
            disabled={saving || !parsed.length}
          >
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {tai("saving", { count: parsed.length })}
              </>
            ) : (
              <>
                <Plus className="h-3 w-3" />
                {tai("saveAll", { count: parsed.length })}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT MODE (default)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-dashed bg-card/50 p-4"
    >
      {/* Section A: Multi-entry quick input */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">{tai("quickEntry")}</p>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-7 w-36 text-xs"
            disabled={multiParsing || pending}
            aria-label="Date"
          />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="flex-1 h-7 text-xs"
            disabled={multiParsing || pending}
            aria-label={t("locationPlaceholder")}
          />
        </div>

        <Textarea
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          placeholder={"10.15 Target left residence\n11.20 Target at Starbucks\n13.45 Target returned home"}
          className="min-h-[80px] text-sm"
          disabled={multiParsing || pending}
          rows={5}
        />

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1 text-xs"
            onClick={handleMultiParseWithAI}
            disabled={multiParsing || pending || !quickInput.trim()}
          >
            {multiParsing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {multiParsing ? tai("parsing") : tai("multiParse")}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleAddWithoutAI}
            disabled={pending || multiParsing || !quickInput.trim()}
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            {tai("addWithoutAI")}
          </Button>
        </div>
      </div>

      {/* Section B: Single-entry form fields */}
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">{tai("quickEntry")} — {tai("preview")}</p>

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

        <div className="flex gap-2">
          <Textarea
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder={tai("quickEntryPlaceholder")}
            className="min-h-[40px] resize-none text-xs"
            disabled={multiParsing || pending}
            rows={1}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-auto shrink-0 gap-1 self-start text-xs"
            onClick={handleMultiParseWithAI}
            disabled={multiParsing || pending || !quickInput.trim()}
          >
            {multiParsing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            {multiParsing ? tai("parsing") : tai("parseWithAI")}
          </Button>
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
