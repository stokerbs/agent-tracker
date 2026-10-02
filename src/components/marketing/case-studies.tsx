import { FileTag, CornerTicks } from "@/components/marketing/ui";
import { caseStudiesFor, type CaseLang } from "@/lib/marketing/case-studies";

const COPY: Record<CaseLang, {
  comingTag: string; comingTitle: string; comingBody: string; labels: [string, string, string, string, string, string, string]; note: string;
}> = {
  th: {
    comingTag: "Coming soon",
    comingTitle: "กำลังรวบรวมกรณีศึกษา",
    comingBody: "เรากำลังปกปิดข้อมูลระบุตัวตนในเคสจริงและขอความยินยอมจากลูกค้าก่อนเผยแพร่ ระหว่างนี้ขอตัวอย่างรายงานที่ปกปิดข้อมูลแล้วได้ในขั้นปรึกษา",
    labels: ["สถานการณ์ของลูกค้า", "เป้าหมาย", "ความท้าทาย", "แนวทาง (ภาพรวม)", "สิ่งที่ส่งมอบ", "ผลลัพธ์", "บทเรียน"],
    note: "หมายเหตุด้านความลับ: กรณีศึกษานี้ปกปิดข้อมูลแล้ว ไม่มีชื่อ ที่อยู่ ยานพาหนะ เบอร์โทร หรือข้อมูลที่ระบุตัวลูกค้า เป้าหมาย หรือนักสืบ และเผยแพร่โดยได้รับความยินยอมจากลูกค้า",
  },
  en: {
    comingTag: "Coming soon",
    comingTitle: "Case studies are being prepared",
    comingBody: "We are anonymising real cases and obtaining each client's consent before publishing. In the meantime, ask for a redacted sample report during the consultation.",
    labels: ["Client situation", "Objective", "Challenges", "Approach (high level)", "Deliverables", "Outcome", "Lessons"],
    note: "Confidentiality note: this case study is anonymised. It contains no names, addresses, vehicles, phone numbers or anything identifying the client, the subject or the investigators, and is published with the client's consent.",
  },
  zh: {
    comingTag: "Coming soon",
    comingTitle: "案例整理中",
    comingBody: "我们正在对真实案例进行匿名化处理并取得客户同意。在此之前，您可以在咨询时索取已脱敏的示例报告。",
    labels: ["客户情况", "目标", "难点", "调查方法（概述）", "交付内容", "结果", "经验"],
    note: "保密说明：本案例已匿名化处理，不包含客户、目标人、地址、车辆、电话或调查员的任何可识别信息，并经客户同意发布。",
  },
};

/**
 * Anonymised case-study list for one language. Honest empty state until the
 * owner supplies real cases; the page stays `noindex` until ≥ 3 exist (see
 * lib/marketing/case-studies.ts and the TH/EN/ZH route metadata).
 */
export function CaseStudies({ lang }: { lang: CaseLang }) {
  const t = COPY[lang];
  const cases = caseStudiesFor(lang);
  if (cases.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <div className="relative rounded-xl border border-dashed border-border bg-card/40 p-10">
          <CornerTicks />
          <FileTag>{t.comingTag}</FileTag>
          <h2 className="mt-4 font-serif text-xl font-bold">{t.comingTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.comingBody}</p>
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-3xl px-4 py-14">
      <div className="space-y-8">
        {cases.map((c, i) => (
          <article key={c.id} className="relative rounded-xl border border-border bg-card p-6">
            <CornerTicks />
            <div className="flex items-center justify-between">
              <FileTag>{`CASE ${String(i + 1).padStart(2, "0")} · ${c.service}`}</FileTag>
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{c.location} · {c.timeline}</span>
            </div>
            <h2 className="mt-3 font-serif text-xl font-bold">{c.title}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {([c.situation, c.objective, c.challenges, c.approach, c.deliverables, c.outcome, c.lessons] as const).map((v, j) => (
                <div key={t.labels[j]}>
                  <dt className="font-mono text-[11px] uppercase tracking-wider text-primary/80">{t.labels[j]}</dt>
                  <dd className="mt-1 leading-relaxed text-foreground/90">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-xs text-muted-foreground">{t.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
