-- 0103 — OSINT Image Intelligence (Phase 1: Node-only forensics).
--
-- New flagship module: given an uploaded image / URL / base64 / redirect URL we
-- produce a forensic report (hashes, EXIF/GPS, redirect chain, cloud+CDN
-- attribution, integrity heuristics, reverse-search launchers, AI summary),
-- store it normalized, and let staff attach the result to a case.
--
-- Access model — staff-authored, case-scoped when linked:
--   • an analysis with case_id IS NULL  → visible to its creator + admins
--   • an analysis linked to a case      → follows can_access_case(case_id)
--     (mirrors the supervisor re-scope in 0087/0095)
-- All pipeline WRITES go through the service-role client (RLS-bypass) after a
-- JS-side requireStaff()/can-access check, so the write policies below stay
-- deliberately narrow (creator/admin only) — the UI never inserts child rows
-- directly.
--
-- Phase 2 (face embeddings / OCR / object detection) is NOT built here. We
-- create image_faces / image_objects / image_ocr as empty, RLS-protected
-- placeholders so the Phase-1 schema and the graph are stable. Per the PDPA
-- decision, image_faces intentionally has NO embedding column — only
-- count/bbox/quality — until a lawful-basis + retention policy is signed off.

-- ── enums ────────────────────────────────────────────────────────────────────
create type osint_source_type   as enum ('upload', 'url', 'base64', 'redirect');
create type osint_status        as enum ('pending', 'processing', 'complete', 'failed');
create type osint_redirect_kind as enum ('http', 'meta', 'js', 'origin');

