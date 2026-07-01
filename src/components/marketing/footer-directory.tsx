import Link from "next/link";
import { getMarketingPages } from "@/lib/marketing/content";

/**
 * Full directory of every migrated marketing page, rendered in the footer. Gives
 * all 27 service/article pages a crawlable, descriptive internal link from every
 * page on the site (they were previously reachable only from the homepage), which
 * both helps discovery for visitors and spreads link equity for SEO.
 *
 * Server component: reads the (server-only) content index at render time. Renders
 * nothing when there are no pages (empty state).
 */
export function FooterDirectory() {
  const pages = getMarketingPages();
  if (pages.length === 0) return null;

  const sorted = [...pages].sort((a, b) => a.title.localeCompare(b.title, "th"));

  return (
    <nav aria-label="สารบัญบริการและบทความ" className="mb-6">
      <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-primary/55">
        {"// Case Index — บริการ & บทความทั้งหมด"}
      </p>
      <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((p) => (
          <li key={p.slug}>
            <Link
              href={p.path.replace(/\/+$/, "") || "/"}
              className="block truncate text-xs leading-relaxed text-muted-foreground transition-colors hover:text-primary"
              title={p.title}
            >
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
