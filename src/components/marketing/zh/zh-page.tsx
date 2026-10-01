import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle, Crosshair, Fingerprint } from "lucide-react";
import { SectionHeading, FileTag, Stamp, CornerTicks, Eyebrow } from "@/components/marketing/ui";
import { Faq } from "@/components/marketing/faq";
import { Breadcrumb } from "@/components/marketing/breadcrumb";
import { WeChatCta } from "@/components/marketing/zh/wechat-cta";
import { ZhContactLinks } from "@/components/marketing/zh/contact-links";
import { ZhPageView } from "@/components/marketing/zh/zh-page-view";
import { ZhIntakeForm } from "@/components/marketing/zh/zh-intake-form";
import { ZhPartnerForm } from "@/components/marketing/zh/zh-partner-form";
import { PrintButton } from "@/components/marketing/zh/zh-company-profile";
import { ZH_COMPANY } from "@/lib/marketing/zh/company";
import { ZH_HOME } from "@/lib/marketing/zh/home";
import { ZH_NAV } from "@/lib/marketing/zh/nav";
import { ZhCaseStudies } from "@/components/marketing/zh/zh-case-studies";
import { ZhServiceJsonLd } from "@/components/marketing/zh/zh-json-ld";
import { RelatedArticles, type RelatedItem } from "@/components/marketing/related-articles";
import { zhPageLabel, type ZhPage } from "@/lib/marketing/zh/registry";

const BASE = "https://detectivepulse.com";

/**
 * Renders any registry page (/zh/<slug>) in the dossier style: breadcrumb →
 * hero → sections → deliverables / boundaries → FAQ → related → CTA band.
 * Server component; the only client islands are the WeChat dialog, the
 * page-view tracker and (on /zh/contact) the intake form.
 */
