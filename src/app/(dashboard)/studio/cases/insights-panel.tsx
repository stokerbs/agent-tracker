"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, Pencil, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ApprovedBadge, Pill, PillarBadge, PrivacyBadge } from "@/components/studio/badges";
import { AiUnavailableBanner } from "@/components/studio/ai-status";
import { PILLARS, PILLAR_META, PRIVACY_STATUS_META } from "@/lib/studio/constants";
import type { CaseInsight, Pillar, PrivacyStatus } from "@/lib/studio/types";
import { formatDate } from "@/lib/utils";
import { ApproveSwitch } from "../knowledge/approve-switch";
import { createIdeaFromInsight, deleteInsight, extractInsightsForCase, setInsightApproved, updateInsight, type InsightInput } from "./actions";
import { useSafeTransition } from "@/components/studio/use-safe-transition";

const NONE = "__none__";

export function InsightsPanel({ caseId, insights, aiAvailable }: { caseId: string; insights: CaseInsight[]; aiAvailable: boolean }) {
  const router = useRouter();
  const [pending, safe] = useSafeTransition();
  const approvedCount = insights.filter((i) => i.approved_for_content).length;

  function extract() {
    safe(async () => {
      const res = await extractInsightsForCase(caseId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`AI สกัดบทเรียนได้ ${res.data.inserted} ข้อ${res.data.anonymizedUpdated ? " และร่างเวอร์ชันไม่ระบุตัวตนให้แล้ว" : ""} — ตรวจและอนุมัติทีละข้อ`);
      router.refresh();
    });
  }

  const extractButton = (
    <Button onClick={extract} disabled={pending || !aiAvailable} size="sm" className="gap-1.5">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} สกัดบทเรียนด้วย AI
    </Button>
  );

  return (
    <section id="insights" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">บทเรียนจากเคส</h2>
          <p className="text-xs text-muted-foreground">
            อนุมัติแล้ว {approvedCount}/{insights.length} · เฉพาะบทเรียนที่อนุมัติเท่านั้นที่ AI ใช้สร้างคอนเทนต์
          </p>
        </div>
        {aiAvailable ? (
          extractButton
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{extractButton}</span>
            </TooltipTrigger>
            <TooltipContent>AI ยังใช้งานไม่ได้ — ตั้งค่า ANTHROPIC_API_KEY ก่อน</TooltipContent>
          </Tooltip>
        )}
      </div>

      {!aiAvailable && <AiUnavailableBanner reason="การสกัดบทเรียนด้วย AI ปิดอยู่ — คุณยังแก้ไข/อนุมัติบทเรียนที่มีอยู่ได้" />}

      {insights.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="ยังไม่มีบทเรียนจากเคสนี้"
          description={aiAvailable ? "กด “สกัดบทเรียนด้วย AI” เพื่อให้ AI ดึงบทเรียนที่ปลอดภัยต่อการเผยแพร่ออกมา 2–5 ข้อ" : "เมื่อ AI พร้อมใช้งาน ระบบจะสกัดบทเรียนจากเคสนี้ให้"}
        />
      ) : (
        <div className="space-y-3">
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </div>
      )}
    </section>
  );
}

