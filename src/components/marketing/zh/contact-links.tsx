"use client";

import { Mail, FileText } from "lucide-react";
import Link from "next/link";
import { WhatsAppIcon } from "@/components/marketing/brand-icons";
import { ZH_COMPANY } from "@/lib/marketing/zh/company";
import { track, currentPage } from "@/lib/marketing/analytics";

/** Secondary contact channels for Chinese pages (tracked). */
export function ZhContactLinks({ showIntake = true }: { showIntake?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
      {showIntake && (
        <Link href="/zh/contact#intake" className="inline-flex items-center gap-2 rounded-lg border border-primary/50 px-5 py-2.5 font-medium text-primary hover:bg-primary/10">
          <FileText className="h-4 w-4" /> 提交案件资料
        </Link>
      )}
      <a
        href={ZH_COMPANY.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track({ event: "contact_click", channel: "whatsapp", page: currentPage() })}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 hover:bg-muted"
      >
        <WhatsAppIcon className="h-4 w-4 text-[#178741]" /> WhatsApp
      </a>
      <a
        href={`mailto:${ZH_COMPANY.email}`}
        onClick={() => track({ event: "contact_click", channel: "email", page: currentPage() })}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 hover:bg-muted"
      >
        <Mail className="h-4 w-4 text-primary" /> 邮件
      </a>
    </div>
  );
}
