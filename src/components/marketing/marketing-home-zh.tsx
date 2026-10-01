import Link from "next/link";
import {
  HeartCrack, Wallet, MapPin, UserSearch, Briefcase, Building2, ShieldCheck, Globe2, MessageSquareText,
  FileCheck2, Receipt, Lock, ArrowRight, Crosshair, Fingerprint, Star, CheckCircle2,
} from "lucide-react";
import { SectionHeading, FileTag, Stamp, CornerTicks } from "@/components/marketing/ui";
import { DetectiveHero } from "@/components/marketing/detective-hero";
import { StatBand } from "@/components/marketing/stat-band";
import { Faq } from "@/components/marketing/faq";
import { ArticleCover } from "@/components/marketing/article-cover";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { ZhContactLinks } from "@/components/marketing/zh/contact-links";
import { ZhPageView } from "@/components/marketing/zh/zh-page-view";
import { ZhBusinessJsonLd } from "@/components/marketing/zh/zh-json-ld";
import { ZH_HOME, FAQ_ZH_HOME } from "@/lib/marketing/zh/home";
import { ZH_NAV } from "@/lib/marketing/zh/nav";
import { ZH_COMPANY } from "@/lib/marketing/zh/company";
import { ZH_CASE_STUDIES } from "@/lib/marketing/zh/case-studies";
import { getPublishedArticlesZh } from "@/lib/marketing/articles-db";

const SERVICE_ICONS = { heart: HeartCrack, map: MapPin, user: UserSearch, briefcase: Briefcase, building: Building2, wallet: Wallet } as const;
const TRUST_ICONS = [MapPin, Globe2, MessageSquareText, FileCheck2, Receipt, Lock];

// Review figures/testimonials shown on the existing homepages (Fastwork) — kept
// verbatim; see docs/china-market/16 for the confirmation register.
const TESTIMONIALS: { name: string; date: string; stars: number; text: string }[] = [
  { name: "pingpong27", date: "07/02/2026", stars: 5, text: "又快又准，100% 准确。比承诺的还快 —— 说要 1–2 天，结果不到半天就拿到了完整无误的信息。" },
  { name: "Nattavara", date: "13/01/2026", stars: 5, text: "查到的信息之详尽令我震惊，非常推荐。" },
  { name: "Fastwork 客户", date: "10/06/2026", stars: 5, text: "服务非常好，团队让我印象深刻，全程持续更新进度。真心推荐给需要的人。" },
  { name: "Fastwork 客户", date: "25/12/2025", stars: 4, text: "工作出色、建议中肯，结果超出预期，完全可以信赖。" },
];

/**
 * Chinese homepage — answers, in order: who we are, what we do, where we
 * operate, how it works, what you receive, why trust us, confidentiality,
 * FAQ, contact (docs/china-market/07). WeChat is the primary CTA; the
 * structured intake is secondary.
 */
