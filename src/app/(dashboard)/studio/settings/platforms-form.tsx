"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PLATFORM_META, PLATFORMS } from "@/lib/studio/constants";
import { PlatformChip } from "@/components/studio/badges";
import { cn } from "@/lib/utils";
import { updateDefaultPlatforms } from "./actions";

export function PlatformsForm({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [pending, start] = useTransition();

  function toggle(p: string, on: boolean) {
    setSelected((cur) => (on ? Array.from(new Set([...cur, p])) : cur.filter((x) => x !== p)));
  }

  function save() {
    start(async () => {
      try {
        const res = await updateDefaultPlatforms({ platforms: selected });
        if (res.ok) toast.success("บันทึกแพลตฟอร์มเริ่มต้นแล้ว");
        else toast.error(res.error);
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {PLATFORMS.map((p) => {
          const on = selected.includes(p);
          const meta = PLATFORM_META[p];
          return (
            <label
              key={p}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                on ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/40",
                pending && "pointer-events-none opacity-60",
              )}
            >
              <Checkbox checked={on} onCheckedChange={(v) => toggle(p, v === true)} disabled={pending} />
              <div className="min-w-0 flex-1">
                <PlatformChip platform={p} />
                {meta.maxCaption && <p className="mt-1 text-[11px] text-muted-foreground">แคปชันสูงสุด {meta.maxCaption.toLocaleString("en-GB")} ตัวอักษร</p>}
              </div>
            </label>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">เลือกแล้ว {selected.length} แพลตฟอร์ม — ใช้เป็นค่าเริ่มต้นเมื่อสร้างไอเดีย/คอนเทนต์ใหม่</p>
        <Button onClick={save} disabled={pending || selected.length === 0} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
