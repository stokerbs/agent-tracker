-- ============================================================================
-- Migration 0031 — Public agent-photos storage bucket
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('agent-photos', 'agent-photos', true)
on conflict (id) do nothing;

-- Staff (admin + supervisor) may upload / replace / delete any agent photo.
-- Path convention: agent-photos/{agent_id}/{timestamp}.{ext}
create policy "agent-photos staff write"
  on storage.objects for insert
  with check (bucket_id = 'agent-photos' and public.is_staff());

create policy "agent-photos staff update"
  on storage.objects for update
  using (bucket_id = 'agent-photos' and public.is_staff());

create policy "agent-photos staff delete"
  on storage.objects for delete
  using (bucket_id = 'agent-photos' and public.is_staff());
