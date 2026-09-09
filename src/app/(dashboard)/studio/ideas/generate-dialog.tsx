"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clapperboard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLATFORM_META, PLATFORMS, VIDEO_PLATFORMS } from "@/lib/studio/constants";
import type { Idea, Platform, TargetDuration } from "@/lib/studio/types";
import { TARGET_DURATIONS } from "@/lib/studio/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateContentFromIdea } from "./actions";

/**
 * "สร้างคอนเทนต์" — pick platform + target duration, then create the draft and
 * jump into the editor. Generation takes 20–60 s; the dialog stays open with a
 * progress line until the server action returns.
 */
export function GenerateContentDialog({ open, onOpenChange, idea, aiAvailable }: { open: boolean; onOpenChange: (open: boolean) => void; idea: Idea; aiAvailable: boolean }) {
  const router = useRouter();
  const ideaPlatforms = (idea.platforms ?? []).filter((p): p is Platform => (PLATFORMS as string[]).includes(p));
  const options: Platform[] = ideaPlatforms.length ? ideaPlatforms : PLATFORMS;
  const [platform, setPlatform] = useState<Platform>(options[0] ?? "tiktok");
  const [seconds, setSeconds] = useState<TargetDuration>(45);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setPlatform(options[0] ?? "tiktok");
      setSeconds(45);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idea.id]);

  const isVideo = VIDEO_PLATFORMS.includes(platform);

  function run() {
    setError(null);
    start(async () => {
      const res = await generateContentFromIdea({ ideaId: idea.id, platform, targetSeconds: seconds });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data.aiError) {
        toast.warning("สร้างร่างแล้ว แต่ AI เขียนสคริปต์ไม่สำเร็จ — เขียนเองหรือลองสร้างใหม่ในตัวแก้ไข", { description: res.data.aiError, duration: 8000 });
      } else {
        toast.success("สร้างร่างคอนเทนต์พร้อมสคริปต์แล้ว");
      }
      onOpenChange(false);
      router.push(`/studio/content/${res.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-primary" /> สร้างคอนเทนต์จากไอเดีย
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{idea.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>แพลตฟอร์มหลัก</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)} disabled={pending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PLATFORM_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!ideaPlatforms.length && <p className="text-[11px] text-muted-foreground">ไอเดียนี้ยังไม่ระบุแพลตฟอร์ม — เลือกได้ทั้งหมด</p>}
          </div>

          <div className="space-y-1.5">
            <Label>ความยาวเป้าหมาย {isVideo ? "(วิดีโอ)" : "(ใช้กะปริมาณเนื้อหา)"}</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {TARGET_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={pending}
                  onClick={() => setSeconds(d)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-sm transition-colors",
                    seconds === d ? "border-primary bg-primary/10 font-medium text-primary" : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {d} วิ
                </button>
              ))}
            </div>
          </div>

          {!aiAvailable && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              AI ยังใช้งานไม่ได้ — จะสร้างร่างว่างจากไอเดียนี้ให้เขียนสคริปต์เองในตัวแก้ไข
            </p>
          )}

          {pending && (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {aiAvailable ? "กำลังเขียนสคริปต์… (20–60 วิ)" : "กำลังสร้างร่าง…"}
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{error}</span>
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={run} disabled={pending}>
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="mr-1.5 h-3.5 w-3.5" />}
              {aiAvailable ? "เขียนสคริปต์และเปิดตัวแก้ไข" : "สร้างร่างและเปิดตัวแก้ไข"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
