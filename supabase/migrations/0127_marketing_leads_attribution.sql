-- ============================================================================
-- Migration 0127 — Lead attribution for the Thai / English marketing site
-- ============================================================================
-- docs/seo-growth-audit §12.8. The Chinese intake already stores landing_page,
-- referrer and utm_* (0124). The Thai/English lead form and the AI assistant now
-- write the same first-touch attribution plus the paid click ids, so Google Ads
-- offline conversions (gclid) and Meta (fbclid) can be matched to paid cases.
-- Posture unchanged: rows are written ONLY by service-role route handlers;
-- values are client-supplied, bounded and informational (never used for auth).

alter table public.marketing_leads
  add column if not exists utm_content text,
  add column if not exists gclid       text,
  add column if not exists fbclid      text;

comment on column public.marketing_leads.gclid  is 'Google Ads click id captured on the first marketing page view; join key for offline conversion uploads.';
comment on column public.marketing_leads.fbclid is 'Meta click id captured on the first marketing page view.';
comment on column public.marketing_leads.utm_content is 'utm_content of the first-touch visit (ad / creative variant).';

-- lead_ref now also carries TH-/EN- prefixes (Thai / English site leads); the
-- existing partial unique index from 0124 covers them unchanged.
create index if not exists marketing_leads_gclid_idx on public.marketing_leads (gclid) where gclid is not null;
