-- 0105 — OSINT Contact Intelligence (Phase 1: Phone).
--
-- Second OSINT module: given a target's phone / email / username, produce a
-- contact-intelligence report and attach it to a case. Phase 1 parses phone
-- numbers in-process (libphonenumber-js). Email-breach (HIBP) and username
-- discovery are Phase 2 — placeholder tables only, no writer yet.
--
-- PDPA: the INPUT is a target's personal identifier. It is stored ENCRYPTED
-- (input_enc via encryptField, AES-256-GCM) plus a blind index (input_bidx,
-- HMAC of the normalized value) for dedupe / "have we looked this up before".
-- The raw value is never persisted. Access mirrors the image module (creator |
-- admin | accessible case); writes are service-role only (the pipeline).

create type contact_input_type as enum ('phone', 'email', 'username');

-- ── contact_analysis — root row ──────────────────────────────────────────────
create table public.contact_analysis (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid references public.profiles (id) on delete set null,
  case_id       uuid references public.cases (id) on delete set null,
  input_type    contact_input_type not null,
  input_enc     text not null,   -- encryptField(raw input) — never plaintext
  input_bidx    text not null,   -- blind index (HMAC of normalized input)
  status        osint_status not null default 'pending',
  stage_status  jsonb not null default '{}'::jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index contact_analysis_creator_idx on public.contact_analysis (created_by, created_at desc);
create index contact_analysis_case_idx    on public.contact_analysis (case_id, created_at desc);
-- "have we looked this identifier up before" without decrypting anything:
create index contact_analysis_bidx_idx     on public.contact_analysis (input_bidx);

-- ── contact_phone — parsed phone facts (Phase 1) ─────────────────────────────
create table public.contact_phone (
  analysis_id      uuid primary key references public.contact_analysis (id) on delete cascade,
  valid            boolean,
  possible         boolean,
  e164_enc         text,   -- encrypted E.164 (still PII)
  national_fmt_enc text,   -- encrypted national formatting
  country          text,   -- ISO country (not PII)
  line_type        text,   -- mobile | fixed_line | voip | ...
  raw              jsonb,  -- non-PII parsed extras (country_calling_code, etc.)
  created_at       timestamptz not null default now()
);

-- ── contact_reports — AI analyst report ──────────────────────────────────────
create table public.contact_reports (
  analysis_id     uuid primary key references public.contact_analysis (id) on delete cascade,
  model           text not null,
  summary         text,
  leads           jsonb,
  recommendations jsonb,
  risk_score      integer,
  confidence      integer,
  created_at      timestamptz not null default now()
);

-- ── Phase-2 placeholders (RLS on, no Phase-1 writer) ─────────────────────────
create table public.contact_breaches (
  id           bigserial primary key,
  analysis_id  uuid not null references public.contact_analysis (id) on delete cascade,
  source       text not null,      -- e.g. "HIBP"
  name         text,               -- breach name
  breach_date  date,
  data_classes jsonb,              -- what leaked
  created_at   timestamptz not null default now()
);
create index contact_breaches_analysis_idx on public.contact_breaches (analysis_id);

create table public.contact_accounts (
  id           bigserial primary key,
  analysis_id  uuid not null references public.contact_analysis (id) on delete cascade,
  platform     text not null,
  url          text,
  exists_flag  boolean,
  confidence   double precision,
  created_at   timestamptz not null default now()
);
create index contact_accounts_analysis_idx on public.contact_accounts (analysis_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
create trigger trg_contact_analysis_updated before update on public.contact_analysis
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.contact_analysis enable row level security;
alter table public.contact_phone    enable row level security;
alter table public.contact_reports  enable row level security;
alter table public.contact_breaches enable row level security;
alter table public.contact_accounts enable row level security;

-- Read predicate reused by child tables (mirrors can_read_image_analysis).
create or replace function public.can_read_contact_analysis(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contact_analysis ca
    where ca.id = target
      and (
        public.is_admin()
        or ca.created_by = auth.uid()
        or (ca.case_id is not null and public.can_access_case(ca.case_id))
      )
  );
$$;

create policy "contact_analysis read" on public.contact_analysis for select
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (case_id is not null and public.can_access_case(case_id))
  );
create policy "contact_analysis insert" on public.contact_analysis for insert
  with check (public.is_staff() and created_by = auth.uid());
create policy "contact_analysis update" on public.contact_analysis for update
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());
create policy "contact_analysis delete" on public.contact_analysis for delete
  using (public.is_admin() or created_by = auth.uid());

-- Child tables: read follows the parent; writes are service-role only.
create policy "contact_phone read" on public.contact_phone for select
  using (public.can_read_contact_analysis(analysis_id));
create policy "contact_reports read" on public.contact_reports for select
  using (public.can_read_contact_analysis(analysis_id));
create policy "contact_breaches read" on public.contact_breaches for select
  using (public.can_read_contact_analysis(analysis_id));
create policy "contact_accounts read" on public.contact_accounts for select
  using (public.can_read_contact_analysis(analysis_id));
