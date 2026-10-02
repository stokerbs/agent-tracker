/**
 * First-touch marketing attribution for the TH / EN marketing site.
 *
 * Captured once per visitor (localStorage, 30-day TTL) on the first marketing
 * page view and attached to every lead write (`/api/marketing/lead`,
 * `/api/marketing/assistant`) so `marketing_leads` can answer "which page,
 * campaign and keyword produced this case" (docs/seo-growth-audit §12.8).
 *
 * Privacy: only the landing path, an external referrer, utm_* values and the
 * ad click ids are stored — never personal data. Every field is bounded here
 * AND re-validated server-side (the API is the authority).
 * `parseAttribution` is pure and unit-tested; the storage wrappers never throw.
 */
export interface Attribution {
  landing_page: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  gclid: string;
  fbclid: string;
  /** ISO timestamp of the first marketing page view. */
  first_seen: string;
}

export const ATTRIBUTION_STORAGE_KEY = "dp_attr";
export const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const ATTRIBUTION_LIMITS = {
  landing_page: 300,
  referrer: 300,
  utm_source: 100,
  utm_medium: 100,
  utm_campaign: 150,
  utm_term: 150,
  utm_content: 150,
  gclid: 200,
  fbclid: 200,
} as const;

const clip = (v: string | null | undefined, max: number) => (v ?? "").trim().slice(0, max);

/** Pure: build the attribution record from the current URL + document referrer. */
export function parseAttribution(url: URL, referrer: string, now: Date = new Date()): Attribution {
  const q = url.searchParams;
  // Internal navigation is not a referrer; only keep an external origin.
  let ref = "";
  try {
    if (referrer) {
      const r = new URL(referrer);
      if (r.host.replace(/^www\./, "") !== url.host.replace(/^www\./, "")) ref = `${r.origin}${r.pathname}`;
    }
  } catch {
    ref = "";
  }
  return {
    landing_page: clip(url.pathname, ATTRIBUTION_LIMITS.landing_page),
    referrer: clip(ref, ATTRIBUTION_LIMITS.referrer),
    utm_source: clip(q.get("utm_source"), ATTRIBUTION_LIMITS.utm_source),
    utm_medium: clip(q.get("utm_medium"), ATTRIBUTION_LIMITS.utm_medium),
    utm_campaign: clip(q.get("utm_campaign"), ATTRIBUTION_LIMITS.utm_campaign),
    utm_term: clip(q.get("utm_term"), ATTRIBUTION_LIMITS.utm_term),
    utm_content: clip(q.get("utm_content"), ATTRIBUTION_LIMITS.utm_content),
    gclid: clip(q.get("gclid"), ATTRIBUTION_LIMITS.gclid),
    fbclid: clip(q.get("fbclid"), ATTRIBUTION_LIMITS.fbclid),
    first_seen: now.toISOString(),
  };
}

/** A paid click id or utm_source on a later page view is a stronger signal than
 *  a plain first-touch; `shouldReplace` lets a tagged visit overwrite an untagged one. */
export function shouldReplace(existing: Attribution | null, incoming: Attribution): boolean {
  if (!existing) return true;
  const tagged = (a: Attribution) => Boolean(a.utm_source || a.gclid || a.fbclid);
  return !tagged(existing) && tagged(incoming);
}

function readStored(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Attribution> | null;
    if (!parsed || typeof parsed !== "object" || typeof parsed.first_seen !== "string") return null;
    if (Date.now() - new Date(parsed.first_seen).getTime() > ATTRIBUTION_TTL_MS) return null;
    return parsed as Attribution;
  } catch {
    return null;
  }
}

/** Capture first-touch attribution for this visitor (idempotent; safe to call on every page view). */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = readStored();
    const incoming = parseAttribution(new URL(window.location.href), document.referrer);
    if (!shouldReplace(existing, incoming)) return existing;
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(incoming));
    return incoming;
  } catch {
    return null;
  }
}

/** The stored attribution (or a fresh capture when none exists). Never throws. */
export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  return readStored() ?? captureAttribution();
}