export function ZhMarketingPage({ page, articles = [] }: { page: ZhPage; articles?: RelatedItem[] }) {
  const path = `/zh/${page.slug}`;
  const isContact = page.slug === "contact";
  const isCases = page.slug === "case-studies";
  const isPartners = page.slug === "partners";
  const isProfile = page.slug === "company-profile";
  const ctaService = page.service;

  return (
    <>
      <ZhPageView page={path} service={page.service} kind={page.kind} />
      <ZhServiceJsonLd page={page} url={`${BASE}${path}`} />

      {/* Hero */}
      <section className="dp-hero dp-scanline relative border-b border-border/60">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-10">
          <Breadcrumb items={[{ name: "首页", href: "/zh" }, { name: page.kind === "location" ? "服务地区" : page.kind === "service" ? "服务" : "了解我们", href: page.kind === "location" ? "/zh#coverage" : page.kind === "service" ? "/zh#services" : "/zh/about" }, { name: page.h1 }]} />
          <div className="mt-8 max-w-3xl">
            <Eyebrow className="!justify-start">{page.eyebrow}</Eyebrow>
            <h1 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{page.h1}</h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{page.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {page.primaryCta === "wechat" ? (
                <>
                  <WeChatCta placement="hero" service={ctaService} />
                  <Link href="/zh/contact#intake" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-medium hover:bg-muted">
                    提交案件资料 <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <>
                  {isProfile ? (
                    <PrintButton />
                  ) : (
                    <Link href={isContact || isPartners ? "#intake" : "/zh/contact#intake"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90">
                      {isPartners ? "提交合作申请" : "提交案件资料"} <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                  <WeChatCta placement="hero" service={ctaService} variant="secondary" />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Body sections */}
      {page.sections.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-14">
          {page.sections.map((s, i) => (
            <div key={s.heading} className={i > 0 ? "mt-12" : ""}>
              <h2 className="font-serif text-2xl font-bold tracking-tight">{s.heading}</h2>
              {s.body.map((p, j) => (
                <p key={j} className="mt-4 leading-relaxed text-foreground/90">{p}</p>
              ))}
              {s.bullets && s.bullets.length > 0 && (
                <ul className="mt-4 space-y-2 text-foreground/90">
                  {s.bullets.map((b) => (
                    <li key={b} className="relative pl-6 before:absolute before:left-0 before:text-primary before:content-['▸']">{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Deliverables + boundaries */}
      {(page.deliverables || page.notOffered) && (
        <section className="border-y border-border/60 bg-card/30">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-14 md:grid-cols-2">
            {page.deliverables && (
              <div className="relative rounded-xl border border-border bg-card p-6">
                <CornerTicks />
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl font-bold">您将收到</h2>
                  <FileTag>Deliverables</FileTag>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {page.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{d}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {page.notOffered && (
              <div className="relative rounded-xl border border-border bg-card p-6">
                <CornerTicks />
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-xl font-bold">我们不做什么</h2>
                  <FileTag>Scope</FileTag>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  {page.notOffered.map((d) => (
                    <li key={d} className="flex items-start gap-2.5"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive/80" /><span>{d}</span></li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">我们只使用合法手段，并遵守泰国《个人数据保护法》(PDPA)。</p>
              </div>
            )}
          </div>
        </section>
      )}

      {isCases && <ZhCaseStudies />}

      {/* Partners: application form */}
      {isPartners && (
        <section id="intake" className="border-t border-border/60 bg-card/30 scroll-mt-24">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <SectionHeading eyebrow="Partner · 合作申请" title="提交合作申请" sub="2 个工作日内安排通话。企业信息仅用于评估合作，不会向第三方披露。" />
            <div className="mt-10"><ZhPartnerForm /></div>
          </div>
        </section>
      )}

      {/* Printable company profile (facts from zh/company.ts + home.ts only) */}
      {isProfile && (
        <section className="mx-auto max-w-3xl px-4 py-12 print:py-0">
          <style>{`@media print { header, footer, nav, [data-print-hide], .dp-hero { display: none !important; } body { background: #fff !important; color: #000 !important; } }`}</style>
          <div className="space-y-10">
            <div>
              <h2 className="font-serif text-2xl font-bold">关于我们</h2>
              <p className="mt-3 leading-relaxed">Detective Pulse 是一家在泰国运营的专业调查公司，自 {ZH_COMPANY.since} 年起为泰国本地与海外客户提供调查与核实服务。核心团队常驻曼谷，可在全泰国范围执行任务；中文客户服务团队负责沟通、进度与报告。</p>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">服务范围</h2>
              <ul className="mt-3 space-y-2">
                {ZH_HOME.services.map((s) => <li key={s.slug} className="relative pl-6 before:absolute before:left-0 before:text-primary before:content-['▸']"><span className="font-medium">{s.label}</span> — {s.blurb}</li>)}
              </ul>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">工作流程</h2>
              <ol className="mt-3 space-y-1.5">
                {ZH_HOME.process.map((p, i) => <li key={p.step}><span className="font-mono text-primary">{String(i + 1).padStart(2, "0")}</span> <span className="font-medium">{p.step}</span> — {p.desc}</li>)}
              </ol>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">您将收到</h2>
              <ul className="mt-3 space-y-1.5">{ZH_HOME.deliverables.map((d) => <li key={d} className="relative pl-6 before:absolute before:left-0 before:text-primary before:content-['▸']">{d}</li>)}</ul>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">覆盖地区</h2>
              <p className="mt-3">{ZH_NAV.locations.map((l) => l.label).join(" · ")} 及泰国其他府</p>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">原则与保密</h2>
              <ul className="mt-3 space-y-1.5">{ZH_HOME.why.map((w) => <li key={w.title} className="relative pl-6 before:absolute before:left-0 before:text-primary before:content-['▸']"><span className="font-medium">{w.title}</span> — {w.desc}</li>)}</ul>
              <p className="mt-3 text-sm text-muted-foreground">{ZH_HOME.confidentiality}</p>
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold">联系方式</h2>
              <p className="mt-3">微信：{ZH_COMPANY.wechatId} · WhatsApp：{ZH_COMPANY.whatsapp} · 邮箱：{ZH_COMPANY.email}</p>
              <p className="mt-1">网站：https://detectivepulse.com/zh · 合作伙伴：https://detectivepulse.com/zh/partners</p>
            </div>
            <div data-print-hide><PrintButton /></div>
          </div>
        </section>
      )}

      {/* Contact: intake form */}
      {isContact && (
        <section id="intake" className="border-t border-border/60 bg-card/30 scroll-mt-24">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <SectionHeading eyebrow="Intake · 案件资料" title="提交案件资料" sub="填写后立即获得案件编号。我们评估后在 24 小时内通过微信或邮箱联系您，给出可行性说明与报价。" />
            <div className="mt-10">
              <ZhIntakeForm />
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {page.faq.length > 0 && (
        <div className="border-t border-border/60">
          <Faq items={page.faq} eyebrow="Briefing · 常见问题" title="常见问题" />
        </div>
      )}

      {/* Related articles (published Chinese articles tagged with this service) */}
      <RelatedArticles heading="相关文章" items={articles} lang="en" />

      {/* Related */}
      {page.related.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-14">
          <div className="dp-hairline mb-6" />
          <h2 className="font-serif text-xl font-bold">相关服务与信息</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {page.related.map((slug) => (
              <Link key={slug} href={`/zh/${slug}`} className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary">
                {zhPageLabel(slug)} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA band */}
      {!isContact && !isProfile && (
        <section className="relative overflow-hidden border-t border-border/60 bg-card/30">
          <Crosshair aria-hidden className="pointer-events-none absolute -left-8 bottom-0 h-64 w-64 text-primary/[0.04]" />
          <Fingerprint aria-hidden className="pointer-events-none absolute -right-10 top-10 h-72 w-72 text-primary/[0.03]" />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center">
            <Stamp className="mb-6">Confidential</Stamp>
            <SectionHeading eyebrow="立案 · 联系我们" title="免费咨询，24 小时内回复" sub="描述您的情况，我们如实告诉您能做什么、需要多久、大约费用。" />
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <WeChatCta placement="service" service={ctaService} />
            </div>
            <div className="mt-4">
              <ZhContactLinks />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
