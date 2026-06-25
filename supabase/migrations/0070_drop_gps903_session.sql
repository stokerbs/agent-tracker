-- Migration 0070 — Drop obsolete gps903_session singleton table
--
-- The gps903_session table (created in 0036 as a singleton id=1 cache for the
-- single-device ASP.NET_SessionId cookie) has been superseded since 0041 by the
-- per-credential table gps903_credential_sessions. It is genuinely unused: no
-- application read/write, no RPC/trigger/view, no FK in or out, no later-migration
-- dependency, and no runtime path. The only remaining reference is a stale entry
-- in the generated src/lib/database.types.ts, which will be cleared on the next
-- `supabase gen types` regeneration (separate follow-up).
--
-- SEC-2 / Register #1.
--
-- IF EXISTS for idempotency. No CASCADE: nothing depends on this table at the DB
-- level; its own PK/CHECK constraints and RLS enablement drop with the table.

BEGIN;

DROP TABLE IF EXISTS public.gps903_session;

COMMIT;
