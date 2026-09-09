"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BrandVoice } from "@/lib/studio/types";
import { ChipInput } from "./chip-input";
import { updateBrandVoice } from "./actions";

export function BrandVoiceForm({ initial }: { initial: BrandVoice }) {
  const [form, setForm] = useState<BrandVoice>(initial);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        const res = await updateBrandVoice(form);
        if (res.ok) toast.success("บันทึกน้ำเสียงแบรนด์แล้ว");
        else toast.error(res.error);
      } catch {
        toast.error("ไม่มีสิทธิ์หรือเซสชันหมดอายุ");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>ภาษาหลักของคอนเทนต์</Label>
          <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v as BrandVoice["language"] })} disabled={pending}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="th">ไทย</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cta_default">CTA เริ่มต้น</Label>
          <Input
            id="cta_default"
            value={form.cta_default}
            onChange={(e) => setForm({ ...form, cta_default: e.target.value })}
            placeholder="ปรึกษาเบื้องต้นได้ทาง LINE @detectivepluse"
            maxLength={300}
            disabled={pending}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>สไตล์ที่ต้องการ</Label>
        <p className="text-xs text-muted-foreground">คำคุณศัพท์ที่ AI ต้องยึดทุกครั้ง เช่น professional, calm, observational</p>
        <ChipInput value={form.style} onChange={(style) => setForm({ ...form, style })} max={20} disabled={pending} placeholder="เพิ่มสไตล์ แล้วกด Enter" />
      </div>

      <div className="space-y-1.5">
        <Label>สิ่งที่ต้องหลีกเลี่ยง</Label>
        <p className="text-xs text-muted-foreground">เช่น over-selling, clickbait, emoji เยอะ, เรื่องสืบสวนที่แต่งขึ้น</p>
        <ChipInput value={form.avoid} onChange={(avoid) => setForm({ ...form, avoid })} max={20} disabled={pending} tone="destructive" placeholder="เพิ่มสิ่งที่ห้าม แล้วกด Enter" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="custom_notes">คำสั่งเพิ่มเติมให้ AI ทุกครั้ง</Label>
        <Textarea
          id="custom_notes"
          value={form.custom_notes}
          onChange={(e) => setForm({ ...form, custom_notes: e.target.value })}
          placeholder="เช่น อ้างอิงประสบการณ์ 10 ปีของทีมเมื่อเหมาะสม · ไม่ใช้คำว่า 'จับได้' · ปิดด้วยคำถามชวนคิด"
          rows={4}
          maxLength={4000}
          disabled={pending}
        />
        <p className="text-right text-[11px] text-muted-foreground">{form.custom_notes.length} / 4000</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} size="sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
