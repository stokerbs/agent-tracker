import { CountUp } from "@/components/marketing/count-up";
import { Eyebrow, CornerTicks } from "@/components/marketing/ui";

export type Stat = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
};

/**
 * Credibility band — a row of case-file stat tiles whose numbers count up when
 * they scroll into view. Shared by the TH and EN homes. Numbers are the firm's
 * verifiable figures (years since 2016, Fastwork review count + rating,
 * provinces covered) — no invented claims.
 */
export function StatBand({ eyebrow, stats }: { eyebrow: string; stats: Stat[] }) {
  return (
    <section className="border-b border-border/60 bg-card/30">
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="dp-reveal text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
        <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {stats.map((s) => (
            <div
              key={s.label}
              className="dp-reveal relative rounded-xl border border-border bg-background/40 p-6 text-center"
            >
              <CornerTicks />
              <div className="font-serif text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                <CountUp to={s.value} decimals={s.decimals} prefix={s.prefix} suffix={s.suffix} />
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase leading-tight tracking-[0.15em] text-muted-foreground sm:text-[11px]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
