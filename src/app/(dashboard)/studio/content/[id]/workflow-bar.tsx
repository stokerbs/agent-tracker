"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, CalendarClock, CalendarX, CheckCircle2, ExternalLink, Loader2, MessageSquareWarning, Send, ShieldAlert, ShieldCheck, Trash2, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { PrivacyBadge } from "@/components/studio/badges";
import { SUPPORT_STATUS_META } from "@/lib/studio/constants";
import type { ActionResult, ApprovalRules, ContentClaim, PrivacyStatus } from "@/lib/studio/types";
import { bangkokLocalInputToIso, formatDateTimeBkk, toBangkokLocalInput } from "../format";
import {
  approveContent,
  archiveContent,
  deleteContent,
  markPublished,
  rejectContent,
  requestChanges,
  scheduleContent,
  submitForReview,
  unarchiveContent,
  unscheduleContent,
} from "./workflow-actions";

export interface WorkflowBarProps {
  master: { id: string; status: string; scheduled_at: string | null; published_at: string | null; published_url: string | null; approved_at: string | null };
  approvedByName: string | null;
  latestPrivacy: PrivacyStatus | null;
  claims: ContentClaim[];
  approvalRules: ApprovalRules;
  /** Flush pending autosave before a transition so the server sees the latest copy. */
  beforeAction: () => Promise<void>;
}

type DialogKind = "approve" | "request_changes" | "reject" | "schedule" | "publish" | "delete" | null;

