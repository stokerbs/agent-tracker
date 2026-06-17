-- Analytics: add date-range index for cross-agent heatmap queries.
-- The existing (agent_id, recorded_at DESC) composite index handles per-agent
-- queries; this partial index speeds up date-range scans across all agents.
CREATE INDEX IF NOT EXISTS idx_agent_loc_hist_recorded_at
  ON agent_location_history (recorded_at DESC);
