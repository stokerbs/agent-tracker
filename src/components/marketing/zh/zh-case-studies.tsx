import { FileTag, CornerTicks } from "@/components/marketing/ui";
import { ZH_CASE_STUDIES } from "@/lib/marketing/zh/case-studies";

/**
 * Anonymised case studies (docs/china-market/13 template). Renders the honest
 * empty state until Detective Pulse supplies real, anonymised cases — the page
 * is `noindex` while the list is empty (see zh/[slug]/page.tsx).
 */
export function ZhCaseStudies() {
  if (ZH_CASE_STUDIES.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <div className="relative rounded-xl border border-dashed border-border bg-card/40 p-10">
          <CornerTicks />
          <FileTag>Coming soon</FileTag>
          <h2 className="mt-4 font-serif text-xl font-bold">案例整理中</h2>
          <p className="mt-2 text-sm text-muted-foreground">我们正在对真实案例进行匿名化处理。在此之前，您可以在咨询时索取已脱敏的示例报告。</p>
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <div className="space-y-8">
        {ZH_CASE_STUDIES.map((c, i) => (
          <article key={c.id} className="relative rounded-xl border border-border bg-card p-6">
            <CornerTicks />
            <div className="flex items-center justify-between">
              <FileTag>{`CASE ${String(i + 1).padStart(2, "0")} · ${c.service}`}</FileTag>
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{c.location} · {c.timeline}</span>
            </div>
            <h2 className="mt-3 font-serif text-xl font-bold">{c.title}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {([
                ["客户情况", c.situation],
                ["目标", c.objective],
                ["难点", c.challenges],
                ["调查方法（概述）", c.approach],
                ["交付内容", c.deliverables],
                ["结果", c.outcome],
                ["经验", c.lessons],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[11px] uppercase tracking-wider text-primary/80">{k}</dt>
                  <dd className="mt-1 leading-relaxed text-foreground/90">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs text-muted-foreground">保密说明：本案例已匿名化处理，不包含客户、目标人、地址、车辆、电话或调查员的任何可识别信息。</p>
          </article>
        ))}
      </div>
    </section>
  );
}
