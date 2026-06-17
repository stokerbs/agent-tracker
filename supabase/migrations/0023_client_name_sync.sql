-- Migration 0023 — client_name sync trigger + deprecation
--
-- Context (R-3 from client-portal security audit):
--   cases.client_name is a legacy denormalized text column written at case
--   creation. It is NOT used for access control (which uses client_id → clients
--   → profiles.id exclusively). However it can drift from clients.name when a
--   client record is renamed.
--
-- Changes:
--   1. Column comment marking client_name as deprecated display denorm.
--   2. Trigger: when clients.name changes, back-fill client_name on all linked
--      cases so the denorm stays accurate.
--
-- Note: client_name remains in the schema to support cases that have no linked
-- client account (client_id IS NULL). In those cases it is the only display
-- label and should not be removed.

-- ── 1. Deprecation comment ────────────────────────────────────────────────────

COMMENT ON COLUMN public.cases.client_name IS
  'DEPRECATED DISPLAY DENORM — Do not use as source of truth. '
  'Access control uses client_id → clients.profile_id. '
  'When client_id is NOT NULL, read the client name via the clients join. '
  'Kept only for cases without a linked client account (client_id IS NULL).';

-- ── 2. Sync trigger: clients.name → cases.client_name ────────────────────────

CREATE OR REPLACE FUNCTION public.sync_client_name_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a client's name changes, update the denorm on all linked cases.
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.cases
    SET    client_name = NEW.name
    WHERE  client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_name ON public.clients;

CREATE TRIGGER trg_sync_client_name
  AFTER UPDATE OF name ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_name_on_update();
