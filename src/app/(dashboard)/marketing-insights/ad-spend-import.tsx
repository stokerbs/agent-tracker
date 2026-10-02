"use client";

import { useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { importAdSpend, type ImportResult } from "./actions";
import { AD_LOCALES, AD_PLATFORMS } from "@/lib/marketing/ad-spend";

const PLATFORM_TH: Record<(typeof AD_PLATFORMS)[number], string> = { google_ads: "Google Ads", meta: "Meta (Facebook / Instagram)", line: "LINE Ads", other: "อื่น ๆ" };
const LOCALE_TH: Record<(typeof AD_LOCALES)[number], string> = { all: "ทุกภาษา / ไม่แยก", th: "ไทย", en: "อังกฤษ", zh: "จีน" };
const ERROR_TH: Record<string, string> = {
  invalid_input: "ข้อมูลไม่ครบ (เลือกแพลตฟอร์มและวาง CSV)",
  no_rows: "ไม่พบแถวที่นำเข้าได้ ตรวจหัวตาราง (Day/Date, Cost) และรูปแบบวันที่",
  too_many_rows: "เกิน 2,000 แถวต่อครั้ง แบ่งไฟล์แล้วลองใหม่",
};

/** Paste-a-CSV importer for ad cost (admin). States: idle, pending, error, success with skipped lines. */
export function AdSpendImport() {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(async (_p, fd) => importAdSpend(fd), null);
  const field = "h-9 rounded-md border border-border bg-background px-2 text-sm";
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">แพลตฟอร์ม</span>
          <select name="platform" defaultValue="google_ads" className={`${field} w-full`}>
            {AD_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_TH[p]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">ภาษา/ตลาดของแคมเปญ (ถ้า CSV ไม่มีคอลัมน์)</span>
          <select name="locale" defaultValue="all" className={`${field} w-full`}>
            {AD_LOCALES.map((l) => <option key={l} value={l}>{LOCALE_TH[l]}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">วาง CSV จากรายงานแคมเปญ (ต้องมีคอลัมน์ Day/Date และ Cost; Campaign, Clicks, Impr., Conv. ถ้ามี)</span>
        <textarea name="csv" rows={6} required placeholder={"Day,Campaign,Cost,Clicks,Impr.,Conv.\n2026-09-01,TH | สืบชู้สาว,1250.50,30,2100,2"} className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} นำเข้าค่าโฆษณา
        </button>
        {state && state.ok && <p className="text-sm text-success">นำเข้า {state.imported} แถวแล้ว{state.skipped.length ? ` · ข้าม ${state.skipped.length} แถว` : ""}</p>}
        {state && !state.ok && <p role="alert" className="text-sm text-destructive">{ERROR_TH[state.error] ?? state.error}</p>}
      </div>
      {state && "skipped" in state && state.skipped && state.skipped.length > 0 && (
        <ul className="max-h-32 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
          {state.skipped.slice(0, 20).map((s) => <li key={`${s.line}-${s.message}`}>บรรทัด {s.line}: {s.message}</li>)}
        </ul>
      )}
    </form>
  );
}
