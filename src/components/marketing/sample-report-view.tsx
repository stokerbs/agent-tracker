import Link from "next/link";
import { ArrowLeft, Camera, FileText } from "lucide-react";
import { FileTag, CornerTicks } from "@/components/marketing/ui";
import { SAMPLE_REPORT, type SampleLang } from "@/lib/marketing/sample-report-data";
import { PrintButton } from "@/components/marketing/print-button";

/**
 * Public sample report page (C10). Mirrors the ops app's printed report
 * layout with placeholder content and a visible SAMPLE watermark; print
 * styles produce a clean PDF via the browser.
 */
export function SampleReportView({ lang }: { lang: SampleLang }) {
  const r = SAMPLE_REPORT[lang];
  const back = lang === "en" ? "/en/how-it-works" : "/ขั้นตอนการทำงาน";
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> {r.backLabel}</Link>
        <PrintButton label={r.printLabel} />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-10 print:border-0 print:p-0">
        <CornerTicks />
        {/* Watermark — visible on screen and print so the sample can never pass as a real report */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[20deg] select-none font-mono text-5xl font-bold uppercase tracking-[0.3em] text-primary/10 sm:text-7xl">{r.watermark}</span>
        </div>

        <div className="relative">
          <FileTag>{r.watermark}</FileTag>
          <h1 className="mt-3 font-serif text-2xl font-bold">{r.title}</h1>
          <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed">{r.notice}</p>

          <pre className="mt-6 whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground/90">{r.headerLines.join("\n")}</pre>

          {r.days.map((d) => (
            <section key={d.label} className="mt-6">
              <h2 className="font-mono text-sm font-semibold">{d.label}</h2>
              <ol className="mt-2 space-y-4">
                {d.entries.map((e, i) => (
                  <li key={i} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <p className="text-sm leading-relaxed"><span className="font-mono font-semibold">{e.time}</span> — {e.text}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Array.from({ length: e.photos }).map((_, k) => (
                        <div key={k} className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-border bg-muted/40 text-muted-foreground" title={r.photoCaption}>
                          <Camera className="h-4 w-4" />
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{r.locationLabel}: {e.location}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <p className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">{r.endLine}</p>
          <pre className="mt-6 whitespace-pre-wrap border-t border-border/60 pt-4 font-mono text-[11px] leading-relaxed text-muted-foreground">{r.footerLines.join("\n")}</pre>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-5 print:hidden">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold"><FileText className="h-4 w-4 text-primary" /> {r.legend.title}</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {r.legend.items.map((it) => <li key={it}>{it}</li>)}
        </ul>
      </section>
    </div>
  );
}
