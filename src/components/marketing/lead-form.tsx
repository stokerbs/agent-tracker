"use client";

import { useState } from "react";
import { Send, CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { sendGTMEvent } from "@next/third-parties/google";

type Lang = "th" | "en" | "zh";

const COPY = {
  th: {
    name: "ชื่อของคุณ",
    phone: "เบอร์โทร หรือ LINE ID",
    email: "อีเมล (ไม่บังคับ)",
    emailInvalid: "รูปแบบอีเมลไม่ถูกต้อง",
    caseType: "ประเภทเรื่องที่ต้องการสืบ",
    caseOptions: ["สืบชู้สาว", "สืบทรัพย์สิน", "เช็คประวัติบุคคล", "ตามหาคน", "นักสืบไอที / ออนไลน์", "อื่น ๆ"],
    choose: "— เลือกประเภท —",
    message: "รายละเอียดเพิ่มเติม (ไม่บังคับ)",
    consent: "ฉันยินยอมให้เก็บและใช้ข้อมูลนี้เพื่อติดต่อกลับ ตาม",
    consentLink: "นโยบายความเป็นส่วนตัว",
    consentRequired: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่ง",
    submit: "ส่งข้อมูล ให้เราติดต่อกลับ",
    sending: "กำลังส่ง...",
    successTitle: "ได้รับข้อมูลแล้ว",
    successBody: "ทีมนักสืบจะติดต่อกลับโดยเร็ว — หรือทักแชทเลยเพื่อความรวดเร็ว",
    chat: "ทักแชท LINE ทันที",
    errRate: "ส่งบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ หรือทักไลน์เราได้เลย",
    errGeneric: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือทักไลน์เราได้เลย",
    required: "กรุณากรอกชื่อและเบอร์ติดต่อ",
  },
  en: {
    name: "Your name",
    phone: "Phone or LINE ID",
    email: "Email (optional)",
    emailInvalid: "That email doesn't look right",
    caseType: "What do you need investigated?",
    caseOptions: ["Cheating spouse", "Asset search", "Background check", "Find a person", "Cyber / online", "Other"],
    choose: "— Select —",
    message: "More details (optional)",
    consent: "I consent to my information being stored and used to contact me, per the",
    consentLink: "Privacy Policy",
    consentRequired: "Please accept the Privacy Policy before sending",
    submit: "Send — we'll contact you",
    sending: "Sending...",
    successTitle: "Message received",
    successBody: "Our investigators will get back to you shortly — or chat now for a faster reply.",
    chat: "Chat on LINE now",
    errRate: "Too many submissions. Please wait a moment and try again, or message us on LINE.",
    errGeneric: "Couldn't send. Please try again, or message us on LINE.",
    required: "Please enter your name and a contact.",
  },
  zh: {
    name: "您的姓名",
    phone: "电话 或 LINE ID",
    email: "邮箱（选填）",
    emailInvalid: "邮箱格式不正确",
    caseType: "您需要调查什么？",
    caseOptions: ["婚外情调查", "财产调查", "背景调查", "寻人", "网络 / 线上调查", "其他"],
    choose: "— 请选择 —",
    message: "更多详情（选填）",
    consent: "我同意贵公司存储并使用我的信息以便联系我，依据",
    consentLink: "隐私政策",
    consentRequired: "请先同意隐私政策再提交",
    submit: "提交 — 我们会尽快联系您",
    sending: "提交中…",
    successTitle: "已收到您的信息",
    successBody: "我们的调查团队会尽快与您联系 — 或直接在 LINE 上聊天以获得更快回复。",
    chat: "立即在 LINE 咨询",
    errRate: "提交过于频繁，请稍候再试，或在 LINE 上联系我们。",
    errGeneric: "提交失败，请重试，或在 LINE 上联系我们。",
    required: "请填写姓名和联系方式。",
  },
} as const;

const LINE_URL = "https://lin.ee/SSqk98x";

export function LeadForm({ lang = "th" }: { lang?: Lang }) {
  const t = COPY[lang];
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    if (!name || !phone) {
      setState("error");
      setError(t.required);
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("error");
      setError(t.emailInvalid);
      return;
    }
    if (!fd.get("consent")) {
      setState("error");
      setError(t.consentRequired);
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/marketing/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          caseType: String(fd.get("caseType") ?? "") || undefined,
          message: String(fd.get("message") ?? "") || undefined,
          locale: lang,
          consent: true,
          website: String(fd.get("website") ?? ""),
        }),
      });
      if (res.ok) {
        // Fires the GTM dataLayer event so a GA4 / Google Ads conversion tag
        // can be wired to it in GTM's UI, with no further code changes.
        sendGTMEvent({ event: "lead_submitted", case_type: fd.get("caseType") ?? undefined, locale: lang });
        setState("done");
        form.reset();
        return;
      }
      setState("error");
      setError(res.status === 429 ? t.errRate : t.errGeneric);
    } catch {
      setState("error");
      setError(t.errGeneric);
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-3 font-serif text-lg font-bold">{t.successTitle}</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{t.successBody}</p>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> {t.chat}
        </a>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background/60 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60";

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-3 text-left">
      {/* Honeypot — visually hidden, off-screen; bots fill it, humans don't. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required maxLength={80} placeholder={t.name} className={inputCls} />
        <input name="phone" required maxLength={30} placeholder={t.phone} className={inputCls} />
      </div>
      <input name="email" type="email" inputMode="email" autoComplete="email" maxLength={120} placeholder={t.email} className={inputCls} />
      <select name="caseType" defaultValue="" className={inputCls} aria-label={t.caseType}>
        <option value="" disabled>{t.choose}</option>
        {t.caseOptions.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <textarea name="message" rows={3} maxLength={1000} placeholder={t.message} className={inputCls} />

      <label className="flex items-start gap-2 text-left text-xs leading-relaxed text-muted-foreground">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
        <span>
          {t.consent}{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">
            {t.consentLink}
          </a>
        </span>
      </label>

      {state === "error" && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state === "sending" ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> {t.sending}</>
        ) : (
          <><Send className="h-4 w-4" /> {t.submit}</>
        )}
      </button>
    </form>
  );
}