export async function MarketingHomeZH() {
  const articles = (await getPublishedArticlesZh()).slice(0, 6);
  const h = ZH_HOME;
  return (
    <>
      <ZhPageView page="/zh" service="general" kind="home" />
      <ZhBusinessJsonLd />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "zh-CN", mainEntity: FAQ_ZH_HOME.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }).replace(/</g, "\\u003c") }} />

      {/* 1 · Hero — who we are / what we do */}
      <DetectiveHero
        caseNo="CASE FILE №DP-CN"
        statusLabel="File Open"
        recLabel="REC"
        eyebrow={h.hero.eyebrow}
        titleLead={h.hero.titleLead}
        titleAccent={h.hero.titleAccent}
        titleRest={h.hero.titleRest}
        subtitle={h.hero.subtitle}
        ctas={[
          { href: "/zh/contact#intake", label: "提交案件资料", icon: <ArrowRight className="h-4 w-4 order-last" />, className: "bg-primary font-semibold text-primary-foreground" },
          { href: "/zh/how-it-works", label: "了解流程", className: "border border-border font-medium hover:bg-muted" },
        ]}
        tagline={h.hero.tagline}
        scrollLabel={h.hero.scrollLabel}
      />
      {/* WeChat is a client island, so it sits right under the hero CTAs. */}
      <div className="border-b border-border/60 bg-card/30">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 py-4 text-sm">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">首选渠道</span>
          <WeChatCta placement="hero" />
          <span className="text-xs text-muted-foreground">微信号 {ZH_COMPANY.wechatId} · 首次咨询免费</span>
        </div>
      </div>

      {/* Verifiable figures (existing site data; see docs/china-market/16) */}
      <StatBand
        eyebrow="Track Record · 数据实绩"
        stats={[
          { value: new Date().getFullYear() - ZH_COMPANY.since, suffix: "+", label: "年经验（自 2016）" },
          { value: ZH_COMPANY.closedCases, suffix: "+", label: "已结案件" },
          { value: Number(ZH_COMPANY.reviews.rating), decimals: 1, label: `平均评分 · ${ZH_COMPANY.reviews.source}` },
          { value: ZH_COMPANY.provinces, label: "覆盖府数" },
        ]}
      />

      {/* 2 · Trust indicators */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow="Credentials · 为什么可以信任" title="为远程客户设计的泰国本地团队" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {h.trust.map((t, i) => {
            const Icon = TRUST_ICONS[i] ?? ShieldCheck;
            return (
              <div key={t.title} className="dp-reveal relative rounded-xl border border-border bg-card p-5">
                <CornerTicks />
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-serif text-base font-bold">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 · Services */}
      <section id="services" className="border-y border-border/60 bg-card/30 scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Active Cases · 服务" title="我们的服务" sub="个人客户与企业客户。每项服务都只使用合法手段，并以中文书面报告交付。" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {h.services.map((s, i) => {
              const Icon = SERVICE_ICONS[s.icon];
              return (
                <Link key={s.slug} href={`/zh/${s.slug}`} className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/50">
                  <CornerTicks />
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors group-hover:border-primary/60">
                      <Icon className="h-5 w-5" />
                    </span>
                    <FileTag>{`CASE ${String(i + 1).padStart(2, "0")}`}</FileTag>
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-bold group-hover:text-primary">{s.label}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary/80">
                    了解详情 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            不确定属于哪一类？<Link href="/zh/private-investigator-thailand" className="text-primary underline-offset-2 hover:underline">查看服务总览</Link>
          </p>
        </div>
      </section>

      {/* 4 · How it works */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow="Protocol · 工作流程" title="六步流程，从咨询到报告" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {h.process.map((p, i) => (
            <li key={p.step} className="dp-reveal relative rounded-xl border border-border bg-card p-4">
              <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-1 font-serif text-base font-bold">{p.step}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 text-center">
          <Link href="/zh/how-it-works" className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-primary hover:underline">查看完整流程与收费 <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>

      {/* 5 · Coverage */}
      <section id="coverage" className="border-y border-border/60 bg-card/30 scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Coverage · 服务地区" title="泰国全国覆盖" sub="核心团队常驻曼谷，可在以下地区及其他府执行任务。" />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {ZH_NAV.locations.map((l) => (
              <Link key={l.slug} href={`/zh/${l.slug}`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary">
                <MapPin className="h-4 w-4 text-primary" /> {l.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · Case examples + 7 · Deliverables */}
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-16 md:grid-cols-2">
        <div className="relative rounded-xl border border-border bg-card p-6">
          <CornerTicks />
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold">案例示例</h2>
            <FileTag>Exhibits</FileTag>
          </div>
          {ZH_CASE_STUDIES.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm">
              {ZH_CASE_STUDIES.slice(0, 3).map((c) => (
                <li key={c.id}><Link href="/zh/case-studies" className="hover:text-primary">{c.title}</Link> <span className="text-muted-foreground">· {c.location} · {c.timeline}</span></li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">匿名案例整理中。在此之前，您可以在咨询时索取已脱敏的示例报告，了解报告的结构与证据形式。</p>
          )}
          <Link href="/zh/case-studies" className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:underline">案例页面 <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="relative rounded-xl border border-border bg-card p-6">
          <CornerTicks />
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold">您将收到什么</h2>
            <FileTag>Deliverables</FileTag>
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {h.deliverables.map((d) => (
              <li key={d} className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{d}</span></li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8 · Why Detective Pulse */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <SectionHeading eyebrow="Why us · 为什么选择我们" title="为什么选择 Detective Pulse" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {h.why.map((w) => (
              <div key={w.title} className="dp-reveal flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-serif text-base font-bold">{w.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews (existing figures) */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <SectionHeading eyebrow={`Exhibits · ${ZH_COMPANY.reviews.source} 认证`} title="客户评价" sub="感谢所有客户的信任 · 滑动查看 →" />
        <div className="mx-auto mt-8 flex w-fit items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 px-6 py-4">
          <span className="font-serif text-4xl font-bold text-primary">{ZH_COMPANY.reviews.rating}</span>
          <div className="flex flex-col">
            <span className="flex gap-0.5 text-primary">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}</span>
            <span className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{ZH_COMPANY.reviews.count} 条评价 · {ZH_COMPANY.reviews.source}</span>
          </div>
        </div>
        <div className="mt-8 flex items-stretch gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
          {TESTIMONIALS.map((r, i) => (
            <figure key={i} className="relative flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-card p-6">
              <CornerTicks />
              <div className="flex items-center justify-between">
                <span className="flex gap-0.5 text-primary">{Array.from({ length: r.stars }).map((_, s) => <Star key={s} className="h-3.5 w-3.5 fill-primary text-primary" />)}</span>
                <FileTag>{`EXHIBIT ${String.fromCharCode(65 + i)}`}</FileTag>
              </div>
              <blockquote className="mt-4 font-serif text-base leading-relaxed text-foreground/95">“{r.text}”</blockquote>
              <figcaption className="mt-auto flex items-center gap-2 pt-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"><span className="h-px w-4 bg-primary/50" /> {r.name} · {r.date}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 9 · Confidentiality */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <Stamp className="mb-5">Confidential</Stamp>
          <h2 className="font-serif text-2xl font-bold">保密承诺</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{h.confidentiality}</p>
          <Link href="/zh/about" className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-primary hover:underline">关于我们与隐私政策 <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </section>

      {/* Articles */}
      {articles.length > 0 && (
        <section id="articles" className="border-b border-border/60">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <SectionHeading eyebrow="Field Notes · 文章" title="文章与指南" sub="滑动查看 →" />
            <div className="mt-8 flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin] snap-x">
              {articles.map((a, i) => (
                <Link key={a.id} href={`/zh/articles/${a.zh_slug}`} className="group w-60 shrink-0 snap-start overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50">
                  <ArticleCover slug={a.zh_slug ?? a.en_slug} title={a.zh_title ?? a.en_title} index={i} lang="en" />
                  <div className="p-3.5"><h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{a.zh_title}</h3></div>
                </Link>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link href="/zh/articles" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-5 py-2.5 font-mono text-xs uppercase tracking-wider text-primary hover:bg-primary/10">查看全部文章 <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          </div>
        </section>
      )}

      {/* 10 · FAQ */}
      <Faq items={FAQ_ZH_HOME} eyebrow="Briefing · 常见问题" title="常见问题" />

      {/* 11 · Contact */}
      <section id="contact" className="relative overflow-hidden border-t border-border/60 bg-card/30">
        <Crosshair aria-hidden className="pointer-events-none absolute -left-8 bottom-0 h-64 w-64 text-primary/[0.04]" />
        <Fingerprint aria-hidden className="pointer-events-none absolute -right-10 top-10 h-72 w-72 text-primary/[0.03]" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center">
          <Stamp className="mb-6">Confidential</Stamp>
          <SectionHeading eyebrow="立案 · 联系我们" title="免费咨询，24 小时内回复" sub="描述您的情况，我们如实告诉您能做什么、需要多久、大约费用。" />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <WeChatCta placement="contact" />
          </div>
          <div className="mt-4"><ZhContactLinks /></div>
        </div>
      </section>
    </>
  );
}
