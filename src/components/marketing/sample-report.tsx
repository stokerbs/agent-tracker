import { FileText } from "lucide-react";
import { FileTag, CornerTicks } from "@/components/marketing/ui";
import { TrackedLink } from "@/components/marketing/tracked-link";
import { FACTS } from "@/lib/marketing/facts";
import type { PageLang } from "@/lib/marketing/pages/types";

const COPY: Record<PageLang, { tag: string; title: string; body: string; cta: string }> = {
  th: {
    tag: "Sample · ตัวอย่างรายงาน",
    title: "ตัวอย่างรายงานที่ปกปิดข้อมูลแล้ว",
    body: "ดูว่ารายงานจริงหน้าตาเป็นอย่างไร: สรุปผู้บริหาร ไทม์ไลน์ ภาพประกอบ และแหล่งที่มา ชื่อ สถานที่ และรายละเอียดที่ระบุตัวตนถูกลบออกทั้งหมด",
    cta: "เปิดตัวอย่างรายงาน (PDF)",
  },
  en: {
    tag: "Sample · Redacted report",
    title: "A redacted sample report",
    body: "See what a real report looks like: executive summary, timeline, photos and sources. Names, places and every identifying detail have been removed.",
    cta: "Open the sample report (PDF)",
  },
};

/**
 * Redacted sample-report block for the how-it-works pages. Renders nothing
 * until the owner supplies FACTS.pending.sampleReportUrl (audit Days 31–90:
 * "redacted sample report on how-it-works") — never a placeholder document.
 */
export function SampleReport({ lang }: { lang: PageLang }) {
  const url = FACTS.pending.sampleReportUrl;
  if (!url) return null;
  const t = COPY[lang];
  return (
    <section className="mx-auto max-w-3xl px-4 pb-14">
      <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-6 sm:p-8">
        <CornerTicks />
        <FileTag>{t.tag}</FileTag>
        <h2 className="mt-3 font-serif text-xl font-bold">{t.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
        <TrackedLink href={url} placement="inline" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <FileText className="h-4 w-4" /> {t.cta}
        </TrackedLink>
      </div>
    </section>
  );
}
