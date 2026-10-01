-- Phase 2 (docs/china-market/14, S-2): tag AI articles with the service they
-- support so article pages link to their /zh service page and service pages
-- list related articles. Nullable — older rows fall back to a cover-category
-- guess in the app (articleServiceKey()).
alter table public.marketing_articles
  add column if not exists service text;

create index if not exists marketing_articles_service_published_idx
  on public.marketing_articles (service, published_at desc)
  where status = 'published';

comment on column public.marketing_articles.service is
  'Service key (relationship | find_person | background | due_diligence | on_site | asset | pricing | general) from the Chinese content plan; links the article to its /zh service page.';
