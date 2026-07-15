-- 0104 — OSINT AI Geolocation (Picarta).
--
-- Predicts where a photo was taken from its visual content (architecture, signage,
-- landscape) even when EXIF GPS is absent — a distinct signal from image_metadata's
-- EXIF GPS. Populated by the geolocation stage (src/lib/osint/geolocation.ts) via
-- the Picarta API, gated on PICARTA_API_TOKEN; skipped when unset.
--
-- PDPA: an AI location guess about an identifiable person is sensitive. Same
-- access model as the rest of the module — read follows the parent analysis;
-- writes are service-role only (the pipeline), so no user write policy.

create table public.image_geolocation (
  analysis_id  uuid primary key references public.image_analysis (id) on delete cascade,
  provider     text not null default 'picarta',
  ai_lat       double precision,
  ai_lon       double precision,
  confidence   double precision, -- 0..1 for the top prediction
  country      text,
  city         text,
  province     text,
  -- Ranked top-k predictions: [{ lat, lon, confidence, country, city, province }]
  predictions  jsonb,
  created_at   timestamptz not null default now()
);

alter table public.image_geolocation enable row level security;

create policy "image_geolocation read" on public.image_geolocation for select
  using (public.can_read_image_analysis(analysis_id));
