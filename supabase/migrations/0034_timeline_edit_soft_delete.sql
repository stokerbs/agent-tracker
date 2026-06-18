-- Timeline entries: add soft-delete + audit columns for edit/delete tracking
alter table public.timeline_entries
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at  timestamptz,
  add column if not exists updated_by  uuid references public.profiles(id) on delete set null;

-- Partial index: speeds up the common query that hides deleted rows
create index if not exists timeline_entries_active_idx
  on public.timeline_entries (case_id, entry_date, entry_time)
  where deleted_at is null;
