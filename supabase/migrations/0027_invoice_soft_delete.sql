-- ============================================================================
-- Migration 0027 — Invoice soft delete + RLS refinement
--
-- Changes:
--   1. Add deleted_at / deleted_by columns for soft delete.
--   2. Split the broad "invoices staff all" FOR ALL policy into separate
--      SELECT / INSERT / UPDATE policies so the WITH CHECK on UPDATE can
--      allow setting deleted_at without being blocked by a IS NULL guard.
--   3. Update the client read policy to also exclude deleted rows.
-- ============================================================================
BEGIN;

-- ── 1. Soft-delete columns ────────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Partial index: fast filtering of active invoices (the common path)
CREATE INDEX IF NOT EXISTS invoices_active_idx
  ON public.invoices(client_id)
  WHERE deleted_at IS NULL;

-- ── 2. RLS policies ───────────────────────────────────────────────────────────
-- Drop existing broad policy and rebuild as targeted per-command policies.

DROP POLICY IF EXISTS "invoices staff all"       ON public.invoices;
DROP POLICY IF EXISTS "invoices staff select"    ON public.invoices;
DROP POLICY IF EXISTS "invoices staff insert"    ON public.invoices;
DROP POLICY IF EXISTS "invoices staff update"    ON public.invoices;
DROP POLICY IF EXISTS "invoices client read own" ON public.invoices;

-- Staff SELECT: non-deleted invoices only
CREATE POLICY "invoices staff select" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_staff() AND deleted_at IS NULL);

-- Staff INSERT: any new invoice (deleted_at defaults to NULL)
CREATE POLICY "invoices staff insert" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

-- Staff UPDATE: can update any non-deleted invoice — including soft-deleting it.
-- USING checks the OLD row (must be non-deleted to be a valid target).
-- WITH CHECK checks the NEW row; only requires is_staff() so that setting
-- deleted_at to a non-null value is permitted (the soft-delete operation).
CREATE POLICY "invoices staff update" ON public.invoices
  FOR UPDATE TO authenticated
  USING  (public.is_staff() AND deleted_at IS NULL)
  WITH CHECK (public.is_staff());

-- Clients: read own non-draft, non-deleted invoices
CREATE POLICY "invoices client read own" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND status != 'draft'
    AND client_id IN (
      SELECT id FROM public.clients WHERE profile_id = auth.uid()
    )
  );

COMMIT;
