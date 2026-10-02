"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Phone, Mail } from "lucide-react";
import { LineIcon, WhatsAppIcon, FacebookIcon } from "@/components/marketing/brand-icons";
import { TrackedLink } from "@/components/marketing/tracked-link";
import { CONTACT } from "@/lib/marketing/contact";
import { FAB_AUTO_OPEN_DELAY_MS, shouldAutoOpenFab } from "@/lib/marketing/overlay-policy";

type Lang = "th" | "en" | "zh";

const COPY: Record<Lang, { title: string; call: string; email: string; close: string; open: string }> = {
  th: { title: "ติดต่อนักสืบ — ปรึกษาฟรี", call: `โทร ${CONTACT.phoneDisplay}`, email: "อีเมล", close: "ปิด", open: "ช่องทางติดต่อ" },
  en: { title: "Contact us — free consult", call: `Call ${CONTACT.phoneDisplay}`, email: "Email", close: "Close", open: "Contact options" },
  zh: { title: "联系我们 — 免费咨询", call: `致电 ${CONTACT.phoneDisplay}`, email: "邮箱", close: "关闭", open: "联系方式" },
};

function detectLang(pathname: string): Lang {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh";
  return "th";
}

/**
 * Floating contact widget for the marketing site — always visible on every page,
 * expands to the firm's contact channels. On desktop it auto-opens once per
 * session shortly after load; on mobile it stays closed (the sticky contact bar
 * already shows the channels) — see lib/marketing/overlay-policy.ts.
 */
export function ContactFab() {
  const lang = detectLang(usePathname() || "/");
  const t = COPY[lang];
  const line = { label: "LINE", href: CONTACT.lineUrl, bg: "#048739", icon: <LineIcon className="h-5 w-5" /> };
  const whatsapp = { label: "WhatsApp", href: CONTACT.whatsappUrl, bg: "#178741", icon: <WhatsAppIcon className="h-5 w-5" /> };
  const call = { label: t.call, href: CONTACT.phoneTel, bg: "#2563eb", icon: <Phone className="h-5 w-5" /> };
  const facebook = { label: "Facebook", href: CONTACT.facebookUrl, bg: "#1772e8", icon: <FacebookIcon className="h-5 w-5" /> };
  const email = { label: t.email, href: CONTACT.mailto, bg: "#6b7280", icon: <Mail className="h-5 w-5" /> };
  // Channel order follows what each audience actually uses: Thai → LINE first;
  // English → WhatsApp, then email (corporate), phone; LINE last.
  const channels = lang === "en" ? [whatsapp, email, call, line, facebook] : [line, whatsapp, call, facebook, email];
  const [open, setOpen] = useState(false);
  const [nudged, setNudged] = useState(false);

  useEffect(() => {
    // Pop the panel open once per session on desktop only, then leave it to the user.
    let alreadyShown = false;
    try { alreadyShown = !!sessionStorage.getItem("dp_contact_nudged"); } catch { /* storage blocked */ }
    if (alreadyShown) { setNudged(true); return; }
    if (!shouldAutoOpenFab({ viewportWidth: window.innerWidth, alreadyShown })) return;
    const t = setTimeout(() => {
      setOpen(true);
      setNudged(true);
      try { sessionStorage.setItem("dp_contact_nudged", "1"); } catch { /* storage blocked */ }
    }, FAB_AUTO_OPEN_DELAY_MS);
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
              <TrackedLink
                key={c.label}
                href={c.href}
                placement="fab"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: c.bg }}
              >
                {c.icon} {c.label}
              </TrackedLink>
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
