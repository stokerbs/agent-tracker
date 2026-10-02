"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { LineIcon, WhatsAppIcon } from "@/components/marketing/brand-icons";
import { TrackedLink } from "@/components/marketing/tracked-link";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { useMarketingLang, type MarketingLang } from "@/components/marketing/use-marketing-lang";
import { CONTACT } from "@/lib/marketing/contact";

const COPY: Record<MarketingLang, { call: string; line: string; whatsapp: string }> = {
  th: { call: "โทรเลย", line: "ปรึกษาฟรี LINE", whatsapp: "WhatsApp" },
  en: { call: "Call now", line: "LINE", whatsapp: "Free WhatsApp consult" },
  zh: { call: "立即致电", line: "LINE 免费咨询", whatsapp: "WhatsApp" },
};

/**
 * Slim always-actionable contact bar pinned to the bottom on mobile (hidden on
 * desktop, which has the floating buttons + hero CTAs). Appears after the user
 * scrolls past the hero so it doesn't cover the first screen. High-intent
 * one-tap Call / LINE — a proven mobile conversion lift.
 */
export function StickyContactBar() {
  const lang = useMarketingLang();
  const t = COPY[lang];
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
      {lang === "zh" ? (
        // Chinese visitors: WeChat is the primary channel; the structured
        // intake is the secondary. (LINE/phone are kept for TH/EN.)
        <>
          <Link href="/zh/contact#intake" className="flex flex-1 items-center justify-center gap-2 py-3 font-semibold text-primary">
            <FileText className="h-5 w-5" /> 提交案件资料
          </Link>
          <WeChatCta placement="sticky" className="flex-1 !rounded-none py-3" />
        </>
      ) : (
      <>
      <TrackedLink href={CONTACT.phoneTel} placement="sticky" className="flex flex-1 items-center justify-center gap-2 py-3 font-semibold text-primary">
        <Phone className="h-5 w-5" /> {t.call}
      </TrackedLink>
      {lang === "en" ? (
        // English visitors: WhatsApp is the channel they actually have.
        <TrackedLink
          href={CONTACT.whatsappUrl}
          placement="sticky"
          className="flex flex-1 items-center justify-center gap-2 bg-[#178741] py-3 font-semibold text-white"
        >
          <WhatsAppIcon className="h-5 w-5" /> {t.whatsapp}
        </TrackedLink>
      ) : (
        <TrackedLink
          href={CONTACT.lineUrl}
          placement="sticky"
          className="flex flex-1 items-center justify-center gap-2 bg-[#048739] py-3 font-semibold text-white"
        >
          <LineIcon className="h-5 w-5" /> {t.line}
        </TrackedLink>
      )}
      </>
      )}
    </div>
  );
}
