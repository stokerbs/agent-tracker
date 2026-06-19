-- 0054_expense_status.sql
-- Adds payment status tracking and soft-delete to expenses.
-- Replaces blanket RLS ALL policies with split SELECT/INSERT/UPDATE/DELETE
-- that enforce deleted_at IS NULL on reads.

-- 1. New enum (DO block makes it idempotent)
DO $$ BEGIN
  CREATE TYPE expense_status AS ENUM ('pending', 'paid', 'reimbursed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. New columns
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS status     expense_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at    timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Index for common filters
CREATE INDEX IF NOT EXISTS expenses_status_idx ON public.expenses (status)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS expenses_deleted_at ON public.expenses (deleted_at) WHERE deleted_at IS NOT NULL;

-- 4. Replace blanket policies with split policies that honour soft-delete
-- Drop old blanket policies (may not exist if already replaced)
DROP POLICY IF EXISTS "expenses staff all"    ON public.expenses;
DROP POLICY IF EXISTS "expenses agent own"    ON public.expenses;
-- Drop new split policies too so this is idempotent (handles partial prior runs)
DROP POLICY IF EXISTS "expenses staff select"   ON public.expenses;
DROP POLICY IF EXISTS "expenses staff insert"   ON public.expenses;
DROP POLICY IF EXISTS "expenses staff update"   ON public.expenses;
DROP POLICY IF EXISTS "expenses staff delete"   ON public.expenses;
DROP POLICY IF EXISTS "expenses agent select"   ON public.expenses;
DROP POLICY IF EXISTS "expenses agent insert"   ON public.expenses;
DROP POLICY IF EXISTS "expenses agent update"   ON public.expenses;

-- Staff: full CRUD on non-deleted expenses; UPDATE USING allows setting deleted_at
CREATE POLICY "expenses staff select"
  ON public.expenses FOR SELECT
  USING (public.is_staff() AND deleted_at IS NULL);

CREATE POLICY "expenses staff insert"
  ON public.expenses FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "expenses staff update"
  ON public.expenses FOR UPDATE
  USING  (public.is_staff() AND deleted_at IS NULL)
  WITH CHECK (public.is_staff());

CREATE POLICY "expenses staff delete"
  ON public.expenses FOR DELETE
  USING (public.is_staff());

-- Agents: own non-deleted expenses only
CREATE POLICY "expenses agent select"
  ON public.expenses FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM public.agents a WHERE a.id = expenses.agent_id AND a.profile_id = auth.uid())
  );

CREATE POLICY "expenses agent insert"
  ON public.expenses FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.agents a WHERE a.id = expenses.agent_id AND a.profile_id = auth.uid())
  );

CREATE POLICY "expenses agent update"
  ON public.expenses FOR UPDATE
  USING (
    deleted_at IS NULL AND
    EXISTS (SELECT 1 FROM public.agents a WHERE a.id = expenses.agent_id AND a.profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.agents a WHERE a.id = expenses.agent_id AND a.profile_id = auth.uid())
  );
