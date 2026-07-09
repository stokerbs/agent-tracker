/**
 * Cloud-storage and CDN attribution.
 *
 * Given the final image URL and its response headers, infer which cloud storage
 * provider hosts the object and which CDN fronts it. Detection is heuristic and
 * evidence-tagged (hostname pattern or response header) so an analyst can see
 * *why* a match was made — we never assert without a reason.
 */

import type { Attribution, CloudMatch, CdnMatch } from "./types";

interface HostRule {
  provider: string;
  test: RegExp;
}

// Cloud object storage — matched on hostname.
const CLOUD_RULES: HostRule[] = [
  { provider: "Amazon S3", test: /(^|\.)s3[.-][a-z0-9-]*\.amazonaws\.com$/i },
  { provider: "Amazon S3", test: /(^|\.)s3\.amazonaws\.com$/i },
  { provider: "Amazon S3", test: /\.s3\.[a-z0-9-]+\.amazonaws\.com$/i },
  { provider: "Cloudflare R2", test: /\.r2\.cloudflarestorage\.com$/i },
  { provider: "Cloudflare R2", test: /\.r2\.dev$/i },
  { provider: "Google Cloud Storage", test: /(^|\.)storage\.googleapis\.com$/i },
  { provider: "Google Cloud Storage", test: /(^|\.)storage\.cloud\.google\.com$/i },
  { provider: "Azure Blob Storage", test: /\.blob\.core\.windows\.net$/i },
  { provider: "Backblaze B2", test: /\.backblazeb2\.com$/i },
  { provider: "Backblaze B2", test: /(^|\.)f[0-9]+\.backblazeb2\.com$/i },
  { provider: "DigitalOcean Spaces", test: /\.digitaloceanspaces\.com$/i },
  { provider: "GitHub", test: /(^|\.)(raw\.githubusercontent\.com|github\.io)$/i },
  { provider: "Imgur", test: /(^|\.)i\.imgur\.com$/i },
  { provider: "WordPress", test: /(^|\.)(wp\.com|files\.wordpress\.com|i[0-9]\.wp\.com)$/i },
  { provider: "Cloudinary", test: /(^|\.)res\.cloudinary\.com$/i },
  { provider: "Firebase Storage", test: /(^|\.)firebasestorage\.googleapis\.com$/i },
  { provider: "Supabase Storage", test: /\.supabase\.(co|in)$/i },
];

// CDN — matched on hostname.
const CDN_HOST_RULES: HostRule[] = [
  { provider: "Cloudflare", test: /(^|\.)cloudflare\.(net|com)$/i },
  { provider: "Fastly", test: /(^|\.)(fastly\.net|fastlylb\.net)$/i },
  { provider: "Akamai", test: /(^|\.)(akamai\.net|akamaiedge\.net|akamaihd\.net|edgekey\.net|edgesuite\.net)$/i },
  { provider: "Amazon CloudFront", test: /(^|\.)cloudfront\.net$/i },
  { provider: "BunnyCDN", test: /(^|\.)(b-cdn\.net|bunnycdn\.com)$/i },
  { provider: "jsDelivr", test: /(^|\.)jsdelivr\.net$/i },
  { provider: "Netlify", test: /(^|\.)netlify\.app$/i },
  { provider: "Vercel", test: /(^|\.)(vercel\.app|vercel-storage\.com)$/i },
];

// CDN — matched on response headers (present even behind a custom hostname).
interface HeaderRule {
  provider: string;
  header: string;
  test?: RegExp;
}
const CDN_HEADER_RULES: HeaderRule[] = [
  { provider: "Cloudflare", header: "cf-ray" },
  { provider: "Cloudflare", header: "server", test: /cloudflare/i },
  { provider: "Fastly", header: "x-served-by", test: /cache-.*-.*/i },
  { provider: "Fastly", header: "x-fastly-request-id" },
  { provider: "Fastly", header: "via", test: /varnish/i },
  { provider: "Akamai", header: "x-akamai-transformed" },
  { provider: "Akamai", header: "x-akamai-request-id" },
  { provider: "Amazon CloudFront", header: "via", test: /cloudfront/i },
  { provider: "Amazon CloudFront", header: "x-amz-cf-id" },
  { provider: "BunnyCDN", header: "server", test: /bunnycdn/i },
  { provider: "Netlify", header: "server", test: /netlify/i },
  { provider: "Vercel", header: "server", test: /vercel/i },
  { provider: "Vercel", header: "x-vercel-id" },
];

/** Detect cloud storage from a hostname. */
export function detectCloud(host: string): CloudMatch[] {
  const out: CloudMatch[] = [];
  for (const rule of CLOUD_RULES) {
    if (rule.test.test(host)) out.push({ provider: rule.provider, evidence: `host matches ${rule.test.source}` });
  }
  return dedupe(out);
}

/** Detect CDN from hostname + response headers. */
export function detectCdn(host: string, headers: Headers): CdnMatch[] {
  const out: CdnMatch[] = [];
  for (const rule of CDN_HOST_RULES) {
    if (rule.test.test(host)) out.push({ provider: rule.provider, evidence: `host matches ${rule.test.source}` });
  }
  for (const rule of CDN_HEADER_RULES) {
    const val = headers.get(rule.header);
    if (val == null) continue;
    if (!rule.test || rule.test.test(val)) {
      out.push({ provider: rule.provider, evidence: `header ${rule.header}: ${val.slice(0, 80)}` });
    }
  }
  return dedupe(out);
}

function dedupe<T extends { provider: string }>(matches: T[]): T[] {
  const seen = new Set<string>();
  return matches.filter((m) => (seen.has(m.provider) ? false : (seen.add(m.provider), true)));
}

/** Full attribution for a final image URL + its response headers. */
export function attribute(finalUrl: string, headers: Headers): Attribution {
  let host: string | null = null;
  try {
    host = new URL(finalUrl).hostname;
  } catch {
    host = null;
  }
  if (!host) return { host: null, cloud: [], cdn: [] };
  return { host, cloud: detectCloud(host), cdn: detectCdn(host, headers) };
}
