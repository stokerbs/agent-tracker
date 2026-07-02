import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, PhoneCall, ShieldCheck, Star } from "lucide-react";
import { DetectiveHero } from "@/components/marketing/detective-hero";
import { SectionHeading, Stamp } from "@/components/marketing/ui";
import { LeadForm } from "@/components/marketing/lead-form";
import { LineIcon, WhatsAppIcon } from "@/components/marketing/brand-icons";
import { LANDING_PAGES, getLandingPage } from "@/lib/marketing/landing-pages";

export const dynamicParams = false; // only the defined campaign pages

export function generateStaticParams() {
  return LANDING_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const lp = getLandingPage(slug);
  if (!lp) return {};
  return {
    title: `${lp.keyword} | Detective Pulse`,
    description: lp.sub,
    // Paid-traffic landing pages — keep them out of the organic index so they
    // don't compete with / dilute the main pages.
    robots: { index: false, follow: false },
    alternates: { canonical: `/lp/${lp.slug}` },
  };
}

export default async function CampaignLanding(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const lp = getLandingPage(slug);
  if (!lp) notFound();

  return (
    <>
      <DetectiveHero
        caseNo="CASE FILE №DP-∞"
        statusLabel="แฟ้มเปิดอยู่"
        recLabel="REC"
        eyebrow="ปรึกษาฟรี · เป็นความลับ"
        titleLead={lp.headlineLead}
        titleAccent={lp.headlineAccent}
        titleRest=""
        subtitle={lp.sub}
        ctas={[
          { href: "https://lin.ee/SSqk98x", label: "ปรึกษาฟรีทาง LINE", icon: <LineIcon className="h-5 w-5" />, className: "bg-[#048739] font-medium text-white", external: true },
          { href: "tel:+66968461406", label: "โทรเลย 096-846-1406", icon: <PhoneCall className="h-4 w-4" />, className: "bg-primary font-semibold text-primary-foreground" },
        ]}
        tagline="// ปิดกว่า 1,900 เคส · คะแนน 4.8/5 · ทั่วราชอาณาจักร"
        scrollLabel="เลื่อนลงดูรายละเอียด"
      />

      {/* Benefits */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <SectionHeading eyebrow="ทำไมต้องเรา" title={`บริการ${lp.headlineAccent === "นอกใจ?" ? "สืบชู้สาว" : lp.keyword.split(" ")[0]}ที่ไว้ใจได้`} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {lp.benefits.map((b) => (
            <div key={b} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm leading-relaxed">{b}</span>
            </div>
          ))}
        </div>

        {/* Trust strip */}
        <div className="mx-auto mt-8 flex w-fit flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl border border-primary/30 bg-primary/5 px-6 py-4 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            <Star className="h-4 w-4 fill-primary" /> 4.8/5
          </span>
          <span className="text-muted-foreground">ปิดแล้วกว่า 1,900 เคส</span>
          <span className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> เป็นความลับ 100%</span>
        </div>
      </section>

      {/* Lead form */}
      <section id="contact" className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <Stamp className="mb-6">Confidential</Stamp>
          <SectionHeading eyebrow="เปิดเคส · ติดต่อเรา" title="ปรึกษาฟรี ไม่มีค่าใช้จ่าย" sub={lp.formIntro} />
          <div className="mt-8">
            <LeadForm lang="th" />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> LINE</a>
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-medium text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> WhatsApp</a>
            <a href="tel:+66968461406" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-mono text-xs hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> 096-846-1406</a>
          </div>
        </div>
      </section>
    </>
  );
}
