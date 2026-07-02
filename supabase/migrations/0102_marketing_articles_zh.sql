-- Add a Chinese (ZH) version to AI-generated marketing articles, so the /zh
-- site gets its own article library alongside TH + EN. Nullable — older rows
-- (TH+EN only) simply won't appear on the ZH side; new articles get all three.

alter table public.marketing_articles
  add column if not exists zh_slug        text,
  add column if not exists zh_title       text,
  add column if not exists zh_description text,
  add column if not exists zh_body        text;

-- zh_slug unique when present (partial unique index allows many NULLs).
create unique index if not exists marketing_articles_zh_slug_key
  on public.marketing_articles (zh_slug)
  where zh_slug is not null;
