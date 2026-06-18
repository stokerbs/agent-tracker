alter table reports
  add column if not exists rejection_notes text,
  add column if not exists rejected_by     uuid references profiles(id) on delete set null,
  add column if not exists rejected_at     timestamptz;
