-- AI-generated marketing articles for the public site, published on a schedule
-- with owner approval. A cron job (service role) inserts DRAFTS; the owner
-- approves via a one-time token link (service role flips status → published);
-- the public article pages then render published rows.
--
-- Kept entirely separate from the 27 hand-migrated WordPress articles (those are
-- static .md files rendered at root slugs). These render at /articles/<slug> and
-- /en/articles/<slug>.

create table if not exists public.marketing_articles (
  id              uuid primary key default gen_random_uuid(),
  topic           text not null,                 -- seed topic used to generate
  th_slug         text not null unique,
  en_slug         text not null unique,
  th_title        text not null,
  th_description  text not null,
  th_body         text not null,                 -- markdown
  en_title        text not null,
  en_description  text not null,
  en_body         text not null,                 -- markdown
  cover_category  text,                          -- feeds getArticleCover()
  status          text not null default 'draft', -- draft | published | rejected
  approve_token   text not null unique,          -- capability token for the review link
  model           text,
  created_at      timestamptz not null default now(),
  published_at    timestamptz
);

comment on table public.marketing_articles is
  'AI-generated marketing articles (draft→approved→published). Cron inserts drafts via service role; public reads published only.';

alter table public.marketing_articles enable row level security;

-- Public (anon) may read ONLY published articles — that's what the public pages
-- render. Drafts/rejected stay invisible to anon.
drop policy if exists "public read published articles" on public.marketing_articles;
create policy "public read published articles" on public.marketing_articles
  for select using (status = 'published');

-- Admins can read everything (incl. drafts) for the dashboard.
drop policy if exists "admin read all articles" on public.marketing_articles;
create policy "admin read all articles" on public.marketing_articles
  for select using (public.is_admin());

drop policy if exists "admin update articles" on public.marketing_articles;
create policy "admin update articles" on public.marketing_articles
  for update using (public.is_admin()) with check (public.is_admin());

-- No insert/delete policy → anon/non-admin cannot write. The cron uses the
-- service-role key to insert drafts; the token-gated approve route uses the
-- service role to flip status (after verifying the one-time token).

create index if not exists marketing_articles_status_idx on public.marketing_articles (status);
create index if not exists marketing_articles_published_idx on public.marketing_articles (published_at desc);
create index if not exists marketing_articles_token_idx on public.marketing_articles (approve_token);
