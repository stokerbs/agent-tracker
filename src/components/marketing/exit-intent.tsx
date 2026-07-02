"use client";

import { useEffect, useState } from "react";
import { X, Phone } from "lucide-react";
import { LineIcon, WhatsAppIcon } from "@/components/marketing/brand-icons";
import { useMarketingLang, type MarketingLang } from "@/components/marketing/use-marketing-lang";

const COPY: Record<MarketingLang, {
  eyebrow: string; title: string; body: string; line: string; whatsapp: string; call: string; dismiss: string; close: string;
}> = {
  th: {
    eyebrow: "ปรึกษาฟรี · เป็นความลับ",
    title: "เดี๋ยวก่อน — ให้เราช่วยไหม?",
    body: "ปรึกษานักสืบฟรี ไม่มีค่าใช้จ่าย ข้อมูลทุกอย่างเก็บเป็นความลับ ทักมาคุยได้เลย",
    line: "ปรึกษาฟรีทาง LINE", whatsapp: "WhatsApp", call: "โทร 096 846 1406", dismiss: "ไว้ก่อน", close: "ปิด",
  },
  en: {
    eyebrow: "Free consult · Confidential",
    title: "Wait — can we help?",
    body: "Free consultation with an investigator, no obligation, always confidential. Reach out and let's talk.",
    line: "Free consult on LINE", whatsapp: "WhatsApp", call: "Call 096 846 1406", dismiss: "Maybe later", close: "Close",
  },
  zh: {
    eyebrow: "免费咨询 · 严格保密",
    title: "先别走 —— 需要帮忙吗？",
    body: "免费咨询侦探，无任何义务，所有信息严格保密。随时联系我们聊聊。",
    line: "LINE 免费咨询", whatsapp: "WhatsApp", call: "致电 096 846 1406", dismiss: "稍后再说", close: "关闭",
  },
};

const SEEN_KEY = "dp_exit_seen";

/**
 * One-time exit-intent lead recovery. Desktop: fires when the cursor leaves the
 * top of the viewport. Mobile (no mouseout): a fallback timer. Shows once per
 * session and offers the firm's direct contact channels — a low-friction way to
 * recover visitors who are about to leave without converting.
 */
export function ExitIntent() {
  const t = COPY[useMarketingLang()];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return;
    let done = false;
    const trigger = () => {
      if (done) return;
      done = true;
      sessionStorage.setItem(SEEN_KEY, "1");
      setOpen(true);
    };
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };
    document.addEventListener("mouseout", onMouseOut);
    // Mobile fallback — no exit-intent event; nudge after a while of browsing.
    const timer = window.setTimeout(trigger, 40_000);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.clearTimeout(timer);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        className="theme-detective relative w-full max-w-sm overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 text-center text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={() => setOpen(false)} aria-label={t.close} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/80">{t.eyebrow}</p>
        <h2 className="mt-3 font-serif text-2xl font-bold">{t.title}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{t.body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90">
            <LineIcon className="h-5 w-5" /> {t.line}
          </a>
          <div className="flex gap-2">
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#178741] px-4 py-2.5 font-medium text-white hover:opacity-90">
              <WhatsAppIcon className="h-5 w-5" /> {t.whatsapp}
            </a>
            <a href="tel:+66968461406" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
              <Phone className="h-4 w-4 text-primary" /> {t.call}
            </a>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="mt-4 text-xs text-muted-foreground/70 hover:text-muted-foreground">
          {t.dismiss}
        </button>
      </div>
    </div>
  );
}
