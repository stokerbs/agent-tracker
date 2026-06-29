-- Add an optional postal address to clients, shown in the invoice "Invoice to"
-- block (matching the new invoice template). Nullable; no backfill needed.

BEGIN;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address text;

COMMIT;
