-- ============================================================================
-- Migration 0015 — Invoices table with RLS
-- ============================================================================
BEGIN;

-- Invoice status enum
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice number sequence (INV-YYYYMM-001)
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('public.invoice_seq')::text, 3, '0');
$$;

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text        NOT NULL UNIQUE DEFAULT public.next_invoice_number(),
  client_id      uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  case_id        uuid        REFERENCES public.cases(id) ON DELETE SET NULL,
  title          text        NOT NULL,
  line_items     jsonb       NOT NULL DEFAULT '[]'::jsonb,
  amount         numeric(12,2) NOT NULL DEFAULT 0,
  currency       text        NOT NULL DEFAULT 'THB',
  status         public.invoice_status NOT NULL DEFAULT 'draft',
  issued_date    date        NOT NULL DEFAULT CURRENT_DATE,
  due_date       date,
  notes          text,
  created_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_client_idx ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status);

-- Updated at trigger
DROP TRIGGER IF EXISTS trg_invoices_updated ON public.invoices;
CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices staff all"        ON public.invoices;
DROP POLICY IF EXISTS "invoices client read own"  ON public.invoices;

-- Staff: full CRUD
CREATE POLICY "invoices staff all" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Clients: read own non-draft invoices only
CREATE POLICY "invoices client read own" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    status != 'draft'
    AND client_id IN (
      SELECT id FROM public.clients WHERE profile_id = auth.uid()
    )
  );

COMMIT;
