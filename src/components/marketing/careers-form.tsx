"use client";

import { useState } from "react";
import { Send, CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { sendGTMEvent } from "@next/third-parties/google";

type Lang = "th" | "en";

const COPY = {
  th: {
    name: "ชื่อ - นามสกุล",
    phone: "เบอร์โทร หรือ LINE ID",
    email: "อีเมล (ไม่บังคับ)",
    emailInvalid: "รูปแบบอีเมลไม่ถูกต้อง",
    position: "ตำแหน่งที่สนใจ",
    positionOptions: ["นักสืบภาคสนาม", "นักสืบไอที / ออนไลน์", "ทีมวิเคราะห์ข้อมูล", "ประสานงาน / ธุรการ", "อื่น ๆ"],
    choose: "— เลือกตำแหน่ง —",
    experience: "ประสบการณ์ / พื้นเพโดยย่อ (ไม่บังคับ)",
    message: "แนะนำตัว / ทำไมอยากร่วมงานกับเรา (ไม่บังคับ)",
    consent: "ฉันยินยอมให้เก็บและใช้ข้อมูลนี้เพื่อพิจารณารับสมัคร ตาม",
    consentLink: "นโยบายความเป็นส่วนตัว",
    consentRequired: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนส่ง",
    submit: "ส่งใบสมัคร",
    sending: "กำลังส่ง...",
    successTitle: "ได้รับใบสมัครแล้ว",
    successBody: "ทีมงานจะพิจารณาและติดต่อกลับ — หรือทักแชทเพื่อสอบถามเพิ่มเติม",
    chat: "ทักแชท LINE",
    errRate: "ส่งบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ หรือทักไลน์เราได้เลย",
    errGeneric: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือทักไลน์เราได้เลย",
    required: "กรุณากรอกชื่อและเบอร์ติดต่อ",
  },
  en: {
    name: "Full name",
    phone: "Phone or LINE ID",
    email: "Email (optional)",
    emailInvalid: "That email doesn't look right",
    position: "Role you're interested in",
    positionOptions: ["Field investigator", "Cyber / online investigator", "Data analysis team", "Coordination / admin", "Other"],
    choose: "— Select a role —",
    experience: "Experience / short background (optional)",
    message: "Introduce yourself / why join us (optional)",
    consent: "I consent to my information being stored and used to assess my application, per the",
    consentLink: "Privacy Policy",
    consentRequired: "Please accept the Privacy Policy before sending",
    submit: "Send application",
    sending: "Sending...",
    successTitle: "Application received",
    successBody: "Our team will review it and get back to you — or chat with us if you have questions.",
    chat: "Chat on LINE",
    errRate: "Too many submissions. Please wait a moment and try again, or message us on LINE.",
    errGeneric: "Couldn't send. Please try again, or message us on LINE.",
    required: "Please enter your name and a contact.",
  },
} as const;

const LINE_URL = "https://lin.ee/SSqk98x";

export function CareersForm({ lang = "th" }: { lang?: Lang }) {
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
      const res = await fetch("/api/marketing/careers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          position: String(fd.get("position") ?? "") || undefined,
          experience: String(fd.get("experience") ?? "") || undefined,
          message: String(fd.get("message") ?? "") || undefined,
          locale: lang,
          consent: true,
          website: String(fd.get("website") ?? ""),
        }),
      });
      if (res.ok) {
        sendGTMEvent({ event: "career_application", position: fd.get("position") ?? undefined, locale: lang });
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
      <select name="position" defaultValue="" className={inputCls} aria-label={t.position}>
        <option value="" disabled>{t.choose}</option>
        {t.positionOptions.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <input name="experience" maxLength={300} placeholder={t.experience} className={inputCls} />
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
