-- TD-8 (Register #18): case_agents.agent_id has TWO identical non-unique btree
-- indexes — case_agents_agent_idx (migration 0001, legacy <table>_<col>_idx name)
-- and idx_case_agents_agent_id (migration 0048, idx_<table>_<col> convention).
-- They cover exactly the same column, so one is pure write-amplification/storage
-- overhead with no query benefit.
--
-- Keep idx_case_agents_agent_id: it matches the naming convention and is the
-- documented covering index for the case_agents.agent_id RLS join sub-selects
-- (0048/0058/0065, can_access_case, referenced by name in 0071's header).
-- Drop the legacy 0001-named duplicate.
--
-- No behavioral or RLS change: an equivalent index on (agent_id) remains. Neither
-- index backs a PK/UNIQUE/FK constraint (the PK is composite (case_id, agent_id);
-- the FK's uniqueness requirement is on agents.id, not this column), so a plain
-- DROP INDEX is sufficient — no CASCADE. IF EXISTS keeps it idempotent.

BEGIN;
DROP INDEX IF EXISTS public.case_agents_agent_idx;
COMMIT;
