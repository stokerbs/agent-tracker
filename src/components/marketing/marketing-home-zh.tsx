import Link from "next/link";
import Image from "next/image";
import {
  Search, HeartCrack, Wallet, MapPin, Smartphone, UserSearch, ShieldCheck,
  PhoneCall, ArrowRight, PlayCircle, Crosshair, Fingerprint, Star,
} from "lucide-react";
import { SectionHeading, FileTag, Stamp, CornerTicks } from "@/components/marketing/ui";
import { DetectiveHero } from "@/components/marketing/detective-hero";
import { StatBand } from "@/components/marketing/stat-band";
import { Faq } from "@/components/marketing/faq";
import { LeadForm } from "@/components/marketing/lead-form";
import { MarketingJsonLd } from "@/components/marketing/json-ld";
import { ArticleCover } from "@/components/marketing/article-cover";
import { LineIcon, WhatsAppIcon, FacebookIcon, WeChatIcon } from "@/components/marketing/brand-icons";
import { FAQ_ZH } from "@/lib/marketing/faq";
import { getPublishedArticlesZh } from "@/lib/marketing/articles-db";

const YOUTUBE_URL = "https://www.youtube.com/watch?v=-sYx6i8OBF0";

// Services link to #contact — there are no ZH article pages yet, so the cards
// drive to the enquiry form rather than a dead link.
const SERVICES: { label: string; blurb: string; Icon: typeof Search }[] = [
  { label: "婚外情调查", blurb: "谨慎追踪伴侣行为，收集可用于法庭的证据。", Icon: HeartCrack },
  { label: "财产调查", blurb: "在起诉或强制执行前，追查并核实债务人的资产。", Icon: Wallet },
  { label: "背景调查", blurb: "在信任或雇用之前，核实对方的履历与信誉。", Icon: UserSearch },
  { label: "寻人", blurb: "寻找失踪人员、失联亲属或躲藏的债务人。", Icon: MapPin },
  { label: "网络调查", blurb: "社交媒体、网络诈骗与数字足迹调查。", Icon: Smartphone },
  { label: "聘请侦探", blurb: "服务、流程与收费 —— 如何聘请值得信赖的专业侦探。", Icon: Search },
];

const PROCESS = ["沟通案件详情", "确认价格", "支付首期款（50%）", "开始调查", "交付结果前支付尾款"];

const WHY = [
  { Icon: ShieldCheck, title: "严格保密", desc: "每位客户的信息都严格保密。" },
  { Icon: Search, title: "专业可靠", desc: "经验丰富的调查团队，成果有口皆碑。" },
  { Icon: MapPin, title: "全国服务", desc: "我们承接全泰国范围的案件。" },
];

const REVIEW_RATING = "4.8";
const REVIEW_COUNT = 63;
const TESTIMONIALS: { name: string; date: string; stars: number; text: string }[] = [
  { name: "pingpong27", date: "07/02/2026", stars: 5, text: "又快又准，100% 准确。比承诺的还快 —— 说要 1–2 天，结果不到半天就拿到了完整无误的信息。" },
  { name: "Nattavara", date: "13/01/2026", stars: 5, text: "查到的信息之详尽令我震惊，非常推荐。" },
  { name: "Fastwork 客户", date: "10/06/2026", stars: 5, text: "服务非常好，团队让我印象深刻，全程持续更新进度。真心推荐给需要的人。" },
  { name: "Fastwork 客户", date: "25/12/2025", stars: 4, text: "工作出色、建议中肯，结果超出预期，完全可以信赖。" },
  { name: "Fastwork 客户", date: "15/08/2025", stars: 5, text: "非常专业。" },
];

