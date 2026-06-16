-- ============================================================================
-- Migration 0013 — Add charging status to agents
--
-- The Battery Status API (navigator.getBattery) returns both a level (0–1)
-- and a charging boolean. Store the charging flag alongside battery_pct so
-- the dashboard can show a charging indicator and suppress low-battery alerts
-- for agents who are plugged in.
-- ============================================================================

alter table public.agents
  add column if not exists is_charging boolean;
