"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Phone, Mail } from "lucide-react";
import { LineIcon, WhatsAppIcon, FacebookIcon } from "@/components/marketing/brand-icons";

type Lang = "th" | "en" | "zh";

const COPY: Record<Lang, { title: string; call: string; email: string; close: string; open: string }> = {
  th: { title: "ติดต่อนักสืบ — ปรึกษาฟรี", call: "โทร 096 846 1406", email: "อีเมล", close: "ปิด", open: "ช่องทางติดต่อ" },
  en: { title: "Contact us — free consult", call: "Call 096 846 1406", email: "Email", close: "Close", open: "Contact options" },
  zh: { title: "联系我们 — 免费咨询", call: "致电 096 846 1406", email: "邮箱", close: "关闭", open: "联系方式" },
};

function detectLang(pathname: string): Lang {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh";
  return "th";
}

/**
 * Floating contact widget for the marketing site — always visible on every page,
 * expands to the firm's contact channels. Auto-opens once shortly after load
 * (like the old WP popup) so customers immediately see how to reach us.
 */
export function ContactFab() {
  const t = COPY[detectLang(usePathname() || "/")];
  const channels = [
    { label: "LINE", href: "https://lin.ee/SSqk98x", bg: "#048739", icon: <LineIcon className="h-5 w-5" /> },
    { label: "WhatsApp", href: "https://api.whatsapp.com/send?phone=+66809188324", bg: "#178741", icon: <WhatsAppIcon className="h-5 w-5" /> },
    { label: t.call, href: "tel:+66968461406", bg: "#2563eb", icon: <Phone className="h-5 w-5" /> },
    { label: "Facebook", href: "https://www.facebook.com/Detectivepluse.th", bg: "#1772e8", icon: <FacebookIcon className="h-5 w-5" /> },
    { label: t.email, href: "mailto:detectivepluse@gmail.com", bg: "#6b7280", icon: <Mail className="h-5 w-5" /> },
  ];
  const [open, setOpen] = useState(false);
  const [nudged, setNudged] = useState(false);

  useEffect(() => {
    // Pop the panel open once on first visit, then leave it to the user.
    if (sessionStorage.getItem("dp_contact_nudged")) { setNudged(true); return; }
    const t = setTimeout(() => {
      setOpen(true);
      setNudged(true);
      sessionStorage.setItem("dp_contact_nudged", "1");
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed bottom-[4.75rem] right-5 z-50 lg:bottom-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Channel panel — absolutely positioned above the toggle so opening it
          never resizes this fixed container (that resize was the site's entire
          Cumulative Layout Shift when the panel auto-opens). */}
      {open && (
        <div className="absolute bottom-[4.25rem] right-0 w-60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/60 bg-primary px-4 py-3 text-primary-foreground">
            <span className="text-sm font-semibold">{t.title}</span>
            <button onClick={() => setOpen(false)} aria-label={t.close}><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: c.bg }}
              >
                {c.icon} {c.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t.open}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
      >
        {!open && !nudged && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        )}
        {open ? <X className="relative h-6 w-6" /> : <MessageCircle className="relative h-7 w-7" />}
      </button>
    </div>
  );
}
