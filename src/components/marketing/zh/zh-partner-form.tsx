"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { track, currentPage } from "@/lib/marketing/analytics";
import { ZH_COUNTRIES } from "@/lib/marketing/zh/intake-schema";
import { ZH_PARTNER_TYPES, ZH_PARTNER_SERVICES, ZH_PARTNER_VOLUMES } from "@/lib/marketing/zh/partner-schema";
import { PARTNER_TYPE_LABELS, PARTNER_SERVICE_LABELS } from "@/lib/marketing/zh/partner-pipeline";

const COUNTRY_LABELS: Record<(typeof ZH_COUNTRIES)[number], string> = {
  china: "中国大陆", hong_kong: "香港", macau: "澳门", taiwan: "台湾", singapore: "新加坡", malaysia: "马来西亚", thailand: "泰国", other: "其他国家 / 地区",
};
const VOLUME_LABELS: Record<(typeof ZH_PARTNER_VOLUMES)[number], string> = {
  occasional: "偶尔（每年几次）", monthly_1_3: "每月 1–3 个项目", monthly_4_10: "每月 4–10 个项目", over_10: "每月 10 个以上",
};

type State = "idle" | "sending" | "done" | "error";

/** B2B partner application (docs/china-market/13). Server re-validates everything. */
export function ZhPartnerForm() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const started = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state === "done") heading.current?.focus();
    if (state === "error") errorRef.current?.focus();
  }, [state, error]);

  function onFirstInteraction() {
    if (started.current) return;
    started.current = true;
    track({ event: "partner_intake_start", page: currentPage() });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const services = fd.getAll("services").map(String);
    if (services.length === 0) {
      setState("error");
      setError("请至少选择一项希望合作的服务。");
      return;
    }
    const payload = {
      orgName: fd.get("orgName"),
      partnerType: fd.get("partnerType"),
      contactName: fd.get("contactName"),
      wechatId: fd.get("wechatId"),
      email: fd.get("email"),
      phone: fd.get("phone"),
      city: fd.get("city"),
      country: fd.get("country"),
      orgWebsite: fd.get("orgWebsite"),
      services,
      expectedVolume: fd.get("expectedVolume"),
      message: fd.get("message"),
      consent: Boolean(fd.get("consent")),
      website: String(fd.get("website") ?? ""),
    };
    if (!payload.wechatId && !payload.email && !payload.phone) {
      setState("error");
      setError("请至少填写一种联系方式（微信、邮箱或电话）。");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/marketing/partner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setState("done");
        track({ event: "partner_intake_submitted", partner_type: String(payload.partnerType), country: String(payload.country), services_count: services.length, page: currentPage() });
        form.reset();
        return;
      }
      const reason = data.error ?? (res.status === 429 ? "rate_limited" : "server_error");
      track({ event: "partner_intake_error", reason, page: currentPage() });
      setState("error");
      setError(reason === "rate_limited" ? "提交过于频繁，请稍后再试，或直接微信联系我们。" : reason === "invalid_input" ? "部分信息格式不正确，请检查后重试。" : "提交失败，请重试，或直接微信联系我们。");
    } catch {
      track({ event: "partner_intake_error", reason: "network", page: currentPage() });
      setState("error");
      setError("网络错误，请重试，或直接微信联系我们。");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-8 text-center" role="status" aria-live="polite">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h3 ref={heading} tabIndex={-1} className="mt-3 font-serif text-xl font-bold outline-none">已收到您的合作申请</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">我们会在 2 个工作日内与您联系，安排一次 20 分钟的通话，并提供脱敏示例报告与合作条款。企业客户可先签署保密协议。</p>
        <div className="mt-5"><WeChatCta placement="intake_success" service="due_diligence" /></div>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary";
  const label = "mb-1.5 block text-sm font-medium";
  const busy = state === "sending";

  return (
    <form onSubmit={onSubmit} onFocusCapture={onFirstInteraction} className="space-y-5 text-left">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="zp-org">机构名称 *</label><input id="zp-org" name="orgName" required minLength={2} maxLength={120} className={field} autoComplete="organization" /></div>
        <div>
          <label className={label} htmlFor="zp-type">机构类型 *</label>
          <select id="zp-type" name="partnerType" required className={field} defaultValue="">
            <option value="" disabled>— 请选择 —</option>
            {ZH_PARTNER_TYPES.map((v) => <option key={v} value={v}>{PARTNER_TYPE_LABELS[v]?.zh ?? v}</option>)}
          </select>
        </div>
        <div><label className={label} htmlFor="zp-name">联系人姓名 *</label><input id="zp-name" name="contactName" required maxLength={80} className={field} autoComplete="name" /></div>
        <div><label className={label} htmlFor="zp-wechat">微信号</label><input id="zp-wechat" name="wechatId" maxLength={60} className={field} /></div>
        <div><label className={label} htmlFor="zp-email">邮箱</label><input id="zp-email" name="email" type="email" maxLength={120} className={field} autoComplete="email" /></div>
        <div><label className={label} htmlFor="zp-phone">电话</label><input id="zp-phone" name="phone" maxLength={30} className={field} autoComplete="tel" /></div>
        <div><label className={label} htmlFor="zp-city">所在城市</label><input id="zp-city" name="city" maxLength={60} className={field} placeholder="例如：曼谷、上海" /></div>
        <div>
          <label className={label} htmlFor="zp-country">国家 / 地区 *</label>
          <select id="zp-country" name="country" required className={field} defaultValue="">
            <option value="" disabled>— 请选择 —</option>
            {ZH_COUNTRIES.map((v) => <option key={v} value={v}>{COUNTRY_LABELS[v]}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className={label} htmlFor="zp-web">机构网站（选填）</label><input id="zp-web" name="orgWebsite" type="url" maxLength={200} className={field} placeholder="https://" /></div>
      </div>

      <fieldset>
        <legend className={label}>希望合作的服务 *（可多选）</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ZH_PARTNER_SERVICES.map((v) => (
            <label key={v} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
              <input type="checkbox" name="services" value={v} className="h-4 w-4 accent-primary" />
              {PARTNER_SERVICE_LABELS[v]?.zh ?? v}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className={label} htmlFor="zp-volume">预计委托频率 *</label>
        <select id="zp-volume" name="expectedVolume" required className={field} defaultValue="occasional">
          {ZH_PARTNER_VOLUMES.map((v) => <option key={v} value={v}>{VOLUME_LABELS[v]}</option>)}
        </select>
      </div>
      <div>
        <label className={label} htmlFor="zp-msg">补充说明（选填）</label>
        <textarea id="zp-msg" name="message" rows={3} maxLength={1500} className={field} placeholder="您的客户类型、常见需求、希望的合作方式（转介 / 分包 / 白标报告）。" />
      </div>

      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="zp-website">Website</label>
        <input id="zp-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-primary" />
        <span>我已阅读并同意 <a href="/zh/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">隐私政策</a>，同意贵公司存储并使用以上信息以便联系我讨论合作。*</span>
      </label>

      {state === "error" && <p ref={errorRef} tabIndex={-1} className="rounded-lg border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive outline-none" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> 提交中…</> : "提交合作申请"}
      </button>
    </form>
  );
}
