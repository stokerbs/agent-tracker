-- ============================================================================
-- Migration 0017 — Invoice payment fields
-- ============================================================================
BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at        timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_ref    text;

COMMIT;