export async function MarketingHomeZH() {
  const articles = (await getPublishedArticlesZh()).slice(0, 6);
  return (
    <>
      <MarketingJsonLd faq={FAQ_ZH} />
      {/* Hero */}
      <DetectiveHero
        caseNo="CASE FILE №DP-∞"
        statusLabel="File Open"
        recLabel="REC"
        eyebrow="Case File · 立案调查"
        titleLead="泰国专业"
        titleAccent="私家侦探"
        titleRest="全国承接案件"
        subtitle="婚外情、财产调查、寻人、背景核查与网络调查 —— 以专业手法取得清晰证据，全程严格保密。"
        ctas={[
          { href: "https://lin.ee/SSqk98x", label: "LINE 免费咨询", icon: <LineIcon className="h-5 w-5" />, className: "bg-[#048739] font-medium text-white", external: true },
          { href: "https://api.whatsapp.com/send?phone=+66809188324", label: "WhatsApp 联系", icon: <WhatsAppIcon className="h-5 w-5" />, className: "bg-[#178741] font-semibold text-white", external: true },
          { href: "#contact", label: "联系我们", icon: <ArrowRight className="h-4 w-4 order-last" />, className: "border border-border font-medium hover:bg-muted" },
        ]}
        tagline="// 锲而不舍 · 保密 · 全国"
        scrollLabel="向下滚动查看案卷"
      />

      {/* Credibility stats */}
      <StatBand
        eyebrow="Track Record · 数据实绩"
        stats={[
          { value: new Date().getFullYear() - 2016, suffix: "+", label: "年经验" },
          { value: 1953, suffix: "+", label: "已结案件" },
          { value: Number(REVIEW_RATING), decimals: 1, label: "平均评分（满分 5）" },
          { value: 77, label: "覆盖府数" },
        ]}
      />

      {/* Video */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <SectionHeading eyebrow="Evidence Reel · 介绍" title="关于 Detective Pulse" />
        <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer" className="group relative mt-8 block overflow-hidden rounded-xl border border-border bg-card">
          <CornerTicks />
          <Image src="/marketing/video-cover.png" alt="Detective Pulse 介绍视频" width={600} height={369} sizes="(max-width: 768px) 100vw, 768px" className="h-auto w-full" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover:bg-black/45">
            <PlayCircle className="h-16 w-16 text-white drop-shadow-lg transition-transform group-hover:scale-110" />
          </span>
          <span className="absolute left-3 top-3"><FileTag>REC ●</FileTag></span>
        </a>
      </section>

      {/* Services */}
      <section id="services" className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Active Cases · 服务" title="我们的服务" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <a key={s.label} href="#contact" className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/50">
                <CornerTicks />
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors group-hover:border-primary/60">
                    <s.Icon className="h-5 w-5" />
                  </span>
                  <FileTag>{`CASE ${String(i + 1).padStart(2, "0")}`}</FileTag>
                </div>
                <h3 className="mt-4 font-serif text-lg font-bold group-hover:text-primary">{s.label}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary/80">
                  咨询详情 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow="Credentials · 为什么选我们" title="为什么选择 Detective Pulse" />
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.title} className="dp-reveal text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary shadow-[inset_0_0_0_4px_hsl(var(--primary)/0.08)]">
                <w.Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-serif text-lg font-bold">{w.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <SectionHeading eyebrow="Protocol · 工作流程" title="工作流程" />
          <ol className="relative mt-10 space-y-6 before:absolute before:left-[15px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
            {PROCESS.map((step, i) => (
              <li key={i} className="dp-reveal relative flex items-start gap-4">
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-background font-mono text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="pt-1 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">* 若客户取消，定金不予退还。</p>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow="Exhibits · Fastwork 认证" title="客户评价" sub="感谢所有客户的信任 · 滑动查看 →" />
        <div className="mx-auto mt-8 flex w-fit items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 px-6 py-4">
          <span className="font-serif text-4xl font-bold text-primary">{REVIEW_RATING}</span>
          <div className="flex flex-col">
            <span className="flex gap-0.5 text-primary">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-primary text-primary" />
              ))}
            </span>
            <span className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{REVIEW_COUNT} 条评价 · Fastwork</span>
          </div>
        </div>
        <div className="mt-8 flex items-stretch gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
          {TESTIMONIALS.map((r, i) => (
            <figure key={i} className="relative flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card p-6">
              <CornerTicks />
              <div className="flex items-center justify-between">
                <span className="flex gap-0.5 text-primary">
                  {Array.from({ length: r.stars }).map((_, s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-primary text-primary" />
                  ))}
                </span>
                <FileTag>{`EXHIBIT ${String.fromCharCode(65 + i)}`}</FileTag>
              </div>
              <blockquote className="mt-4 font-serif text-base leading-relaxed text-foreground/95">“{r.text}”</blockquote>
              <figcaption className="mt-auto flex items-center gap-2 pt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <span className="h-px w-4 bg-primary/50" /> {r.name} · {r.date}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Articles (only if ZH articles have been published) */}
      {articles.length > 0 && (
        <section id="articles" className="border-t border-border/60 bg-card/30">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <SectionHeading eyebrow="Field Notes · 文章" title="文章与指南" sub="滑动查看 →" />
            <div className="mt-8 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
              {articles.map((a, i) => (
                <Link key={a.id} href={`/zh/articles/${a.zh_slug}`} className="group w-60 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
                  <ArticleCover slug={a.zh_slug ?? a.en_slug} title={a.zh_title ?? a.en_title} index={i} lang="en" />
                  <div className="p-3.5">
                    <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{a.zh_title}</h3>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link href="/zh/articles" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/10">
                查看全部文章 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <div className="border-t border-border/60">
        <Faq items={FAQ_ZH} eyebrow="Briefing · 常见问题" title="常见问题" />
      </div>

      {/* Contact */}
      <section id="contact" className="relative overflow-hidden border-t border-border/60 bg-card/30">
        <Crosshair aria-hidden className="pointer-events-none absolute -left-8 bottom-0 h-64 w-64 text-primary/[0.04]" />
        <Fingerprint aria-hidden className="pointer-events-none absolute -right-10 top-10 h-72 w-72 text-primary/[0.03]" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <Stamp className="mb-6">Confidential</Stamp>
          <SectionHeading eyebrow="立案 · 联系我们" title="想知道真相？我们能帮您。" sub="首次咨询免费，每个案件都严格保密 —— 留下您的信息，或直接与我们联系。" />
          <div className="mt-8">
            <LeadForm lang="zh" />
          </div>
          <div className="mt-8 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px w-8 bg-border" /> 或直接联系 <span className="h-px w-8 bg-border" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href="https://lin.ee/SSqk98x" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#048739] px-5 py-2.5 font-medium text-white hover:opacity-90"><LineIcon className="h-5 w-5" /> LINE</a>
            <a href="https://api.whatsapp.com/send?phone=+66809188324" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#178741] px-5 py-2.5 font-medium text-white hover:opacity-90"><WhatsAppIcon className="h-5 w-5" /> WhatsApp</a>
            <a href="https://www.facebook.com/Detectivepluse.th" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#1772e8] px-5 py-2.5 font-medium text-white hover:opacity-90"><FacebookIcon className="h-5 w-5" /> Facebook</a>
            <a href="tel:+66809188324" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-mono text-xs hover:bg-muted"><PhoneCall className="h-4 w-4 text-primary" /> +66 80 918 8324</a>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-xs text-muted-foreground"><WeChatIcon className="h-4 w-4 text-primary" /> WeChat: DetectivePulse</span>
          </div>
        </div>
      </section>
    </>
  );
}
