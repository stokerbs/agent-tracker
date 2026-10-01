/**
 * hreflang set for a Chinese page. Google targets Simplified Chinese with
 * `zh-CN` (bare `zh` is accepted but less precise); `x-default` points at the
 * English page when one exists (international fallback), else the Chinese page.
 * Paths are site-relative — Next resolves them against metadataBase.
 */
export function zhAlternates(opts: { zh: string; en?: string; th?: string }) {
  const languages: Record<string, string> = { "zh-CN": opts.zh };
  if (opts.th !== undefined) languages.th = opts.th;
  if (opts.en !== undefined) languages.en = opts.en;
  languages["x-default"] = opts.en ?? opts.zh;
  return { canonical: opts.zh, languages };
}

/** /en/<slug> for a registry page with an English counterpart. */
export const enPathFor = (en?: string) => (en ? `/en/${en}` : undefined);
/** /<thai-slug>/ for a registry page with a Thai counterpart. */
export const thPathFor = (th?: string) => (th ? `/${th}/` : undefined);
