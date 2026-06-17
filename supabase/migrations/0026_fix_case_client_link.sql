-- ============================================================================
-- Migration 0026 — Fix cases.client_id: backfill + FK consistency + integrity
--
-- Root cause: createCase / updateCase never wrote client_id to the cases
-- table. The application only stored the free-text client_name denorm.
-- Every case row has client_id = NULL, which breaks:
--   • Portal cases query  (eq("client_id", clientRow.id) → 0 rows)
--   • Portal reports      (caseIds empty → query skipped)
--   • CreateInvoiceDialog case filter (cases.filter(c => c.client_id === ...) → [])
--   • Case detail "Create Invoice" button (hidden because c.client_id is falsy)
--   • Case detail "Client" info row     (same)
--   • RLS "cases client read"  — join on c.client_id always null
--   • RLS "reports client read" — join through cases.client_id always null
--
-- Changes:
--   1. Backfill cases.client_id from exact client_name→clients.name match.
--   2. Fix invoices.created_by: references auth.users — should be profiles.
--   3. Add integrity trigger: invoices.case_id must belong to invoices.client_id
--      (prevents staff from linking an invoice to a case owned by a different client).
-- ============================================================================

-- ── 1. Backfill cases.client_id ───────────────────────────────────────────────
-- Best-effort: exact case-insensitive name match. Cases with no match keep
-- client_id = NULL and are fixed through the updated UI.

UPDATE public.cases c
SET    client_id = (
  SELECT cl.id
  FROM   public.clients cl
  WHERE  lower(trim(cl.name)) = lower(trim(c.client_name))
  LIMIT  1
)
WHERE  c.client_id IS NULL
  AND  c.client_name IS NOT NULL
  AND  c.client_name <> '';

-- ── 2. Fix invoices.created_by FK ─────────────────────────────────────────────
-- Migration 0015 referenced auth.users(id); all other created_by columns
-- reference profiles(id). Since profiles.id = auth.users.id (same UUID space,
-- set by handle_new_user trigger), no data loss occurs on re-pointing.

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── 3. Invoice case-client integrity trigger ──────────────────────────────────
-- Enforces: when an invoice is linked to a case (case_id IS NOT NULL), the
-- case must belong to the same client as the invoice (cases.client_id = invoices.client_id).
-- Without this a staff member could accidentally invoice the wrong client for a case.

CREATE OR REPLACE FUNCTION public.check_invoice_case_client()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.case_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM   public.cases
      WHERE  id        = NEW.case_id
        AND  client_id = NEW.client_id
    ) THEN
      RAISE EXCEPTION
        'invoice case_id (%) does not belong to client_id (%)',
        NEW.case_id, NEW.client_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_case_client ON public.invoices;

CREATE TRIGGER trg_invoice_case_client
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.check_invoice_case_client();
