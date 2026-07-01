import Link from "next/link";
import { ChevronRight } from "lucide-react";

const BASE = "https://detectivepulse.com";

/**
 * Article breadcrumb — visible trail (dossier styling) + BreadcrumbList JSON-LD
 * for Google. Items are first-party (static hrefs + the page title); the last
 * item is the current page (no link). JSON-LD uses the standard escaped-`<`
 * pattern.
 */
export function Breadcrumb({ items }: { items: { name: string; href?: string }[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.href ? { item: `${BASE}${it.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-primary/50" />}
          {it.href ? (
            <Link href={it.href} className="font-mono uppercase tracking-wider text-muted-foreground hover:text-primary">
              {it.name}
            </Link>
          ) : (
            <span className="line-clamp-1 text-foreground/80">{it.name}</span>
          )}
        </span>
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </nav>
  );
}
