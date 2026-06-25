-- Migration 0075 — Consolidate redundant updated_at trigger functions
--
-- Two updated_at trigger functions exist and are byte-for-byte identical:
--   public.set_updated_at()  (created in 0002) — the canonical original.
--   public.touch_updated_at() (created in 0033) — a later duplicate.
-- Both have the same body (`new.updated_at = now(); return new;`), the same
-- language (plpgsql), and neither is SECURITY DEFINER or sets search_path. They
-- are functionally indistinguishable, so maintaining both is pure redundancy.
--
-- This migration KEEPS the canonical public.set_updated_at() — it is the earlier
-- definition and is already wired to ~9 BEFORE UPDATE triggers across the schema
-- (profiles, agents, clients, cases, reports, and others) — and DROPS the
-- redundant public.touch_updated_at(), which has exactly ONE dependent: the
-- ai_prompts_updated_at trigger on public.ai_prompts (created in 0033).
--
-- DEPENDENCY ORDER: a function cannot be dropped while a trigger references it
-- (DROP FUNCTION errors without CASCADE). We therefore REPOINT the dependent
-- trigger onto set_updated_at() FIRST, then drop touch_updated_at() once nothing
-- depends on it. The repointed trigger is recreated faithfully from the 0033
-- original — BEFORE UPDATE, FOR EACH ROW, no WHEN clause, no INSERT/DELETE
-- events — so behaviour is identical; only the target function name changes.
--
-- NO CASCADE is used: CASCADE on DROP FUNCTION would silently DROP the
-- ai_prompts_updated_at trigger itself, removing the updated_at auto-touch
-- behaviour on public.ai_prompts — a forbidden behavioural change. The trigger
-- must survive, only repointed, which is why it is detached-and-recreated above
-- the drop rather than cascaded away.
--
-- TD-13 / Register #23.
--
-- IF EXISTS on both DROP statements for idempotency. Schema-qualified public.
-- set_updated_at() and its ~9 existing triggers are deliberately untouched.

BEGIN;

-- 1. Repoint the only dependent of touch_updated_at() onto the canonical set_updated_at().
--    Faithful to the original (0033): BEFORE UPDATE, FOR EACH ROW, no WHEN clause.
DROP TRIGGER IF EXISTS ai_prompts_updated_at ON public.ai_prompts;
CREATE TRIGGER ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Now safe to drop the redundant function (no remaining dependents).
DROP FUNCTION IF EXISTS public.touch_updated_at();

COMMIT;
