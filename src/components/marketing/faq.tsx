import { Plus } from "lucide-react";
import { SectionHeading } from "@/components/marketing/ui";
import type { QA } from "@/lib/marketing/faq";

/**
 * FAQ section for the marketing homepages. Native <details>/<summary> so it
 * expands without client JS (server component, accessible). Dossier styled.
 */
export function Faq({
  items,
  eyebrow,
  title,
}: {
  items: QA[];
  eyebrow: string;
  title: string;
}) {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-10 divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-card/40">
        {items.map((item) => (
          <details key={item.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
              <span>{item.q}</span>
              <Plus className="h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-45" />
            </summary>
            <p className="pb-5 pr-8 leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