function InsightCard({ insight }: { insight: CaseInsight }) {
  const router = useRouter();
  const [pending, safe] = useSafeTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const blocked = insight.privacy_status === "blocked";

  function makeIdea() {
    safe(async () => {
      const res = await createIdeaFromInsight(insight.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("สร้างไอเดียใน Idea Bank แล้ว");
      router.push("/studio/ideas");
    });
  }

  return (
    <Card id={`insight-${insight.id}`} className="scroll-mt-24 target:border-primary/60 target:ring-1 target:ring-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug">{insight.title}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {insight.pillar && <PillarBadge pillar={insight.pillar} />}
            <PrivacyBadge status={insight.privacy_status} />
            <ApprovedBadge approved={insight.approved_for_content} />
            <Pill className="bg-muted text-muted-foreground border-border">{insight.generated_by === "ai" ? "AI สกัด" : "เขียนเอง"}</Pill>
          </div>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-[110px_1fr]">
          <dt className="text-xs text-muted-foreground">บทเรียน</dt>
          <dd className="whitespace-pre-wrap leading-relaxed">{insight.insight}</dd>
          {insight.lesson && (
            <>
              <dt className="text-xs text-muted-foreground">สิ่งที่ผู้ชมได้</dt>
              <dd className="whitespace-pre-wrap leading-relaxed">{insight.lesson}</dd>
            </>
          )}
          {insight.content_angle && (
            <>
              <dt className="text-xs text-muted-foreground">มุมคอนเทนต์</dt>
              <dd className="whitespace-pre-wrap leading-relaxed text-violet-700 dark:text-violet-300">{insight.content_angle}</dd>
            </>
          )}
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="text-[11px] text-muted-foreground">อัปเดต {formatDate(insight.updated_at)}</span>
          <ApproveSwitch
            id={insight.id}
            approved={insight.approved_for_content}
            action={setInsightApproved}
            disabled={blocked && !insight.approved_for_content}
            disabledReason="บทเรียนนี้ถูกบล็อกด้านความเป็นส่วนตัว — แก้ไขให้ generalise ก่อนจึงอนุมัติได้"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={makeIdea} disabled={pending || blocked}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />} สร้างไอเดียจากบทเรียนนี้
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> แก้ไข
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> ลบ
          </Button>
        </div>
      </CardContent>

      <EditInsightDialog insight={insight} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="ลบบทเรียนนี้?"
        description="บทเรียนจะถูกลบถาวร คอนเทนต์ที่เคยอ้างอิงจะยังอยู่แต่ตามกลับมาที่แหล่งข้อมูลนี้ไม่ได้"
        onConfirm={async () => {
          const res = await deleteInsight(insight.id);
          if (!res.ok) { toast.error(res.error); return { error: res.error }; }
          toast.success("ลบบทเรียนแล้ว");
          router.refresh();
        }}
      />
    </Card>
  );
}

function EditInsightDialog({ insight, open, onOpenChange }: { insight: CaseInsight; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, safe] = useSafeTransition();
  const [title, setTitle] = useState(insight.title);
  const [body, setBody] = useState(insight.insight);
  const [lesson, setLesson] = useState(insight.lesson ?? "");
  const [angle, setAngle] = useState(insight.content_angle ?? "");
  const [pillar, setPillar] = useState<string>(insight.pillar ?? NONE);
  const [privacy, setPrivacy] = useState<PrivacyStatus>(insight.privacy_status as PrivacyStatus);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: InsightInput = {
      title,
      insight: body,
      lesson: lesson || null,
      content_angle: angle || null,
      pillar: pillar === NONE ? null : (pillar as Pillar),
      privacy_status: privacy,
    };
    safe(async () => {
      const res = await updateInsight(insight.id, payload);
      if (!res.ok) { toast.error(res.error); return; }
      if (res.data.privacy_status === "blocked" && privacy !== "blocked") {
        toast.warning(`บันทึกแล้ว แต่ระบบพบข้อมูลระบุตัวตนระดับสูง ${res.data.findings.filter((f) => f.severity === "high").length} จุด — สถานะถูกตั้งเป็นบล็อก`);
      } else {
        toast.success("บันทึกบทเรียนแล้ว");
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!pending) onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขบทเรียน</DialogTitle>
          <DialogDescription>ปรับให้ generalise มากขึ้น แล้วตั้งสถานะความเป็นส่วนตัวตามที่ตรวจแล้ว — ระบบจะสแกนซ้ำก่อนบันทึก</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`it-${insight.id}`}>ชื่อบทเรียน *</Label>
            <Input id={`it-${insight.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ii-${insight.id}`}>บทเรียน *</Label>
            <Textarea id={`ii-${insight.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={4} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`il-${insight.id}`}>สิ่งที่ผู้ชมได้</Label>
            <Textarea id={`il-${insight.id}`} value={lesson} onChange={(e) => setLesson(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`ia-${insight.id}`}>มุมคอนเทนต์</Label>
            <Textarea id={`ia-${insight.id}`} value={angle} onChange={(e) => setAngle(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pillar</Label>
              <Select value={pillar} onValueChange={setPillar}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ไม่ระบุ</SelectItem>
                  {PILLARS.map((p) => (
                    <SelectItem key={p} value={p}>{PILLAR_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>สถานะความเป็นส่วนตัว</Label>
              <Select value={privacy} onValueChange={(v) => setPrivacy(v as PrivacyStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIVACY_STATUS_META) as PrivacyStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{PRIVACY_STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>ยกเลิก</Button>
            <Button type="submit" disabled={pending || !title.trim() || !body.trim()} className="gap-1.5">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
