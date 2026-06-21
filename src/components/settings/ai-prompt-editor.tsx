"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, History, Loader2, RotateCcw, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  saveAiPrompt,
  resetAiPromptToDefault,
  restoreAiPromptVersion,
} from "@/app/(dashboard)/settings/ai-prompts/actions";
import type { AiPrompt, AiPromptVersion } from "@/lib/ai-prompts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function VersionHistory({
  versions,
  onRestore,
  pending,
}: {
  versions: AiPromptVersion[];
  onRestore: (text: string) => void;
  pending: boolean;
}) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  if (!versions.length) return null;

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          {t("promptEditor.versionHistory")}
          <Badge variant="secondary" className="text-[10px]">{versions.length}</Badge>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y divide-border/40 border-t border-border/60">
          {versions.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] text-muted-foreground">{formatDate(v.saved_at)}</p>
                <p className="mt-1 line-clamp-2 text-xs text-foreground/70">{v.prompt_text.slice(0, 120)}…</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="h-7 shrink-0 text-xs"
                onClick={() => onRestore(v.prompt_text)}
              >
                {t("promptEditor.restore")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AiPromptEditor({
  prompt,
  versions,
}: {
  prompt: AiPrompt;
  versions: AiPromptVersion[];
}) {
  const t = useTranslations("settings");
  const [text, setText] = useState(prompt.prompt_text);
  const [pending, start] = useTransition();
  const isDirty = text !== prompt.prompt_text;

  function handleSave() {
    start(async () => {
      const res = await saveAiPrompt(prompt.id, text);
      if (res?.error) { toast.error(res.error); return; }
      toast.success(t("promptEditor.savedToast"));
    });
  }

  function handleReset() {
    if (!window.confirm(t("promptEditor.resetConfirm"))) return;
    start(async () => {
      const res = await resetAiPromptToDefault(prompt.id);
      if (res?.error) { toast.error(res.error); return; }
      setText(prompt.default_text);
      toast.success(t("promptEditor.resetToast"));
    });
  }

  function handleRestore(versionText: string) {
    if (!window.confirm(t("promptEditor.restoreConfirm"))) return;
    start(async () => {
      const res = await restoreAiPromptVersion(prompt.id, versionText);
      if (res?.error) { toast.error(res.error); return; }
      setText(versionText);
      toast.success(t("promptEditor.restoreToast"));
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{prompt.name}</p>
            {prompt.description && (
              <p className="text-xs text-muted-foreground">{prompt.description}</p>
            )}
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">{prompt.prompt_key}</Badge>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[260px] font-mono text-xs leading-relaxed"
        placeholder={t("promptEditor.placeholder")}
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={pending || !isDirty}
          className="gap-1.5"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("promptEditor.saveButton")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={pending || text === prompt.default_text}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("promptEditor.resetButton")}
        </Button>
        {isDirty && (
          <span className="text-xs text-amber-500">{t("promptEditor.unsavedChanges")}</span>
        )}
      </div>

      <VersionHistory versions={versions} onRestore={handleRestore} pending={pending} />
    </div>
  );
}
