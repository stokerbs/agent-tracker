import { Mail } from "lucide-react";
import { SectionHeading } from "@/components/marketing/ui";
import { TrackedLink } from "@/components/marketing/tracked-link";
import { CONTACT } from "@/lib/marketing/contact";
import { PRIVACY_UPDATED, type PrivacyNotice as Notice } from "@/lib/marketing/privacy-notice";

/**
 * Renders the marketing privacy notice for one language. Server component —
 * content comes from lib/marketing/privacy-notice.ts.
 */
export function PrivacyNotice({ notice }: { notice: Notice }) {
  const eyebrow = { th: "Legal · ความเป็นส่วนตัว", en: "Legal · Privacy", zh: "Legal · 隐私" }[notice.lang];
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <SectionHeading eyebrow={eyebrow} title={notice.h1} sub={notice.intro} />
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {notice.updatedLabel}: <time dateTime={PRIVACY_UPDATED}>{PRIVACY_UPDATED}</time>
      </p>

      <div className="mt-10 space-y-8">
        {notice.sections.map((s) => (
          <section key={s.heading} className="space-y-2">
            <h2 className="font-serif text-lg font-bold text-foreground">{s.heading}</h2>
            {s.body.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-muted-foreground">{p}</p>
            ))}
            {s.bullets && (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                {s.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-serif text-lg font-bold">{notice.contactLabel}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <TrackedLink href={CONTACT.mailto} placement="footer" className="inline-flex items-center gap-2 text-primary hover:underline">
              <Mail className="h-4 w-4" /> {CONTACT.email}
            </TrackedLink>
          </p>
        </section>
      </div>
    </article>
  );
}
