"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X, Phone, Mail } from "lucide-react";
import { LineIcon, WhatsAppIcon, FacebookIcon } from "@/components/marketing/brand-icons";

// The firm's real contact channels (same as the old WordPress site).
const CHANNELS: { label: string; href: string; bg: string; icon: React.ReactNode }[] = [
  { label: "LINE", href: "https://lin.ee/SSqk98x", bg: "#06C755", icon: <LineIcon className="h-5 w-5" /> },
  { label: "WhatsApp", href: "https://api.whatsapp.com/send?phone=+66809188324", bg: "#25D366", icon: <WhatsAppIcon className="h-5 w-5" /> },
  { label: "โทร 096 846 1406", href: "tel:+66968461406", bg: "#2563eb", icon: <Phone className="h-5 w-5" /> },
  { label: "Facebook", href: "https://www.facebook.com/Detectivepluse.th", bg: "#1877F2", icon: <FacebookIcon className="h-5 w-5" /> },
  { label: "อีเมล", href: "mailto:detectivepluse@gmail.com", bg: "#6b7280", icon: <Mail className="h-5 w-5" /> },
];

/**
 * Floating contact widget for the marketing site — always visible on every page,
 * expands to the firm's contact channels. Auto-opens once shortly after load
 * (like the old WP popup) so customers immediately see how to reach us.
 */
export function ContactFab() {
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
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Channel panel */}
      {open && (
        <div className="w-60 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/60 bg-primary px-4 py-3 text-primary-foreground">
            <span className="text-sm font-semibold">ติดต่อนักสืบ — ปรึกษาฟรี</span>
            <button onClick={() => setOpen(false)} aria-label="ปิด"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-col gap-2 p-3">
            {CHANNELS.map((c) => (
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
        aria-label="ช่องทางติดต่อ"
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
