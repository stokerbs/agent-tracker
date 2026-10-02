"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { approveArticle, type ApproveResult } from "./actions";
import { HUMAN_PARAGRAPH_MAX, HUMAN_PARAGRAPH_MIN } from "@/lib/marketing/human-paragraph";

const ERROR_TH: Record<Exclude<ApproveResult, { ok: true }>["error"], string> = {
  not_found: "ไม่พบบทความ หรือถูกตัดสินไปแล้ว",
  human_paragraph_required: "บทความนี้ต้องมีย่อหน้าจากประสบการณ์จริงทั้งภาษาไทยและอังกฤษก่อนเผยแพร่",
  human_paragraph_invalid: `ย่อหน้าต้องยาว ${HUMAN_PARAGRAPH_MIN}–${HUMAN_PARAGRAPH_MAX} ตัวอักษร และห้ามมีโค้ด HTML`,
  update_failed: "บันทึกย่อหน้าไม่สำเร็จ ลองใหม่อีกครั้ง",
};

/**
 * Approve button for the token-gated review page. Content-calendar drafts
 * (audit Days 31–90) also collect the owner's first-hand paragraph in TH + EN;
 * the server action splices it into the bodies and refuses to publish without it.
 */
export function ApproveForm({ token, requireHuman }: { token: string; requireHuman: boolean }) {
  const [state, action, pending] = useActionState<ApproveResult | null, FormData>(
    async (_prev, fd) => approveArticle(token, fd),
    null,
  );
  const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
  return (
    <form action={action} className="flex w-full flex-col gap-3">
      {requireHuman && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><PenLine className="h-4 w-4 text-primary" /> เพิ่มย่อหน้าจากประสบการณ์จริงก่อนเผยแพร่</p>
          <p className="mt-1 text-xs text-muted-foreground">
            บทความนี้อยู่ในปฏิทินเนื้อหา ต้องมีหนึ่งย่อหน้าที่เขียนโดยทีมงานจริง (สิ่งที่พบบ่อยในเคส ข้อสังเกตจากภาคสนาม) ทั้งไทยและอังกฤษ ระบบจะแทรกต่อจากย่อหน้าแรก ห้ามใส่ชื่อลูกค้าหรือรายละเอียดระบุตัวตน
          </p>
          <label className="mt-3 block text-xs">
            <span className="text-muted-foreground">ภาษาไทย ({HUMAN_PARAGRAPH_MIN}–{HUMAN_PARAGRAPH_MAX} ตัวอักษร)</span>
            <textarea name="humanParagraphTh" rows={4} minLength={HUMAN_PARAGRAPH_MIN} maxLength={HUMAN_PARAGRAPH_MAX} required className={`${field} mt-1`} />
          </label>
          <label className="mt-2 block text-xs">
            <span className="text-muted-foreground">English ({HUMAN_PARAGRAPH_MIN}–{HUMAN_PARAGRAPH_MAX} characters)</span>
            <textarea name="humanParagraphEn" rows={4} minLength={HUMAN_PARAGRAPH_MIN} maxLength={HUMAN_PARAGRAPH_MAX} required className={`${field} mt-1`} />
          </label>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} อนุมัติ & เผยแพร่
        </button>
        {state && !state.ok && <p role="alert" className="text-sm text-destructive">{ERROR_TH[state.error]}</p>}
      </div>
    </form>
  );
}
