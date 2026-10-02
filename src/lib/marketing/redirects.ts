/**
 * Consolidation 301s from the SEO audit (docs/seo-growth-audit, Appendix C.3):
 * thin / duplicate WordPress-era pages fold into the core TH / EN service,
 * pricing, hub and about pages.
 *
 * GATED: the redirects are only emitted when
 * `MARKETING_CONSOLIDATION_REDIRECTS=1` is set at build time, because the
 * owner must first (a) check Google Search Console for sources that still
 * earn impressions and move any unique sentences into the target page, and
 * (b) confirm the target pages are live and indexed. Until then the sources
 * keep serving (with hreflang / canonical to themselves) and nothing changes.
 *
 * Paths are stored DECODED (as written in the audit) and percent-encoded when
 * handed to Next, which matches `source` against the encoded request path.
 */

export interface ConsolidationRedirect {
  /** Decoded source path, no trailing slash. */
  from: string;
  /** Decoded destination path, no trailing slash ("/" allowed). */
  to: string;
}

export const CONSOLIDATION_REDIRECTS: ConsolidationRedirect[] = [
  // ── Thai ────────────────────────────────────────────────────────────────
  { from: "/นักสืบคดีชู้สาว-รับสืบค", to: "/นักสืบชู้สาว" },
  { from: "/บริการตรวจสอบประวัติบุ", to: "/เช็คประวัติบุคคล" },
  { from: "/บริการสืบประวัติบุคคลด", to: "/สืบทรัพย์สิน" },
  { from: "/จ้างนักสืบตามหาคน", to: "/สืบตามหาคน" },
  { from: "/บริการสืบค้นข้อมูลไอที", to: "/นักสืบไอที" },
  { from: "/บริการตรวจสอบการใช้โทร", to: "/นักสืบไอที" },
  { from: "/จ้างนักสืบ-ราคาถูก", to: "/ราคานักสืบ" },
  { from: "/วิธีการคิดราคาจ้างนักส", to: "/ราคานักสืบ" },
  { from: "/การหานักสืบเชี่ยวชาญ-คำ", to: "/จ้างนักสืบ" },
  { from: "/บริษัทนักสืบมืออาชีพที", to: "/เกี่ยวกับเรา" },
  { from: "/บริการนักสืบชั้นนำเพื่", to: "/เกี่ยวกับเรา" },
  // ── English ─────────────────────────────────────────────────────────────
  { from: "/en/private-investigator", to: "/en" },
  { from: "/en/catch-a-cheating-partner", to: "/en/cheating-spouse-investigator" },
  { from: "/en/personal-background-check-service", to: "/en/background-check" },
  { from: "/en/asset-background-check", to: "/en/asset-investigation" },
  { from: "/en/trace-assets-before-lawsuit", to: "/en/asset-investigation" },
  { from: "/en/trace-people-and-debtors", to: "/en/find-missing-person" },
  { from: "/en/social-media-investigation", to: "/en/cyber-investigation" },
  { from: "/en/phone-usage-investigation", to: "/en/cyber-investigation" },
  { from: "/en/hire-a-detective-online", to: "/en/hire-a-private-detective" },
  { from: "/en/how-to-find-a-good-detective", to: "/en/hire-a-private-detective" },
  { from: "/en/private-detective-pricing", to: "/en/pricing" },
  { from: "/en/affordable-private-detective", to: "/en/pricing" },
  { from: "/en/trusted-detective-agency", to: "/en/about" },
  { from: "/en/leading-detective-services", to: "/en/about" },
  { from: "/en/detective-services-overview", to: "/en/about" },
  // Not included (deliberately): /en/investigate-partner-before-marriage →
  // /en/thai-partner-verification. The partner page was rebuilt in the
  // registry at its existing URL; revisit if a separate verification page ships.
];

export const CONSOLIDATION_FLAG = "MARKETING_CONSOLIDATION_REDIRECTS";

export function consolidationRedirectsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[CONSOLIDATION_FLAG] === "1";
}

const REDIRECTED = new Set(CONSOLIDATION_REDIRECTS.map((r) => r.from));

/** True when `path` (decoded, no trailing slash) is a consolidation source. */
export function isConsolidatedSource(path: string): boolean {
  return REDIRECTED.has(path.replace(/\/+$/, "") || "/");
}

export interface NextRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

/**
 * Redirect rules for `next.config.ts`. Empty unless the flag is on, so the
 * default build is a no-op. Sources are percent-encoded for Next's matcher.
 */
export function consolidationRedirects(env: Record<string, string | undefined> = process.env): NextRedirect[] {
  if (!consolidationRedirectsEnabled(env)) return [];
  return CONSOLIDATION_REDIRECTS.map((r) => ({
    source: encodeURI(r.from),
    destination: encodeURI(r.to),
    permanent: true,
  }));
}
