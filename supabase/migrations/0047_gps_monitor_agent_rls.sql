-- Migration 0047 — GPS Monitor: agent read access via case assignment
--
-- Agents can now read gps_devices and gps_device_positions for:
-- 1. Devices directly assigned to them (gps_devices.agent_id)
-- 2. Devices attached to any case where they are a team member (case_agents)
--
-- This is additive — existing admin and access-grant-based policies are unchanged.

-- gps_devices: agent read via case assignment or direct assignment
CREATE POLICY "gps_devices_agent_read" ON public.gps_devices
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      -- Directly assigned to this agent
      EXISTS (
        SELECT 1 FROM public.agents a
        WHERE a.id    = gps_devices.agent_id
          AND a.profile_id = auth.uid()
      )
      OR
      -- Attached to a case where this agent is a team member
      EXISTS (
        SELECT 1
        FROM public.agents   a
        JOIN public.case_agents ca ON ca.agent_id = a.id
        WHERE a.profile_id   = auth.uid()
          AND ca.case_id     = gps_devices.case_id
      )
    )
  );

-- gps_device_positions: agent read for the same devices
CREATE POLICY "gdp_agent_read" ON public.gps_device_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.gps_devices gd
      WHERE gd.id         = gps_device_positions.gps_device_id
        AND gd.deleted_at IS NULL
        AND (
          EXISTS (
            SELECT 1 FROM public.agents a
            WHERE a.id          = gd.agent_id
              AND a.profile_id  = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1
            FROM public.agents   a
            JOIN public.case_agents ca ON ca.agent_id = a.id
            WHERE a.profile_id  = auth.uid()
              AND ca.case_id    = gd.case_id
          )
        )
    )
  );
