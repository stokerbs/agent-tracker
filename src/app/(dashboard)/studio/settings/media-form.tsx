"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSafeTransition } from "@/components/studio/use-safe-transition";
import { IMAGE_ASPECTS, type ImageAspect, type MediaPrefs } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { ASPECT_LABEL } from "../content/[id]/media-format";
import { updateMediaPrefs } from "./actions";

/** Mirrors the server zod limit (settings/actions.ts) — UX feedback only. */
const MAX_STYLE_CHARS = 1200;

export interface MediaFormProps {
  initial: MediaPrefs;
  /** Effective values when the field is left empty (env or system default) — shown as placeholders. */
  placeholders: { imageModel: string; ttsModel: string; voiceId: string };
}

/**
 * Media preferences: style preset, default aspect, model/voice overrides.
 * API keys are ENV-only by design — the status tiles above this form say so.
 * Server re-validates (zod) — the client limits are UX feedback only.
 */
export function MediaForm({ initial, placeholders }: MediaFormProps) {
  const [prefs, setPrefs] = useState<MediaPrefs>(initial);
  const [pending, start] = useSafeTransition();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  function set<K extends keyof MediaPrefs>(k: K, v: MediaPrefs[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
  }

  function save() {
    start(async () => {
      const res = await updateMediaPrefs({
        ...prefs,
        image_style: prefs.image_style.trim(),
        image_model: prefs.image_model.trim(),
        tts_voice_id: prefs.tts_voice_id.trim(),
        tts_model: prefs.tts_model.trim(),
      });
      if (res.ok) toast.success("บันทึกการตั้งค่าสื่อแล้ว");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="media-style">สไตล์ภาพ (นำหน้าทุก prompt ภาพ)</Label>
        <Textarea
          id="media-style"
          value={prefs.image_style}
          onChange={(e) => set("image_style", e.target.value.slice(0, MAX_STYLE_CHARS))}
          rows={4}
          maxLength={MAX_STYLE_CHARS}
          disabled={pending}
          placeholder="เช่น Cinematic documentary photography, dark navy and amber palette, Bangkok night, no text, no watermark"
          className="text-sm"
        />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>ระบบเติมข้อห้ามความปลอดภัยให้เองเสมอ (ไม่มีหน้าคนจริง / ทะเบียนรถ / ชื่อที่อ่านได้ / โลโก้บุคคลที่สาม)</span>
          <span className={cn("tabular-nums", prefs.image_style.length >= MAX_STYLE_CHARS && "text-amber-600 dark:text-amber-400")}>
            {prefs.image_style.length.toLocaleString("en-GB")}/{MAX_STYLE_CHARS.toLocaleString("en-GB")}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>สัดส่วนเริ่มต้น</Label>
          <Select value={prefs.default_aspect} onValueChange={(v) => set("default_aspect", v as ImageAspect)} disabled={pending}>
            <SelectTrigger className="h-9" aria-label="สัดส่วนเริ่มต้น">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_ASPECTS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ASPECT_LABEL[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">ค่าที่เลือกไว้ล่วงหน้าในปุ่ม “สร้างภาพ” — เปลี่ยนต่อภาพได้เสมอ</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-image-model">โมเดลภาพ (Gemini)</Label>
          <Input id="media-image-model" value={prefs.image_model} onChange={(e) => set("image_model", e.target.value)} placeholder={placeholders.imageModel} maxLength={80} disabled={pending} className="h-9 font-mono text-xs" autoComplete="off" spellCheck={false} />
          <p className="text-xs text-muted-foreground">เว้นว่าง = ใช้ค่าจาก ENV STUDIO_IMAGE_MODEL หรือค่าเริ่มต้นของระบบ</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-voice-id">Voice ID (ElevenLabs)</Label>
          <Input id="media-voice-id" value={prefs.tts_voice_id} onChange={(e) => set("tts_voice_id", e.target.value)} placeholder={placeholders.voiceId} maxLength={80} disabled={pending} className="h-9 font-mono text-xs" autoComplete="off" spellCheck={false} />
          <p className="text-xs text-muted-foreground">คัดลอกจาก ElevenLabs → Voices → ID · เว้นว่าง = เสียงเริ่มต้น (รองรับไทย)</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-tts-model">โมเดลเสียง</Label>
          <Input id="media-tts-model" value={prefs.tts_model} onChange={(e) => set("tts_model", e.target.value)} placeholder={placeholders.ttsModel} maxLength={80} disabled={pending} className="h-9 font-mono text-xs" autoComplete="off" spellCheck={false} />
          <p className="text-xs text-muted-foreground">ต้องเป็นโมเดลที่รองรับภาษาไทย เช่น eleven_multilingual_v2</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="text-xs text-muted-foreground">มีการแก้ไขที่ยังไม่บันทึก</span>}
        <Button onClick={save} disabled={pending || !dirty} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
