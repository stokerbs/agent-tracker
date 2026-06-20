-- 0056_target_intel_profile.sql
-- Extends the cases table with additional encrypted target profile fields.
-- Existing target_name_enc / target_phone_enc / target_vehicle_enc /
-- license_plate_enc / target_address_enc are unchanged.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS target_alias_enc TEXT,   -- encrypted alias / nickname
  ADD COLUMN IF NOT EXISTS target_gender    TEXT,   -- 'male' | 'female' | 'other'
  ADD COLUMN IF NOT EXISTS target_age       SMALLINT,
  ADD COLUMN IF NOT EXISTS target_notes_enc TEXT;   -- encrypted free-form notes
