"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createAirTagTracker } from "@/app/(dashboard)/air-tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AIR_TAG_LABEL_MAX,
  AIR_TAG_SERIAL_MAX,
  AIR_TAG_TRACKER_NOTES_MAX,
} from "./air-tag-dialog-utils";

interface Props {
  caseId: string;
  /** Optional — invoked after a successful create, in addition to the default router.refresh(). */
  onCreated?: (id: string) => void;
}

/**
 * "Add AirTag" dialog — creates a new air_tag_trackers row on this case via
 * createAirTagTracker. Client-side length checks below are a UX nicety only;
 * the server action re-validates independently (Golden Rule 1).
 */
export function CreateAirTagDialog({ caseId, onCreated }: Props) {
  const t = useTranslations("airTags.create");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [label, setLabel] = useState("");
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");

  const labelValid = label.trim().length > 0 && label.trim().length <= AIR_TAG_LABEL_MAX;

  function reset() {
    setLabel("");
    setSerial("");
    setNotes("");
  }

  function handleSubmit() {
    if (!labelValid) {
      toast.error(t("fields.labelRequired"));
      return;
    }
    start(async () => {
      const res = await createAirTagTracker({
        caseId,
        label: label.trim(),
        appleSerial: serial.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setOpen(false);
      reset();
      router.refresh();
      onCreated?.(res.id);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-sky-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="airtag-label">{t("fields.label")}</Label>
            <Input
              id="airtag-label"
              value={label}
              maxLength={AIR_TAG_LABEL_MAX}
              placeholder={t("fields.labelPlaceholder")}
              onChange={(e) => setLabel(e.target.value)}
              required
              autoFocus
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {label.length}/{AIR_TAG_LABEL_MAX}
            </p>
          </div>

          {/* Apple serial (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="airtag-serial">
              {t("fields.serial")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional")})</span>
            </Label>
            <Input
              id="airtag-serial"
              value={serial}
              maxLength={AIR_TAG_SERIAL_MAX}
              placeholder={t("fields.serialPlaceholder")}
              onChange={(e) => setSerial(e.target.value)}
            />
          </div>

          {/* Notes (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="airtag-notes">
              {t("fields.notes")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional")})</span>
            </Label>
            <Textarea
              id="airtag-notes"
              rows={3}
              value={notes}
              maxLength={AIR_TAG_TRACKER_NOTES_MAX}
              placeholder={t("fields.notesPlaceholder")}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {notes.length}/{AIR_TAG_TRACKER_NOTES_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending || !labelValid}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