-- ── image_analysis — root row ────────────────────────────────────────────────
create table public.image_analysis (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references public.profiles (id) on delete set null,
  case_id       uuid references public.cases (id) on delete set null,
  source_type   osint_source_type not null,
  -- The original input reference (URL / redirect URL). Never the raw bytes and
  -- never a filename we trust for MIME — see storage_path for the stored copy.
  source_ref    text,
  status        osint_status not null default 'pending',
  -- Per-stage progress so the UI can render incremental / retry states and
  -- Phase 2 can move stages onto a worker with no schema change.
  -- shape: { hashes: 'complete'|'failed'|'skipped'|'pending', metadata: ..., ... }
  stage_status  jsonb not null default '{}'::jsonb,
  error         text,
  -- Decoded image facts (populated by the metadata stage).
  width         integer,
  height        integer,
  mime          text,
  format        text,
  filesize      bigint,
  dpi           integer,
  -- Where the analyzed bytes live in the 'evidence' bucket: osint/<id>/original.
  storage_path  text,
  -- Node-derivable integrity heuristics (see src/lib/osint/integrity.ts):
  -- { metadata_stripped: bool, likely_resized: bool, likely_screenshot: bool,
  --   likely_edited_software: string|null, confidence: number, signals: [...] }
  integrity     jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index image_analysis_creator_idx on public.image_analysis (created_by, created_at desc);
create index image_analysis_case_idx    on public.image_analysis (case_id, created_at desc);

-- ── image_hashes — one row per analysis ──────────────────────────────────────
create table public.image_hashes (
  analysis_id  uuid primary key references public.image_analysis (id) on delete cascade,
  md5          text,
  sha1         text,
  sha256       text,
  phash        text,   -- perceptual (DCT) hash, hex
  dhash        text,   -- difference hash, hex
  ahash        text,   -- average hash, hex
  created_at   timestamptz not null default now()
);
-- sha256 is the primary "have we seen this exact file" key; phash for near-dupe.
create index image_hashes_sha256_idx on public.image_hashes (sha256);
create index image_hashes_phash_idx  on public.image_hashes (phash);

-- ── image_metadata — one row per analysis ────────────────────────────────────
create table public.image_metadata (
  analysis_id  uuid primary key references public.image_analysis (id) on delete cascade,
  camera_make  text,
  camera_model text,
  lens         text,
  software     text,
  orientation  integer,
  gps_lat      double precision,
  gps_lng      double precision,
  gps_altitude double precision,
  taken_at     timestamptz,
  raw_exif     jsonb,   -- full parsed EXIF/TIFF/GPS for the details drawer
  created_at   timestamptz not null default now()
);
create index image_metadata_gps_idx on public.image_metadata (gps_lat, gps_lng)
  where gps_lat is not null and gps_lng is not null;

-- ── image_redirects — redirect chain, one row per hop ────────────────────────
create table public.image_redirects (
  id            bigserial primary key,
  analysis_id   uuid not null references public.image_analysis (id) on delete cascade,
  hop_index     integer not null,      -- 0-based order in the chain
  kind          osint_redirect_kind not null,
  url           text not null,
  status_code   integer,
  resolved_host text,
  resolved_ip   text,                  -- IP the host resolved to (SSRF forensics)
  created_at    timestamptz not null default now(),
  unique (analysis_id, hop_index)
);
create index image_redirects_analysis_idx on public.image_redirects (analysis_id, hop_index);

-- ── image_reports — the AI analyst report, one row per analysis ──────────────
create table public.image_reports (
  analysis_id     uuid primary key references public.image_analysis (id) on delete cascade,
  model           text not null,
  summary         text,
  likely_origin   text,
  leads           jsonb,   -- string[] of investigative leads
  recommendations jsonb,   -- string[] of OSINT recommendations
  risk_score      integer, -- 0..100
  confidence      integer, -- 0..100
  created_at      timestamptz not null default now()
);

-- ── Phase-2 placeholders (RLS on, no Phase-1 writer) ─────────────────────────
-- image_faces: NO embedding column by design (PDPA — detect, don't store).
create table public.image_faces (
  id           bigserial primary key,
  analysis_id  uuid not null references public.image_analysis (id) on delete cascade,
  face_index   integer not null,
  bbox         jsonb,             -- { x, y, w, h } normalized 0..1
  blur_score   double precision,  -- higher = sharper
  yaw          double precision,
  pitch        double precision,
  roll         double precision,
  has_glasses  boolean,
  has_mask     boolean,
  confidence   double precision,
  created_at   timestamptz not null default now()
);
create index image_faces_analysis_idx on public.image_faces (analysis_id);

create table public.image_objects (
  id           bigserial primary key,
  analysis_id  uuid not null references public.image_analysis (id) on delete cascade,
  label        text not null,
  category     text,              -- vehicle | building | weapon | document | logo | ...
  bbox         jsonb,
  confidence   double precision,
  created_at   timestamptz not null default now()
);
create index image_objects_analysis_idx on public.image_objects (analysis_id);

create table public.image_ocr (
  id           bigserial primary key,
  analysis_id  uuid not null references public.image_analysis (id) on delete cascade,
  text         text not null,
  category     text,              -- plate | email | phone | address | name | url | raw
  bbox         jsonb,
  confidence   double precision,
  created_at   timestamptz not null default now()
);
create index image_ocr_analysis_idx on public.image_ocr (analysis_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
create trigger trg_image_analysis_updated before update on public.image_analysis
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.image_analysis enable row level security;
alter table public.image_hashes   enable row level security;
alter table public.image_metadata enable row level security;
alter table public.image_redirects enable row level security;
alter table public.image_reports  enable row level security;
alter table public.image_faces    enable row level security;
alter table public.image_objects  enable row level security;
alter table public.image_ocr      enable row level security;

-- A helper predicate reused by every child table: the caller may read the
-- analysis if they own it, they're admin, or it's linked to a case they access.
-- Inlined per-table (SQL RLS can't take a helper cleanly without another
-- security-definer fn) → we add public.can_read_image_analysis for reuse.
create or replace function public.can_read_image_analysis(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.image_analysis ia
    where ia.id = target
      and (
        public.is_admin()
        or ia.created_by = auth.uid()
        or (ia.case_id is not null and public.can_access_case(ia.case_id))
      )
  );
$$;

-- image_analysis: read (own | admin | accessible case), and creator/admin write.
create policy "image_analysis read" on public.image_analysis for select
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (case_id is not null and public.can_access_case(case_id))
  );
create policy "image_analysis insert" on public.image_analysis for insert
  with check (public.is_staff() and created_by = auth.uid());
create policy "image_analysis update" on public.image_analysis for update
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy "image_analysis delete" on public.image_analysis for delete
  using (public.is_admin() or created_by = auth.uid());

-- Child tables: read follows the parent; writes are service-role only
-- (pipeline), so no INSERT/UPDATE policy is granted to end users.
create policy "image_hashes read" on public.image_hashes for select
  using (public.can_read_image_analysis(analysis_id));
create policy "image_metadata read" on public.image_metadata for select
  using (public.can_read_image_analysis(analysis_id));
create policy "image_redirects read" on public.image_redirects for select
  using (public.can_read_image_analysis(analysis_id));
create policy "image_reports read" on public.image_reports for select
  using (public.can_read_image_analysis(analysis_id));
create policy "image_faces read" on public.image_faces for select
  using (public.can_read_image_analysis(analysis_id));
create policy "image_objects read" on public.image_objects for select
  using (public.can_read_image_analysis(analysis_id));
create policy "image_ocr read" on public.image_ocr for select
  using (public.can_read_image_analysis(analysis_id));

-- ── storage: 'evidence' bucket, osint/<analysis_id>/ prefix ──────────────────
-- Reuse the existing evidence bucket + its admin/agent/supervisor read policies
-- (0004/0057/0095). We add creator-scoped read/write for the osint/ prefix so an
-- analyst can view their own not-yet-linked analyses' images. Folder segment 2
-- (osint/<analysis_id>/...) is matched as text against an analysis the caller
-- can read.
create policy "evidence osint owner read" on storage.objects for select
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = 'osint'
    -- Guard the ::uuid cast: only proceed when segment 2 is a well-formed UUID,
    -- so an unexpected osint/<non-uuid>/ object can never error the RLS check.
    and (storage.foldername(name))[2] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_read_image_analysis(((storage.foldername(name))[2])::uuid)
  );
