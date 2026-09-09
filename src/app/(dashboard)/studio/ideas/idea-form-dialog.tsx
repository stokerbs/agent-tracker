"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FORMAT_META, PILLAR_META, PILLARS, PLATFORM_META, PLATFORMS } from "@/lib/studio/constants";
import type { ContentFormat, Idea, Pillar, Platform } from "@/lib/studio/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createOwnerIdea, updateIdea } from "./actions";

const FORMATS = Object.keys(FORMAT_META) as ContentFormat[];
const NONE = "__none__";

interface FormState {
  title: string;
  hook: string;
  description: string;
  pillar: Pillar;
  platforms: Platform[];
  format: ContentFormat | null;
  tags: string;
}

function fromIdea(idea: Idea | null): FormState {
  return {
    title: idea?.title ?? "",
    hook: idea?.hook ?? "",
    description: idea?.description ?? "",
    pillar: (idea?.pillar as Pillar) ?? "detective_knowledge",
    platforms: (idea?.platforms ?? []).filter((p): p is Platform => (PLATFORMS as string[]).includes(p)),
    format: (idea?.format as ContentFormat | null) ?? null,
    tags: (idea?.tags ?? []).join(", "),
  };
}

/**
 * Add ("เพิ่มไอเดียเอง") / edit ("แก้ไข") dialog. Pass `idea` to edit; omit to create
 * an owner-authored idea (origin 'owner', status 'saved').
 */
export function IdeaFormDialog({
  open,
  onOpenChange,
  idea = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea?: Idea | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => fromIdea(idea));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!idea;

  useEffect(() => {
    if (open) {
      setForm(fromIdea(idea));
      setError(null);
    }
  }, [open, idea]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function togglePlatform(p: Platform, checked: boolean) {
    setForm((f) => ({ ...f, platforms: checked ? Array.from(new Set([...f.platforms, p])) : f.platforms.filter((x) => x !== p) }));
  }

  function submit() {
    const payload = {
      title: form.title,
      hook: form.hook,
      description: form.description,
      pillar: form.pillar,
      platforms: form.platforms,
      format: form.format,
      tags: form.tags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
    };
    setError(null);
    start(async () => {
      const res = editing ? await updateIdea({ id: idea!.id, ...payload }) : await createOwnerIdea(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(editing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มไอเดียแล้ว");
      onOpenChange(false);
      onSaved?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "แก้ไขไอเดีย" : "เพิ่มไอเดียเอง"}</DialogTitle>
          <DialogDescription>
            {editing ? "ปรับชื่อ hook รายละเอียด เสาหลัก แพลตฟอร์ม และแท็ก" : "ไอเดียจากประสบการณ์จริงของคุณ — จะถูกบันทึกในสถานะ “บันทึกไว้” พร้อมสร้างคอนเทนต์ต่อ"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="idea-title">ชื่อไอเดีย</Label>
            <Input id="idea-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="เช่น 3 สิ่งที่นักสืบสังเกตก่อนรับเคสนอกใจ" disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-hook">Hook (ประโยคเปิด)</Label>
            <Input id="idea-hook" value={form.hook} onChange={(e) => set("hook", e.target.value)} maxLength={1000} placeholder="ประโยคแรกที่ทำให้คนหยุดดู" disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-desc">รายละเอียด / มุมเล่า</Label>
            <Textarea id="idea-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={4000} disabled={pending} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>เสาหลัก</Label>
              <Select value={form.pillar} onValueChange={(v) => set("pillar", v as Pillar)} disabled={pending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILLARS.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", PILLAR_META[p].dot)} />
                        {PILLAR_META[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>รูปแบบ</Label>
              <Select value={form.format ?? NONE} onValueChange={(v) => set("format", v === NONE ? null : (v as ContentFormat))} disabled={pending}>
                <SelectTrigger>
                  <SelectValue placeholder="ไม่ระบุ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ไม่ระบุ</SelectItem>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FORMAT_META[f].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>แพลตฟอร์ม</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs hover:bg-accent/50">
                  <Checkbox checked={form.platforms.includes(p)} onCheckedChange={(c) => togglePlatform(p, c === true)} disabled={pending} />
                  {PLATFORM_META[p].label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idea-tags">แท็ก (คั่นด้วยจุลภาค)</Label>
            <Input id="idea-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="นอกใจ, GPS, หลักฐาน" disabled={pending} />
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={submit} disabled={pending || form.title.trim().length < 3}>
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {editing ? "บันทึก" : "เพิ่มไอเดีย"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
