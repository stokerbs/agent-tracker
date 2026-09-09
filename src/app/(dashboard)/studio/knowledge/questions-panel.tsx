"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, MessageSquareText, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ApprovedBadge, Pill } from "@/components/studio/badges";
import { AiUnavailableBanner } from "@/components/studio/ai-status";
import { formatDate } from "@/lib/utils";
import type { CustomerQuestion, QuestionSource } from "@/lib/studio/types";
import { ApproveSwitch } from "./approve-switch";
import {
  createIdeaFromQuestion,
  createQuestion,
  deleteQuestion,
  extractQuestionsFromText,
  saveExtractedQuestions,
  setQuestionApproved,
  updateQuestion,
  type ExtractedQuestion,
  type QuestionInput,
} from "./actions";

export const QUESTION_SOURCE_LABELS: Record<QuestionSource, string> = {
  line_oa: "LINE OA",
  phone: "โทรศัพท์",
  web: "เว็บไซต์",
  manual: "บันทึกเอง",
  import: "นำเข้า",
};
const SOURCES = Object.keys(QUESTION_SOURCE_LABELS) as QuestionSource[];

function parseTags(raw: string): string[] {
  return Array.from(new Set(raw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))).slice(0, 20);
}

export function QuestionsPanel({ questions, aiAvailable, query }: { questions: CustomerQuestion[]; aiAvailable: boolean; query: string }) {
  return (
    <div className="space-y-5">
      {!aiAvailable && <AiUnavailableBanner reason="การนำเข้าคำถามด้วย AI ปิดอยู่ — เพิ่มคำถามด้วยตนเองได้ตามปกติ" />}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <AddQuestionForm />
        <ImportDialogCard aiAvailable={aiAvailable} />
      </div>

      {questions.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="h-6 w-6" />}
          title={query ? `ไม่พบคำถามที่ตรงกับ “${query}”` : "ยังไม่มีคำถามลูกค้า"}
          description="เพิ่มคำถามที่ลูกค้าถามบ่อยด้วยตนเอง หรือวางข้อความจาก LINE OA ให้ AI สกัดคำถามซ้ำ ๆ ออกมา"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {questions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add form ────────────────────────────────────────────────────────────────

function AddQuestionForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [question, setQuestion] = useState("");
  const [hint, setHint] = useState("");
  const [source, setSource] = useState<QuestionSource>("manual");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: QuestionInput = { question, answer_hint: hint || null, source, frequency: 1, tags: [], approved_for_content: false };
    start(async () => {
      const res = await createQuestion(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("เพิ่มคำถามแล้ว");
      setQuestion("");
      setHint("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm font-medium">เพิ่มคำถามลูกค้า</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="ลูกค้าถามว่าอะไร? (ไม่ใส่ชื่อ/เบอร์ลูกค้า)" maxLength={1000} required />
            <Select value={source} onValueChange={(v) => setSource(v as QuestionSource)}>
              <SelectTrigger aria-label="ที่มา"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{QUESTION_SOURCE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={hint} onChange={(e) => setHint(e.target.value)} rows={2} maxLength={2000} placeholder="แนวคำตอบที่ Detective Pulse ใช้ตอบ (generalise แล้ว ไม่ระบุราคา/การรับประกัน)" />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending || !question.trim()} className="gap-1.5">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} เพิ่มคำถาม
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Import from LINE OA (paste) ─────────────────────────────────────────────

function ImportDialogCard({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [source, setSource] = useState<QuestionSource>("line_oa");
  const [candidates, setCandidates] = useState<ExtractedQuestion[] | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  function reset() {
    setText("");
    setCandidates(null);
    setTicked(new Set());
  }

  function extract() {
    start(async () => {
      const res = await extractQuestionsFromText({ text, source });
      if (!res.ok) { toast.error(res.error); return; }
      if (res.data.questions.length === 0) {
        toast.info("AI ไม่พบคำถามที่ซ้ำกันในข้อความนี้");
        return;
      }
      setCandidates(res.data.questions);
      setTicked(new Set(res.data.questions.map((_, i) => i)));
    });
  }

  function save() {
    if (!candidates) return;
    const chosen = candidates.filter((_, i) => ticked.has(i)).map((c) => ({ question: c.question, answer_hint: c.answer_hint, frequency: c.frequency, tags: c.tags }));
    start(async () => {
      const res = await saveExtractedQuestions({ source, questions: chosen });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`บันทึก ${res.data.inserted} คำถามแล้ว (ยังไม่อนุมัติให้ AI ใช้)`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const trigger = (
    <Button variant="outline" size="sm" className="w-full gap-1.5" disabled={!aiAvailable} onClick={() => setOpen(true)}>
      <Sparkles className="h-3.5 w-3.5" /> นำเข้าจาก LINE OA (วางข้อความ)
    </Button>
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">นำเข้าด้วย AI</p>
        <p className="text-xs text-muted-foreground">
          คัดลอกบทสนทนาจาก LINE OA หรือโน้ตจากสายโทรศัพท์มาวาง — AI จะจัดกลุ่มคำถามซ้ำ ๆ โดยไม่เก็บชื่อหรือข้อมูลส่วนตัวของลูกค้า ข้อความที่วางจะไม่ถูกบันทึกลงระบบ
        </p>
        {aiAvailable ? (
          trigger
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">{trigger}</span>
            </TooltipTrigger>
            <TooltipContent>AI ยังใช้งานไม่ได้ — ตั้งค่า ANTHROPIC_API_KEY ก่อน</TooltipContent>
          </Tooltip>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { if (!pending) { setOpen(v); if (!v) reset(); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นำเข้าคำถามลูกค้าด้วย AI</DialogTitle>
            <DialogDescription>
              วางข้อความ → AI สกัดคำถามที่พบบ่อย → เลือกรายการที่ต้องการบันทึก ทุกรายการจะถูกบันทึกในสถานะ “ยังไม่อนุมัติให้ AI ใช้”
            </DialogDescription>
          </DialogHeader>

          {!candidates ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>ที่มาของข้อความ</Label>
                <Select value={source} onValueChange={(v) => setSource(v as QuestionSource)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{QUESTION_SOURCE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="import-text">ข้อความที่วาง</Label>
                <Textarea id="import-text" value={text} onChange={(e) => setText(e.target.value)} rows={12} maxLength={20000} className="font-mono text-xs" placeholder="วางบทสนทนาหลาย ๆ รายการได้ (สูงสุด 20,000 ตัวอักษร)" />
                <p className="text-xs text-muted-foreground">{text.length.toLocaleString()} / 20,000</p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>ยกเลิก</Button>
                <Button onClick={extract} disabled={pending || text.trim().length < 20} className="gap-1.5">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} สกัดคำถาม
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>พบ {candidates.length} คำถาม · เลือกแล้ว {ticked.size}</span>
                <div className="flex gap-2">
                  <button type="button" className="text-primary hover:underline" onClick={() => setTicked(new Set(candidates.map((_, i) => i)))}>เลือกทั้งหมด</button>
                  <button type="button" className="text-primary hover:underline" onClick={() => setTicked(new Set())}>ไม่เลือก</button>
                </div>
              </div>
              <ul className="space-y-2">
                {candidates.map((c, i) => (
                  <li key={i} className="flex gap-3 rounded-md border border-border/60 bg-card p-3">
                    <Checkbox
                      id={`cand-${i}`}
                      checked={ticked.has(i)}
                      onCheckedChange={(v) => {
                        const next = new Set(ticked);
                        if (v) next.add(i); else next.delete(i);
                        setTicked(next);
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor={`cand-${i}`} className="min-w-0 flex-1 cursor-pointer space-y-1">
                      <p className="text-sm font-medium leading-snug">{c.question}</p>
                      {c.answer_hint && <p className="text-xs text-muted-foreground">แนวคำตอบ: {c.answer_hint}</p>}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <Pill className="bg-muted text-muted-foreground border-border">ถามซ้ำ ×{c.frequency}</Pill>
                        {c.tags.slice(0, 5).map((t) => (
                          <Pill key={t} className="bg-muted text-muted-foreground border-border">#{t}</Pill>
                        ))}
                      </div>
                      {c.content_idea && (
                        <p className="flex items-start gap-1 text-xs text-violet-600 dark:text-violet-400">
                          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" /> {c.content_idea}
                        </p>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCandidates(null)} disabled={pending}>ย้อนกลับ</Button>
                <Button onClick={save} disabled={pending || ticked.size === 0} className="gap-1.5">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} บันทึก {ticked.size} คำถาม
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Question card ───────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: CustomerQuestion }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function makeIdea() {
    start(async () => {
      const res = await createIdeaFromQuestion(q.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("สร้างไอเดียใน Idea Bank แล้ว");
      router.push("/studio/ideas");
    });
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{q.question}</p>
          {q.is_demo && <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">DEMO</Pill>}
        </div>
        {q.answer_hint && <p className="text-xs text-muted-foreground">แนวคำตอบ: {q.answer_hint}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <ApprovedBadge approved={q.approved_for_content} />
          <Pill className="bg-muted text-muted-foreground border-border">ถามซ้ำ ×{q.frequency}</Pill>
          <Pill className="bg-muted text-muted-foreground border-border">{QUESTION_SOURCE_LABELS[q.source as QuestionSource] ?? q.source}</Pill>
          {q.tags.slice(0, 4).map((t) => (
            <Pill key={t} className="bg-muted text-muted-foreground border-border">#{t}</Pill>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] text-muted-foreground">อัปเดต {formatDate(q.updated_at)}</span>
          <ApproveSwitch id={q.id} approved={q.approved_for_content} action={setQuestionApproved} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={makeIdea} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />} สร้างไอเดียจากคำถามนี้
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> แก้ไข
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> ลบ
          </Button>
        </div>
      </CardContent>

      <EditQuestionDialog q={q} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="ลบคำถามนี้?"
        description="คำถามและแนวคำตอบจะถูกลบถาวร ไอเดียที่เคยสร้างจากคำถามนี้จะยังอยู่"
        onConfirm={async () => {
          const res = await deleteQuestion(q.id);
          if (!res.ok) { toast.error(res.error); return { error: res.error }; }
          toast.success("ลบคำถามแล้ว");
          router.refresh();
        }}
      />
    </Card>
  );
}

function EditQuestionDialog({ q, open, onOpenChange }: { q: CustomerQuestion; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [question, setQuestion] = useState(q.question);
  const [hint, setHint] = useState(q.answer_hint ?? "");
  const [frequency, setFrequency] = useState(String(q.frequency));
  const [source, setSource] = useState<QuestionSource>(q.source as QuestionSource);
  const [tags, setTags] = useState(q.tags.join(", "));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: QuestionInput = {
      question,
      answer_hint: hint || null,
      frequency: Number(frequency) || 1,
      source,
      tags: parseTags(tags),
      approved_for_content: q.approved_for_content,
    };
    start(async () => {
      const res = await updateQuestion(q.id, payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("บันทึกคำถามแล้ว");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!pending) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>แก้ไขคำถามลูกค้า</DialogTitle>
          <DialogDescription>ปรับคำถามให้เป็นรูปแบบกลาง ๆ และแนวคำตอบที่ generalise แล้ว</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`eq-${q.id}`}>คำถาม *</Label>
            <Textarea id={`eq-${q.id}`} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={1000} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`eh-${q.id}`}>แนวคำตอบ</Label>
            <Textarea id={`eh-${q.id}`} value={hint} onChange={(e) => setHint(e.target.value)} rows={3} maxLength={2000} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`ef-${q.id}`}>จำนวนครั้งที่ถาม</Label>
              <Input id={`ef-${q.id}`} type="number" min={1} max={100000} value={frequency} onChange={(e) => setFrequency(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ที่มา</Label>
              <Select value={source} onValueChange={(v) => setSource(v as QuestionSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{QUESTION_SOURCE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`et-${q.id}`}>แท็ก (คั่นด้วยจุลภาค)</Label>
            <Input id={`et-${q.id}`} value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>ยกเลิก</Button>
            <Button type="submit" disabled={pending || !question.trim()} className="gap-1.5">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
