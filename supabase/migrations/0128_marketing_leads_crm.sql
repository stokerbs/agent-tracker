-- ============================================================================
-- Migration 0128 — CRM fields for lead quality / lost reason / channel + ad spend
-- ============================================================================
-- docs/seo-growth-audit Part 13 (Days 31–90): "CRM fields (lead_quality,
-- lost_reason, gclid, channel) + /marketing-insights panels for all locales +
-- Ads cost import". gclid already exists (0127). Posture unchanged: lead rows
-- are written by service-role route handlers; admins update quality / lost
-- reason through the RLS admin-update policy (0124). Ad spend is admin-only.

-- ── Lead quality / lost reason / acquisition channel ──────────────────────
alter table public.marketing_leads
  add column if not exists lead_quality text not null default 'unrated',
  add column if not exists lost_reason  text,
  add column if not exists channel      text not null default 'unknown';

alter table public.marketing_leads drop constraint if exists marketing_leads_quality_check;
alter table public.marketing_leads add constraint marketing_leads_quality_check
  check (lead_quality in ('unrated','spam','unqualified','qualified','high_value'));

alter table public.marketing_leads drop constraint if exists marketing_leads_lost_reason_check;
alter table public.marketing_leads add constraint marketing_leads_lost_reason_check
  check (lost_reason is null or lost_reason in (
    'price','out_of_scope','unlawful_request','no_response','chose_competitor','timing','not_feasible','other'
  ));

alter table public.marketing_leads drop constraint if exists marketing_leads_channel_check;
alter table public.marketing_leads add constraint marketing_leads_channel_check
  check (channel in ('paid_search','paid_social','organic_search','social','referral','partner','direct','unknown'));

comment on column public.marketing_leads.lead_quality is 'Admin rating after first contact: unrated | spam | unqualified | qualified | high_value. Drives Ads offline conversions (qualified, high_value).';
comment on column public.marketing_leads.lost_reason  is 'Why a lead did not become a case (admin-set when stage = closed without payment).';
comment on column public.marketing_leads.channel      is 'Acquisition channel derived from first-touch attribution at insert (src/lib/marketing/crm.ts channelFor); backfilled below.';

-- Backfill channel for existing rows from the stored attribution (same rules
-- as channelFor(); keep the two in step).
update public.marketing_leads set channel = case
  when gclid is not null or lower(coalesce(utm_medium,'')) in ('cpc','ppc','paid','paid_search') or lower(coalesce(utm_source,'')) in ('google_ads','googleads','adwords') then 'paid_search'
  when fbclid is not null or lower(coalesce(utm_medium,'')) in ('paid_social','social_paid') then 'paid_social'
  when utm_source like 'partner-%' then 'partner'
  when lower(coalesce(utm_medium,'')) in ('social','sm') or referrer ~* '(facebook|instagram|tiktok|line\.me|lin\.ee|youtube|x\.com|twitter|weixin|wechat)' then 'social'
  when referrer ~* '(google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\.)' or lower(coalesce(utm_medium,'')) in ('organic','seo') then 'organic_search'
  when referrer is not null and referrer !~* 'detectivepulse\.com' then 'referral'
  when landing_page is not null then 'direct'
  else 'unknown' end
where channel = 'unknown';

create index if not exists marketing_leads_channel_idx on public.marketing_leads (channel);
create index if not exists marketing_leads_quality_idx on public.marketing_leads (lead_quality);

-- ── Ad spend (imported from Google Ads / Meta exports) ────────────────────
create table if not exists public.marketing_ad_spend (
  id           uuid primary key default gen_random_uuid(),
  spend_date   date not null,
  platform     text not null,                       -- google_ads | meta | line | other
  campaign     text not null default '',
  locale       text not null default 'all',         -- th | en | zh | all
  cost         numeric(12,2) not null check (cost >= 0),
  clicks       integer not null default 0 check (clicks >= 0),
  impressions  integer not null default 0 check (impressions >= 0),
  conversions  numeric(10,2) not null default 0 check (conversions >= 0),
  currency     text not null default 'THB',
  imported_by  uuid references public.profiles(id) on delete set null,
  imported_at  timestamptz not null default now(),
  unique (spend_date, platform, campaign, locale)
);

alter table public.marketing_ad_spend drop constraint if exists marketing_ad_spend_platform_check;
alter table public.marketing_ad_spend add constraint marketing_ad_spend_platform_check
  check (platform in ('google_ads','meta','line','other'));
alter table public.marketing_ad_spend drop constraint if exists marketing_ad_spend_locale_check;
alter table public.marketing_ad_spend add constraint marketing_ad_spend_locale_check
  check (locale in ('th','en','zh','all'));

comment on table public.marketing_ad_spend is
  'Daily ad cost per platform/campaign/locale, imported by admins from platform CSV exports (/marketing-insights). Feeds CPL / ROAS next to the lead funnel. Admin-only RLS.';

alter table public.marketing_ad_spend enable row level security;

drop policy if exists "admin read ad spend" on public.marketing_ad_spend;
create policy "admin read ad spend" on public.marketing_ad_spend
  for select using (public.is_admin());
drop policy if exists "admin write ad spend" on public.marketing_ad_spend;
create policy "admin write ad spend" on public.marketing_ad_spend
  for insert with check (public.is_admin() and (imported_by is null or imported_by = auth.uid()));
drop policy if exists "admin update ad spend" on public.marketing_ad_spend;
create policy "admin update ad spend" on public.marketing_ad_spend
  for update using (public.is_admin()) with check (public.is_admin() and (imported_by is null or imported_by = auth.uid()));
drop policy if exists "admin delete ad spend" on public.marketing_ad_spend;
create policy "admin delete ad spend" on public.marketing_ad_spend
  for delete using (public.is_admin());

create index if not exists marketing_ad_spend_date_idx on public.marketing_ad_spend (spend_date desc);
