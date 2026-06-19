-- 0053_expense_ocr_columns.sql
-- Migrates legacy category values and adds OCR metadata columns.
-- Runs after 0052 so the new enum values are committed and visible.

-- Migrate legacy values
UPDATE public.expenses SET category = 'meals'::expense_category        WHERE category = 'food';
UPDATE public.expenses SET category = 'accommodation'::expense_category WHERE category = 'hotel';

-- OCR metadata columns
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS vendor_name    text,
  ADD COLUMN IF NOT EXISTS vat_amount     numeric(10, 2),
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS expense_time   time,
  ADD COLUMN IF NOT EXISTS ocr_confidence smallint CHECK (ocr_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ocr_raw        jsonb,
  ADD COLUMN IF NOT EXISTS source         text NOT NULL DEFAULT 'manual'
                                          CHECK (source IN ('manual', 'ocr'));

-- Switch currency default to THB
ALTER TABLE public.expenses ALTER COLUMN currency SET DEFAULT 'THB';
