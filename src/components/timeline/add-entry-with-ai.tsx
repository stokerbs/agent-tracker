"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Loader2,
  Plus,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  addTimelineEntry,
  parseMultipleEntries,
  addMultipleTimelineEntries,
} from "@/app/(dashboard)/timeline/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bangkokDateKey } from "@/lib/utils";

interface Props {
  caseId: string;
  defaultDate?: string;
}

type ParsedEntry = { time: string; date: string; entry: string };
type Mode = "input" | "preview";

function todayBangkok(): string {
  return bangkokDateKey();
}

export function AddEntryWithAI({ caseId, defaultDate }: Props) {
  const t = useTranslations("timeline.addEntry");
  const tai = useTranslations("timeline.ai");
  const router = useRouter();

  const [today] = useState<string>(defaultDate ?? todayBangkok());
  const [rawInput, setRawInput] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayBangkok());
  const [location, setLocation] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const [mode, setMode] = useState<Mode>("input");
  const [parsed, setParsed] = useState<ParsedEntry[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editEntry, setEditEntry] = useState("");

  const [parsing, startParse] = useTransition();
  const [saving, startSave] = useTransition();
  const [addingDirect, startDirect] = useTransition();

  useEffect(() => {
    setCurrentTime(new Date().toTimeString().slice(0, 5));
  }, []);

  // ── Parse with AI → preview ────────────────────────────────────────────────
  function handleParse() {
    if (!rawInput.trim()) return;
    startParse(async () => {
      const result = await parseMultipleEntries(rawInput, date);
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

  // ── Add without AI (escape hatch) ─────────────────────────────────────────
  function handleAddDirect() {
    if (!rawInput.trim()) return;
    const fd = new FormData();
    fd.set("case_id", caseId);
    fd.set("entry_date", date || today);
    fd.set("entry_time", currentTime);
    fd.set("entry", rawInput.trim());
    fd.set("location", location);
    startDirect(async () => {
      const res = await addTimelineEntry(fd);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("toast.success"));
      setRawInput("");
      router.refresh();
    });
  }

  // ── Preview: reorder ───────────────────────────────────────────────────────
  function moveEntry(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= parsed.length) return;
    setParsed((prev) => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  // ── Preview: inline edit ───────────────────────────────────────────────────
  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditTime(parsed[idx].time);
    setEditEntry(parsed[idx].entry);
  }

  function commitEdit(idx: number) {
    setParsed((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, time: editTime, entry: editEntry } : p)),
    );
    setEditingIdx(null);
  }

  // ── Preview: remove ────────────────────────────────────────────────────────
  function removeEntry(idx: number) {
    setParsed((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Preview: save all ──────────────────────────────────────────────────────
  function handleSaveAll() {
    if (!parsed.length) return;
    startSave(async () => {
      const result = await addMultipleTimelineEntries(
        parsed.map((p) => ({
          caseId,
          date: p.date,
          time: p.time,
          entry: p.entry,
          location,
        })),
      );
      if (result.error) { toast.error(result.error); return; }
      toast.success(tai("saveSuccess", { count: result.count ?? parsed.length }));
      setRawInput("");
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
                    <Button type="button" size="sm" className="h-6 text-xs" onClick={() => commitEdit(idx)}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingIdx(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.time} · {p.date}
                    </span>
                    <span className="text-xs">{p.entry}</span>
                  </div>
                  {/* Reorder */}
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveEntry(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEntry(idx, 1)}
                      disabled={idx === parsed.length - 1}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-5 shrink-0 px-1.5 text-[10px] text-muted-foreground"
                    onClick={() => startEdit(idx)}
                  >
                    {tai("editEntry")}
                  </Button>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-5 shrink-0 px-1 text-[10px] text-muted-foreground hover:text-destructive"
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

        {/* Location override */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={parsed[0]?.date ?? date}
            onChange={(e) => {
              const d = e.target.value;
              setParsed((prev) => prev.map((p) => ({ ...p, date: d })));
            }}
            className="h-7 w-36 text-xs"
            aria-label="Override date for all entries"
          />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="flex-1 h-7 text-xs"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button" size="sm" variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => { setMode("input"); setEditingIdx(null); }}
            disabled={saving}
          >
            <ChevronLeft className="h-3 w-3" />
            {tai("back")}
          </Button>

          <Button
            type="button" size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleSaveAll}
            disabled={saving || !parsed.length}
          >
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin" />{tai("saving", { count: parsed.length })}</>
            ) : (
              <><Plus className="h-3 w-3" />{tai("saveAll", { count: parsed.length })}</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT MODE
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-3 rounded-lg border border-dashed bg-card/50 p-4">
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 w-36 text-xs"
          disabled={parsing || addingDirect}
          aria-label="Date"
        />
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t("locationPlaceholder")}
          className="flex-1 h-7 text-xs"
          disabled={parsing || addingDirect}
        />
      </div>

      <Textarea
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder={
          "10.15 เป้าหมายออกจากบ้าน\n11.20 เป้าหมายเข้าสตาร์บัค\n13.45 เป้าหมายกลับบ้าน"
        }
        className="min-h-[100px] text-sm"
        disabled={parsing || addingDirect}
        rows={5}
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-1.5 text-xs font-medium"
          onClick={handleParse}
          disabled={parsing || addingDirect || !rawInput.trim()}
        >
          {parsing ? (
            <><Loader2 className="h-3 w-3 animate-spin" />{tai("parsing")}</>
          ) : (
            <><Wand2 className="h-3 w-3" />✨ {tai("multiParse")}</>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground"
          onClick={handleAddDirect}
          disabled={addingDirect || parsing || !rawInput.trim()}
        >
          {addingDirect && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {tai("addWithoutAI")}
        </Button>
      </div>
    </div>
  );
}
