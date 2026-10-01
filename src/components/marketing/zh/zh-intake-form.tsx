"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, Paperclip, X } from "lucide-react";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { track, currentPage } from "@/lib/marketing/analytics";
import {
  ZH_SERVICES, ZH_LOCATIONS, ZH_COUNTRIES, ZH_DURATIONS, ZH_URGENCY, ZH_BUDGETS,
  ZH_INTAKE_MAX_FILES, ZH_INTAKE_MAX_FILE_BYTES, ZH_INTAKE_MAX_TOTAL_BYTES, ZH_INTAKE_ALLOWED_MIME,
} from "@/lib/marketing/zh/intake-schema";

const COUNTRY_LABELS: Record<(typeof ZH_COUNTRIES)[number], string> = {
  china: "中国大陆", hong_kong: "香港", macau: "澳门", taiwan: "台湾", singapore: "新加坡", malaysia: "马来西亚", thailand: "泰国", other: "其他国家 / 地区",
};

const SERVICE_LABELS: Record<(typeof ZH_SERVICES)[number], string> = {
  relationship: "婚姻 / 感情调查",
  find_person: "寻人",
  background: "背景核实（个人）",
  due_diligence: "商业尽职调查（企业）",
  on_site: "实地核实（地址 / 公司 / 工厂）",
  asset: "资产调查",
  other: "其他 / 不确定",
};
const LOCATION_LABELS: Record<(typeof ZH_LOCATIONS)[number], string> = {
  bangkok: "曼谷", pattaya: "芭提雅", phuket: "普吉", "chiang-mai": "清迈", samui: "苏梅岛", "hua-hin": "华欣", chonburi: "春武里", other: "其他地区", unknown: "不确定",
};
const DURATION_LABELS: Record<(typeof ZH_DURATIONS)[number], string> = {
  "1-3_days": "1–3 天", "4-7_days": "4–7 天", "1-2_weeks": "1–2 周", "2-4_weeks": "2–4 周", over_1_month: "1 个月以上", unknown: "不确定",
};
const URGENCY_LABELS: Record<(typeof ZH_URGENCY)[number], string> = { normal: "常规", urgent: "紧急（一周内开始）", critical: "非常紧急（涉及安全）" };
const BUDGET_LABELS: Record<(typeof ZH_BUDGETS)[number], string> = {
  under_20k: "2 万泰铢以下", "20k-50k": "2–5 万泰铢", "50k-100k": "5–10 万泰铢", "100k-300k": "10–30 万泰铢", over_300k: "30 万泰铢以上", undecided: "尚未确定",
};

type State = "idle" | "sending" | "done" | "error";
const MB = (bytes: number) => Math.round(bytes / 1024 / 1024);

/**
 * Structured Chinese intake (docs/china-market/10). Client validation is UX
 * only — /api/marketing/zh-intake re-validates everything. States: idle,
 * sending (disabled + spinner), error (inline message, form preserved), done
 * (Case Lead ID + WeChat CTA). Attribution (landing page, referrer, utm_*) is
 * captured once on mount from sessionStorage/URL.
 */
