-- 0060_locations_improved.sql
-- Adds location_name and maps_url to target_locations.
-- No existing columns are dropped. All existing data is preserved.

ALTER TABLE public.target_locations
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS maps_url      text;

-- Backfill location_name from label for records that already have a label
UPDATE public.target_locations
  SET location_name = label
  WHERE label IS NOT NULL AND location_name IS NULL;