export function WorkflowBar({ master, approvedByName, latestPrivacy, claims, approvalRules, beforeAction }: WorkflowBarProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setBusy(label);
    start(async () => {
      try {
        await beforeAction();
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(success);
        setDialog(null);
        router.refresh();
      } finally {
        setBusy(null);
      }
    });
  }

  const s = master.status;
  const btn = (label: string, icon: React.ReactNode, onClick: () => void, opts: { variant?: "default" | "outline" | "ghost" | "destructive"; key: string } = { key: label }) => (
    <Button key={opts.key} size="sm" variant={opts.variant ?? "outline"} onClick={onClick} disabled={pending}>
      {busy === opts.key ? <Loader2 className="h-4 w-4 animate-spin" /> : icon} {label}
    </Button>
  );

  const buttons: React.ReactNode[] = [];
  if (s === "draft") {
    buttons.push(btn("ส่งตรวจ", <Send className="h-4 w-4" />, () => run("submit", () => submitForReview(master.id), "ส่งเข้าคิวตรวจแล้ว"), { key: "submit", variant: "default" }));
    buttons.push(btn("อนุมัติ", <CheckCircle2 className="h-4 w-4" />, () => setDialog("approve"), { key: "approve" }));
  }
  if (s === "review") {
    buttons.push(btn("อนุมัติ", <CheckCircle2 className="h-4 w-4" />, () => setDialog("approve"), { key: "approve", variant: "default" }));
    buttons.push(btn("ขอแก้ไข", <MessageSquareWarning className="h-4 w-4" />, () => setDialog("request_changes"), { key: "request_changes" }));
  }
  if (s === "approved") {
    buttons.push(btn("ตั้งเวลาโพสต์", <CalendarClock className="h-4 w-4" />, () => setDialog("schedule"), { key: "schedule", variant: "default" }));
    buttons.push(btn("ทำเครื่องหมายว่าเผยแพร่แล้ว", <ExternalLink className="h-4 w-4" />, () => setDialog("publish"), { key: "publish" }));
  }
  if (s === "scheduled") {
    buttons.push(btn("เปลี่ยนเวลา", <CalendarClock className="h-4 w-4" />, () => setDialog("schedule"), { key: "schedule" }));
    buttons.push(btn("ยกเลิกตั้งเวลา", <CalendarX className="h-4 w-4" />, () => run("unschedule", () => unscheduleContent(master.id), "ยกเลิกการตั้งเวลาแล้ว"), { key: "unschedule" }));
    buttons.push(btn("ทำเครื่องหมายว่าเผยแพร่แล้ว", <ExternalLink className="h-4 w-4" />, () => setDialog("publish"), { key: "publish", variant: "default" }));
  }
  if (["draft", "review", "approved", "scheduled"].includes(s) && s !== "draft") {
    buttons.push(btn("ไม่ผ่าน", <XCircle className="h-4 w-4" />, () => setDialog("reject"), { key: "reject", variant: "ghost" }));
  }
  if (s !== "archived") {
    buttons.push(btn("เก็บถาวร", <Archive className="h-4 w-4" />, () => run("archive", () => archiveContent(master.id), "เก็บถาวรแล้ว"), { key: "archive", variant: "ghost" }));
  }
  if (s === "archived" || s === "rejected") {
    buttons.push(btn("นำกลับมาเป็นร่าง", <ArchiveRestore className="h-4 w-4" />, () => run("unarchive", () => unarchiveContent(master.id), "กลับเป็นร่างแล้ว"), { key: "unarchive", variant: "default" }));
  }
  if (["draft", "rejected", "archived"].includes(s)) {
    buttons.push(btn("ลบ", <Trash2 className="h-4 w-4" />, () => setDialog("delete"), { key: "delete", variant: "ghost" }));
  }

  const unsupported = claims.filter((c) => c.support_status === "unsupported").length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      <p className="text-[11px] text-muted-foreground">
        {s === "published" && (
          <>
            เผยแพร่ {formatDateTimeBkk(master.published_at)}
            {master.published_url && (
              <>
                {" · "}
                <a href={master.published_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  เปิดโพสต์
                </a>
              </>
            )}
            {" · "}V1 ยังไม่โพสต์อัตโนมัติ — สถานะนี้บันทึกด้วยมือ
          </>
        )}
        {s === "scheduled" && <>กำหนดโพสต์ {formatDateTimeBkk(master.scheduled_at)} · V1 ยังไม่โพสต์อัตโนมัติ — ปฏิทินใช้เตือนเวลาเท่านั้น</>}
        {(s === "approved" || s === "scheduled") && master.approved_at && (
          <>
            {s === "scheduled" ? " · " : ""}อนุมัติโดย {approvedByName ?? "—"} {formatDateTimeBkk(master.approved_at)}
          </>
        )}
        {s === "review" && "รอการตรวจ — อนุมัติได้เมื่อ Privacy Check ไม่ถูกบล็อก"}
        {s === "draft" && "ร่าง — ส่งตรวจจะรัน Privacy Check อัตโนมัติหากยังไม่เคยตรวจ"}
      </p>

      <ApproveDialog
        open={dialog === "approve"}
        onOpenChange={(v) => !v && setDialog(null)}
        latestPrivacy={latestPrivacy}
        claims={claims}
        unsupported={unsupported}
        approvalRules={approvalRules}
        pending={pending}
        onConfirm={(input) => run("approve", () => approveContent({ masterId: master.id, ...input }), "อนุมัติแล้ว")}
      />
      <NoteDialog
        open={dialog === "request_changes"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="ขอแก้ไข"
        description="คอนเทนต์จะกลับไปเป็นร่าง พร้อมบันทึกเหตุผลไว้ในประวัติการตรวจ"
        confirmLabel="ส่งกลับไปแก้"
        pending={pending}
        onConfirm={(note) => run("request_changes", () => requestChanges({ masterId: master.id, note }), "ส่งกลับไปแก้ไขแล้ว")}
      />
      <NoteDialog
        open={dialog === "reject"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="ไม่ผ่าน"
        description="ทำเครื่องหมายว่าคอนเทนต์นี้ไม่ผ่าน (นำกลับมาเป็นร่างได้ภายหลัง)"
        confirmLabel="ยืนยันไม่ผ่าน"
        destructive
        pending={pending}
        onConfirm={(note) => run("reject", () => rejectContent({ masterId: master.id, note }), "ทำเครื่องหมายว่าไม่ผ่านแล้ว")}
      />
      <ScheduleDialog
        key={`${master.scheduled_at ?? "none"}-${dialog === "schedule"}`}
        open={dialog === "schedule"}
        onOpenChange={(v) => !v && setDialog(null)}
        current={master.scheduled_at}
        pending={pending}
        onConfirm={(iso) => run("schedule", () => scheduleContent({ masterId: master.id, scheduledAt: iso }), "ตั้งเวลาแล้ว")}
      />
      <PublishDialog
        open={dialog === "publish"}
        onOpenChange={(v) => !v && setDialog(null)}
        pending={pending}
        onConfirm={(url) => run("publish", () => markPublished({ masterId: master.id, publishedUrl: url }), "บันทึกว่าเผยแพร่แล้ว")}
      />
      <DeleteConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="ลบคอนเทนต์ถาวร"
        description="ลบ master พร้อมเวอร์ชัน แหล่งข้อมูล claim และประวัติ Privacy Check ทั้งหมด — ย้อนกลับไม่ได้"
        onConfirm={async () => {
          const res = await deleteContent(master.id);
          if (!res.ok) {
            toast.error(res.error);
            return { error: res.error };
          }
          toast.success("ลบคอนเทนต์แล้ว");
          router.push("/studio/content");
          router.refresh();
        }}
      />
    </div>
  );
}

// ─── Approve dialog (the human gate) ─────────────────────────────────────────
function ApproveDialog({
  open,
  onOpenChange,
  latestPrivacy,
  claims,
  unsupported,
  approvalRules,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  latestPrivacy: PrivacyStatus | null;
  claims: ContentClaim[];
  unsupported: number;
  approvalRules: ApprovalRules;
  pending: boolean;
  onConfirm: (input: { overridePrivacy?: boolean; acknowledgeUnsupported?: boolean; note?: string }) => void;
}) {
  const [override, setOverride] = useState(false);
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState("");

  const blocked = latestPrivacy === "blocked";
  const needsOverride = latestPrivacy === "review_required" && approvalRules.require_privacy_safe;
  const canOverride = approvalRules.allow_override;
  const counts = claims.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.support_status]: (acc[c.support_status] ?? 0) + 1 }), {});
  const canConfirm = !blocked && (!needsOverride || (canOverride && override)) && (unsupported === 0 || ack);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) {
          onOpenChange(v);
          if (!v) {
            setOverride(false);
            setAck(false);
            setNote("");
          }
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {blocked ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-emerald-500" />} อนุมัติคอนเทนต์
          </DialogTitle>
          <DialogDescription>การอนุมัติเป็นการตัดสินใจของคน — ระบบตรวจสอบ Privacy และ claim ให้ก่อน</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Privacy Check ล่าสุด</span>
              <PrivacyBadge status={latestPrivacy} size="md" />
            </div>
            {latestPrivacy === null && <p className="mt-2 text-xs text-muted-foreground">ยังไม่เคยตรวจ — ระบบจะรันการตรวจอัตโนมัติ (แบบเร็ว) ก่อนอนุมัติ</p>}
            {blocked && (
              <p className="mt-2 text-xs text-destructive">
                ไม่สามารถอนุมัติได้: Privacy Check เป็น BLOCKED — แก้เนื้อหาให้ทั่วไปขึ้น (ไม่ใช่แทนด้วยรายละเอียดสมมติ) แล้วตรวจอีกครั้งในแผงด้านขวา
              </p>
            )}
            {needsOverride && !canOverride && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">ตั้งค่าสตูดิโอไม่อนุญาตให้ override ผลตรวจ &quot;ต้องตรวจสอบ&quot; — แก้เนื้อหาแล้วตรวจอีกครั้ง</p>
            )}
            {needsOverride && canOverride && (
              <label className="mt-3 flex items-start gap-2 text-xs">
                <Checkbox checked={override} onCheckedChange={(v) => setOverride(v === true)} className="mt-0.5" aria-label="ยืนยัน override privacy" />
                <span>
                  ฉันตรวจสอบแล้วและยืนยันว่าไม่มีข้อมูลระบุตัวตน (override) — <span className="text-muted-foreground">จะบันทึกเป็น override_privacy ในประวัติและ audit log</span>
                </span>
              </label>
            )}
          </div>

          <div className="rounded-lg border border-border/70 p-3">
            <span className="text-xs font-medium text-muted-foreground">Fact check</span>
            {claims.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">ยังไม่มี claim ที่ต้องตรวจ</p>
            ) : (
              <p className="mt-1 text-xs text-foreground">
                {Object.entries(counts)
                  .map(([k, n]) => `${n} ${SUPPORT_STATUS_META[k as keyof typeof SUPPORT_STATUS_META]?.label ?? k}`)
                  .join(" · ")}
              </p>
            )}
            {unsupported > 0 && (
              <label className="mt-3 flex items-start gap-2 text-xs">
                <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" aria-label="รับทราบ claim ที่ไม่มีแหล่งอ้างอิง" />
                <span>
                  รับทราบว่ามี {unsupported} claim ที่ไม่มีแหล่งอ้างอิง และยอมรับความเสี่ยงในการเผยแพร่ <span className="text-muted-foreground">(บันทึกในหมายเหตุการอนุมัติ)</span>
                </span>
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approve-note">หมายเหตุ (ไม่บังคับ)</Label>
            <Textarea id="approve-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="เช่น ตรวจแล้วว่าเป็นสถานการณ์ทั่วไป ไม่เชื่อมโยงเคสจริง" maxLength={2000} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          {!blocked && (
            <Button size="sm" disabled={!canConfirm || pending} onClick={() => onConfirm({ overridePrivacy: override || undefined, acknowledgeUnsupported: ack || undefined, note: note.trim() || undefined })}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} อนุมัติ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Note dialog (request changes / reject) ──────────────────────────────────
function NoteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) {
          onOpenChange(v);
          if (!v) setNote("");
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="wf-note">เหตุผล</Label>
          <Textarea id="wf-note" autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} placeholder="สั้น ๆ ว่าต้องแก้อะไร" />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button size="sm" variant={destructive ? "destructive" : "default"} disabled={!note.trim() || pending} onClick={() => onConfirm(note.trim())}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schedule dialog ─────────────────────────────────────────────────────────
