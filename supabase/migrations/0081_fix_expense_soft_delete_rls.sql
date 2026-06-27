-- 0081_fix_expense_soft_delete_rls.sql
-- Bug: staff (admin/supervisor) could not soft-delete an expense — the UPDATE
-- that sets deleted_at failed with RLS 42501 ("new row violates row-level
-- security policy"). The live "expenses staff update" policy's WITH CHECK still
-- required `deleted_at IS NULL` (drift from migration 0054, whose file no longer
-- does), so writing a non-null deleted_at was rejected. Status updates worked
-- because they keep deleted_at NULL — matching the reported symptom.
--
-- Fix: re-create the policy so WITH CHECK only requires is_staff(); USING still
-- limits updates to live (non-deleted) rows.
drop policy if exists "expenses staff update" on public.expenses;
create policy "expenses staff update"
  on public.expenses for update
  using  (public.is_staff() and deleted_at is null)
  with check (public.is_staff());
