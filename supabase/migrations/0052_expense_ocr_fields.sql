-- 0052_expense_ocr_fields.sql
-- Adds new expense_category enum values.
-- NOTE: ADD VALUE commits immediately but is NOT visible within the same
-- transaction. The data migration and column additions live in 0053.

ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'meals';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'accommodation';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'transportation';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'office';
