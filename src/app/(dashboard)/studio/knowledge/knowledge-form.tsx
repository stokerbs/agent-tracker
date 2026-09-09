"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_META, SENSITIVITY_META } from "@/lib/studio/constants";
import type { KnowledgeSource, Sensitivity } from "@/lib/studio/types";
import { createKnowledge, updateKnowledge, type KnowledgeInput } from "./actions";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  case: "เคส",
  customer_question: "คำถามลูกค้า",
  investigator_knowledge: "ความรู้นักสืบ",
  owner_experience: "ประสบการณ์เจ้าของ",
  service: "บริการ",
  article: "บทความ",
  technology: "เทคโนโลยี",
  osint: "OSINT",
  surveillance: "การเฝ้าติดตาม",
  gps: "GPS",
  document: "เอกสาร",
  external: "แหล่งภายนอก",
  other: "อื่น ๆ",
};
const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABELS);
const SENSITIVITIES = Object.keys(SENSITIVITY_META) as Sensitivity[];

function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))).slice(0, 20);
}

export function KnowledgeForm({ initial }: { initial?: KnowledgeSource }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [sourceType, setSourceType] = useState(initial?.source_type ?? "owner_experience");
  const [category, setCategory] = useState(initial?.category ?? "other");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [sensitivity, setSensitivity] = useState<string>(initial?.sensitivity ?? "internal");
  const [approved, setApproved] = useState(initial?.approved_for_content ?? false);
  const [originRef, setOriginRef] = useState(initial?.origin_ref ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: KnowledgeInput = {
      title,
      content,
      summary: summary || null,
      source_type: sourceType as KnowledgeInput["source_type"],
      category,
      tags: parseTags(tags),
      sensitivity: sensitivity as KnowledgeInput["sensitivity"],
      approved_for_content: approved,
      origin_ref: originRef || null,
    };
    start(async () => {
      if (initial) {
        const res = await updateKnowledge(initial.id, payload);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("บันทึกความรู้แล้ว");
        router.push(`/studio/knowledge/${initial.id}`);
        router.refresh();
      } else {
        const res = await createKnowledge(payload);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("เพิ่มความรู้แล้ว");
        router.push(`/studio/knowledge/${res.data.id}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="k-title">ชื่อเรื่อง *</Label>
        <Input id="k-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder="เช่น GPS บอกอะไรได้ และบอกอะไรไม่ได้" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="k-content">เนื้อหา *</Label>
        <Textarea
          id="k-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={14}
          className="min-h-[280px] font-mono text-[13px] leading-relaxed"
          placeholder="เขียนความรู้จากงานจริงแบบ generalise แล้ว — ไม่ใส่ชื่อ เบอร์ ทะเบียน ที่อยู่ของบุคคลจริง"
        />
        <p className="text-xs text-muted-foreground">{content.length.toLocaleString()} ตัวอักษร</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="k-summary">สรุปสั้น</Label>
        <Textarea id="k-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} maxLength={1000} placeholder="1–2 ประโยค ใช้แสดงในรายการและให้ AI เลือกแหล่งข้อมูล" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>ประเภทแหล่งข้อมูล</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>{SOURCE_TYPE_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>หมวดหมู่</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {KNOWLEDGE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{KNOWLEDGE_CATEGORY_META[c].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>ระดับความอ่อนไหว</Label>
          <Select value={sensitivity} onValueChange={setSensitivity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SENSITIVITIES.map((s) => (
                <SelectItem key={s} value={s}>{SENSITIVITY_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="k-tags">แท็ก (คั่นด้วยจุลภาค)</Label>
          <Input id="k-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="gps, หลักฐาน, ข้อจำกัด" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="k-origin">ที่มา / อ้างอิง (ไม่บังคับ)</Label>
        <Input id="k-origin" value={originRef} onChange={(e) => setOriginRef(e.target.value)} maxLength={500} placeholder="เช่น marketing/faq.ts#3, URL บทความ, รหัสเอกสารภายใน" />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">อนุมัติให้ AI ใช้สร้างคอนเทนต์</p>
          <p className="text-xs text-muted-foreground">เฉพาะรายการที่อนุมัติเท่านั้นที่จะถูกส่งเข้า prompt ของ AI — ตรวจให้แน่ใจว่าไม่มีข้อมูลระบุตัวตน</p>
        </div>
        <Switch checked={approved} onCheckedChange={setApproved} aria-label="อนุมัติให้ AI ใช้" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>ยกเลิก</Button>
        <Button type="submit" disabled={pending || !title.trim() || !content.trim()} className="gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? "บันทึกการแก้ไข" : "เพิ่มความรู้"}
        </Button>
      </div>
    </form>
  );
}