export function ZhIntakeForm({ defaultService }: { defaultService?: (typeof ZH_SERVICES)[number] }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const [leadRef, setLeadRef] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const started = useRef(false);
  const attribution = useRef({ landingPage: "", referrer: "", utmSource: "", utmMedium: "", utmCampaign: "", utmTerm: "" });

  useEffect(() => {
    try {
      const key = "dp_zh_attr";
      const stored = sessionStorage.getItem(key);
      if (stored) {
        attribution.current = JSON.parse(stored);
      } else {
        const u = new URL(window.location.href);
        attribution.current = {
          landingPage: u.pathname,
          referrer: document.referrer.slice(0, 300),
          utmSource: u.searchParams.get("utm_source") ?? "",
          utmMedium: u.searchParams.get("utm_medium") ?? "",
          utmCampaign: u.searchParams.get("utm_campaign") ?? "",
          utmTerm: u.searchParams.get("utm_term") ?? "",
        };
        sessionStorage.setItem(key, JSON.stringify(attribution.current));
      }
    } catch {
      // sessionStorage unavailable — attribution stays empty.
    }
  }, []);

  function onFirstInteraction() {
    if (started.current) return;
    started.current = true;
    track({ event: "zh_intake_start", page: currentPage(), service: defaultService ?? "general" });
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const next = [...files, ...picked].slice(0, ZH_INTAKE_MAX_FILES);
    const bad = next.find((f) => f.size > ZH_INTAKE_MAX_FILE_BYTES || !(ZH_INTAKE_ALLOWED_MIME as readonly string[]).includes(f.type));
    if (bad) {
      setState("error");
      setError(`文件「${bad.name}」不符合要求：仅支持 JPG / PNG / WebP / PDF，每个不超过 ${MB(ZH_INTAKE_MAX_FILE_BYTES)} MB。`);
      e.target.value = "";
      return;
    }
    if (next.reduce((sum, f) => sum + f.size, 0) > ZH_INTAKE_MAX_TOTAL_BYTES) {
      setState("error");
      setError(`附件合计不能超过 ${MB(ZH_INTAKE_MAX_TOTAL_BYTES)} MB，请压缩或减少文件。`);
      e.target.value = "";
      return;
    }
    setFiles(next);
    e.target.value = "";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!fd.get("consent")) {
      setState("error");
      setError("请先阅读并同意隐私政策。");
      return;
    }
    fd.set("consent", "true");
    fd.delete("files");
    files.forEach((f) => fd.append("files", f));
    Object.entries(attribution.current).forEach(([k, v]) => fd.set(k, v));

    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/marketing/zh-intake", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; leadRef?: string; error?: string };
      if (res.ok && data.ok && data.leadRef) {
        setLeadRef(data.leadRef);
        setState("done");
        track({
          event: "zh_intake_submitted",
          service: String(fd.get("service") ?? ""),
          country: String(fd.get("country") ?? ""),
          budget_range: String(fd.get("budgetRange") ?? ""),
          urgency: String(fd.get("urgency") ?? ""),
          lead_ref: data.leadRef,
          page: currentPage(),
        });
        form.reset();
        setFiles([]);
        return;
      }
      const reason = data.error ?? (res.status === 429 ? "rate_limited" : "server_error");
      track({ event: "zh_intake_error", reason, page: currentPage() });
      setState("error");
      setError(
        reason === "rate_limited" ? "提交过于频繁，请稍后再试，或直接微信联系我们。"
        : reason === "invalid_input" ? "部分信息格式不正确，请检查必填项后重试。"
        : reason === "file_rejected" ? `附件不符合要求（仅支持 JPG / PNG / WebP / PDF，每个不超过 ${MB(ZH_INTAKE_MAX_FILE_BYTES)} MB，合计不超过 ${MB(ZH_INTAKE_MAX_TOTAL_BYTES)} MB，最多 ${ZH_INTAKE_MAX_FILES} 个）。`
        : "提交失败，请重试，或直接微信联系我们。",
      );
    } catch {
      track({ event: "zh_intake_error", reason: "network", page: currentPage() });
      setState("error");
      setError("网络错误，请重试，或直接微信联系我们。");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-8 text-center" role="status" aria-live="polite">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h3 className="mt-3 font-serif text-xl font-bold">已收到您的案件资料</h3>
        <p className="mt-2 text-sm text-muted-foreground">您的案件编号：</p>
        <code className="mt-2 inline-block rounded-md border border-border bg-background px-4 py-2 font-mono text-lg tracking-wider">{leadRef}</code>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">请保存此编号。我们会在 24 小时内通过您留下的微信或邮箱联系您。想更快开始？添加微信并告诉我们这个编号。</p>
        <div className="mt-5">
          <WeChatCta placement="intake_success" />
        </div>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary";
  const label = "mb-1.5 block text-sm font-medium";
  const busy = state === "sending";

  return (
    <form onSubmit={onSubmit} onFocusCapture={onFirstInteraction} className="space-y-5 text-left" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="zi-name">姓名或昵称 *</label>
          <input id="zi-name" name="name" required maxLength={80} className={field} autoComplete="name" />
        </div>
        <div>
          <label className={label} htmlFor="zi-wechat">微信号 *</label>
          <input id="zi-wechat" name="wechatId" required minLength={2} maxLength={60} className={field} placeholder="用于联系您" />
        </div>
        <div>
          <label className={label} htmlFor="zi-email">邮箱（选填）</label>
          <input id="zi-email" name="email" type="email" maxLength={120} className={field} autoComplete="email" />
        </div>
        <div>
          <label className={label} htmlFor="zi-country">您所在的国家 / 地区 *</label>
          <select id="zi-country" name="country" required className={field} defaultValue="">
            <option value="" disabled>— 请选择 —</option>
            {ZH_COUNTRIES.map((v) => <option key={v} value={v}>{COUNTRY_LABELS[v]}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="zi-location">泰国目标地点 *</label>
          <select id="zi-location" name="targetLocation" required className={field} defaultValue="">
            <option value="" disabled>— 请选择 —</option>
            {ZH_LOCATIONS.map((v) => <option key={v} value={v}>{LOCATION_LABELS[v]}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="zi-service">调查类型 *</label>
          <select id="zi-service" name="service" required className={field} defaultValue={defaultService ?? ""}>
            <option value="" disabled>— 请选择 —</option>
            {ZH_SERVICES.map((v) => <option key={v} value={v}>{SERVICE_LABELS[v]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="zi-known">已知信息 *</label>
        <textarea id="zi-known" name="knownInfo" required minLength={10} maxLength={3000} rows={5} className={field} placeholder="请描述您已掌握的信息：对方姓名、所在城市或区域、工作/学校、照片、社交账号、公司名称等。信息越完整，评估越准确。请勿填写他人的身份证号、银行账号等敏感信息。" />
      </div>
      <div>
        <label className={label} htmlFor="zi-objective">您希望达到的目标 *</label>
        <textarea id="zi-objective" name="objective" required minLength={5} maxLength={1500} rows={3} className={field} placeholder="例如：确认对方是否在曼谷生活并了解其日常；核实该公司是否真实经营；找到失联的家人并确认安全。" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="zi-start">希望开始日期（选填）</label>
          <input id="zi-start" name="preferredStart" type="date" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="zi-duration">预计所需时长 *</label>
          <select id="zi-duration" name="estimatedDuration" required className={field} defaultValue="unknown">
            {ZH_DURATIONS.map((v) => <option key={v} value={v}>{DURATION_LABELS[v]}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="zi-urgency">紧急程度 *</label>
          <select id="zi-urgency" name="urgency" required className={field} defaultValue="normal">
            {ZH_URGENCY.map((v) => <option key={v} value={v}>{URGENCY_LABELS[v]}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="zi-budget">预算范围 *</label>
          <select id="zi-budget" name="budgetRange" required className={field} defaultValue="undecided">
            {ZH_BUDGETS.map((v) => <option key={v} value={v}>{BUDGET_LABELS[v]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <span className={label}>支持文件（选填，最多 {ZH_INTAKE_MAX_FILES} 个，JPG / PNG / WebP / PDF，合计不超过 {MB(ZH_INTAKE_MAX_TOTAL_BYTES)} MB）</span>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm hover:bg-muted">
          <Paperclip className="h-4 w-4" /> 添加文件
          <input type="file" name="files" multiple accept={ZH_INTAKE_ALLOWED_MIME.join(",")} onChange={onFiles} className="sr-only" disabled={busy || files.length >= ZH_INTAKE_MAX_FILES} />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                <span className="truncate">{f.name}</span>
                <span>({Math.ceil(f.size / 1024)} KB)</span>
                <button type="button" aria-label={`移除 ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-0.5 hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Honeypot — hidden from humans, filled by bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="zi-website">Website</label>
        <input id="zi-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-primary" />
        <span>我已阅读并同意 <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">隐私政策</a>，同意贵公司存储并使用以上信息以评估并联系我。我确认所提供的信息仅用于合法目的。*</span>
      </label>

      {state === "error" && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive" role="alert">{error}</p>
      )}

      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> 提交中…</> : "提交案件资料，获取案件编号"}
      </button>
      <p className="text-xs text-muted-foreground">提交后不产生任何费用。我们不会向第三方披露您的信息。</p>
    </form>
  );
}
