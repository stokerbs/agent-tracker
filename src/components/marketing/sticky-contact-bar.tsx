"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { LineIcon } from "@/components/marketing/brand-icons";
import { useMarketingLang, type MarketingLang } from "@/components/marketing/use-marketing-lang";

const COPY: Record<MarketingLang, { call: string; line: string }> = {
  th: { call: "โทรเลย", line: "ปรึกษาฟรี LINE" },
  en: { call: "Call now", line: "Free LINE consult" },
  zh: { call: "立即致电", line: "LINE 免费咨询" },
};

/**
 * Slim always-actionable contact bar pinned to the bottom on mobile (hidden on
 * desktop, which has the floating buttons + hero CTAs). Appears after the user
 * scrolls past the hero so it doesn't cover the first screen. High-intent
 * one-tap Call / LINE — a proven mobile conversion lift.
 */
export function StickyContactBar() {
  const t = COPY[useMarketingLang()];
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 flex border-t border-border/60 bg-background/95 backdrop-blur transition-transform duration-300 lg:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <a href="tel:+66968461406" className="flex flex-1 items-center justify-center gap-2 py-3 font-semibold text-primary">
        <Phone className="h-5 w-5" /> {t.call}
      </a>
      <a
        href="https://lin.ee/SSqk98x"
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 items-center justify-center gap-2 bg-[#048739] py-3 font-semibold text-white"
      >
        <LineIcon className="h-5 w-5" /> {t.line}
      </a>
    </div>
  );
}
