"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPinPlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { addManualPing } from "@/app/(dashboard)/air-tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AIR_TAG_PING_NOTE_MAX,
  isLatInRange,
  isLngInRange,
  isPositiveIntString,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from "./air-tag-dialog-utils";

interface Props {
  airTagId: string;
}

/**
 * "Add Manual Ping" dialog — records one manually-observed position via
 * addManualPing. All client-side range/format checks below are UX feedback
 * only; the server action (parsePosition) re-validates bounds and rejects
 * future timestamps independently (Golden Rule 1).
 */
export function AddManualPingDialog({ airTagId }: Props) {
  const t = useTranslations("airTags.ping");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const nowLocal = () => toDatetimeLocalValue(new Date());
  const [recordedAt, setRecordedAt] = useState(nowLocal);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [accuracy, setAccuracy] = useState("");
  const [note, setNote] = useState("");

  const maxLocal = nowLocal();
  const latOk = isLatInRange(lat);
  const lngOk = isLngInRange(lng);
  const accuracyOk = isPositiveIntString(accuracy);
  const dateOk = (() => {
    const d = fromDatetimeLocalValue(recordedAt);
    return !!d && d.getTime() <= Date.now();
  })();
  const canSubmit = latOk && lngOk && accuracyOk && dateOk;

  function reset() {
    setRecordedAt(nowLocal());
    setLat("");
    setLng("");
    setAccuracy("");
    setNote("");
  }

  function handleSubmit() {
    const d = fromDatetimeLocalValue(recordedAt);
    if (!canSubmit || !d) {
      toast.error(t("errors.invalidForm"));
      return;
    }
    start(async () => {
      const res = await addManualPing({
        airTagId,
        lat: Number(lat),
        lng: Number(lng),
        recordedAt: d.toISOString(),
        accuracyM: accuracy.trim() ? Number(accuracy) : undefined,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("toast.success"));
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRecordedAt(nowLocal());
        else reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <MapPinPlus className="h-4 w-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinPlus className="h-4 w-4 text-sky-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & time — cannot be in the future */}
          <div className="space-y-1.5">
            <Label htmlFor="ping-recorded-at">{t("fields.recordedAt")}</Label>
            <Input
              id="ping-recorded-at"
              type="datetime-local"
              value={recordedAt}
              max={maxLocal}
              onChange={(e) => setRecordedAt(e.target.value)}
              required
            />
            <p className={cn("text-[11px]", dateOk ? "text-muted-foreground" : "text-destructive")}>
              {t("fields.recordedAtHint")}
            </p>
          </div>

          {/* Lat / Lng */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ping-lat">{t("fields.lat")}</Label>
              <Input
                id="ping-lat"
                inputMode="decimal"
                value={lat}
                placeholder="13.736717"
                onChange={(e) => setLat(e.target.value)}
                required
              />
              <p className={cn("text-[11px]", lat === "" || latOk ? "text-muted-foreground" : "text-destructive")}>
                {t("fields.latHint")}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ping-lng">{t("fields.lng")}</Label>
              <Input
                id="ping-lng"
                inputMode="decimal"
                value={lng}
                placeholder="100.523186"
                onChange={(e) => setLng(e.target.value)}
                required
              />
              <p className={cn("text-[11px]", lng === "" || lngOk ? "text-muted-foreground" : "text-destructive")}>
                {t("fields.lngHint")}
              </p>
            </div>
          </div>

          {/* Accuracy (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ping-accuracy">
              {t("fields.accuracy")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional")})</span>
            </Label>
            <Input
              id="ping-accuracy"
              inputMode="numeric"
              value={accuracy}
              placeholder={t("fields.accuracyPlaceholder")}
              onChange={(e) => setAccuracy(e.target.value)}
            />
            {!accuracyOk && (
              <p className="text-[11px] text-destructive">{t("fields.accuracyHint")}</p>
            )}
          </div>

          {/* Note (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ping-note">
              {t("fields.note")}
              <span className="ml-1 text-[10px] text-muted-foreground">({tCommon("optional")})</span>
            </Label>
            <Textarea
              id="ping-note"
              rows={2}
              value={note}
              maxLength={AIR_TAG_PING_NOTE_MAX}
              placeholder={t("fields.notePlaceholder")}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {note.length}/{AIR_TAG_PING_NOTE_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending || !canSubmit}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
