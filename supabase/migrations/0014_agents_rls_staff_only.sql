-- Migration 0014: restrict agents SELECT to staff + self only
--
-- Previously "agents read authed" let any authenticated non-client user read
-- ALL agent rows, including current_lat / current_lng / battery_pct.
-- That allowed agents to pull live GPS data via the Supabase client SDK even
-- when the /map route was server-side guarded.
--
-- New model:
--   staff (admin + supervisor) → see all rows
--   agent                      → see only their own row (needed by /api/agents/location)
--   client                     → no SELECT at all (covered by absence of a matching policy)

BEGIN;

DROP POLICY IF EXISTS "agents read authed"    ON public.agents;
DROP POLICY IF EXISTS "agents staff read all" ON public.agents;
DROP POLICY IF EXISTS "agents self read"      ON public.agents;

CREATE POLICY "agents staff read all" ON public.agents
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "agents self read" ON public.agents
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

COMMIT;