function ScheduleDialog({ open, onOpenChange, current, pending, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; current: string | null; pending: boolean; onConfirm: (iso: string) => void }) {
  const [value, setValue] = useState(() => toBangkokLocalInput(current));
  const iso = bangkokLocalInputToIso(value);
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ตั้งเวลาโพสต์</DialogTitle>
          <DialogDescription>เวลาประเทศไทย (Asia/Bangkok) — V1 ใช้เป็นกำหนดการในปฏิทิน ยังไม่โพสต์อัตโนมัติ</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="sched-at">วันและเวลา</Label>
          <Input id="sched-at" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          {iso && <p className="text-[11px] text-muted-foreground">= {formatDateTimeBkk(iso)}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button size="sm" disabled={!iso || pending} onClick={() => iso && onConfirm(iso)}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} บันทึกเวลา
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Publish dialog ──────────────────────────────────────────────────────────
function PublishDialog({ open, onOpenChange, pending, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; pending: boolean; onConfirm: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ทำเครื่องหมายว่าเผยแพร่แล้ว</DialogTitle>
          <DialogDescription>V1 ยังไม่โพสต์อัตโนมัติ — โพสต์ด้วยมือบนแพลตฟอร์ม แล้วบันทึกลิงก์ไว้ที่นี่เพื่อติดตามผล</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="pub-url">ลิงก์โพสต์ (ไม่บังคับ)</Label>
          <Input id="pub-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@…/video/…" />
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            ยกเลิก
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onConfirm(url.trim())}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="hidden" />} บันทึกว่าเผยแพร่แล้ว
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
