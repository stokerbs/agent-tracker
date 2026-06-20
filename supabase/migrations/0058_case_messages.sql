-- Case messages: two-way thread between staff and clients per case.
-- is_internal = TRUE messages are staff-only notes (RLS enforces client cannot see them).
-- case_message_views tracks last-seen timestamp per user per case for unread badges.

CREATE TABLE IF NOT EXISTS public.case_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id),
  body        TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_messages_case
  ON public.case_messages (case_id, created_at ASC);

ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;

-- Admin: full access to all messages on all cases
CREATE POLICY "msgs_admin_all" ON public.case_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Supervisor: full access to all messages on all cases
CREATE POLICY "msgs_supervisor_all" ON public.case_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'supervisor')
  );

-- Agent: select + insert non-internal messages on their assigned cases only
CREATE POLICY "msgs_agent_select" ON public.case_messages
  FOR SELECT USING (
    is_internal = FALSE
    AND EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = case_messages.case_id
        AND a.profile_id = auth.uid()
    )
  );

CREATE POLICY "msgs_agent_insert" ON public.case_messages
  FOR INSERT WITH CHECK (
    is_internal = FALSE
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.case_agents ca
      JOIN public.agents a ON a.id = ca.agent_id
      WHERE ca.case_id = case_messages.case_id
        AND a.profile_id = auth.uid()
    )
  );

-- Client: select + insert non-internal messages on their own cases only
CREATE POLICY "msgs_client_select" ON public.case_messages
  FOR SELECT USING (
    is_internal = FALSE
    AND EXISTS (
      SELECT 1 FROM public.cases c2
      JOIN public.clients cl ON cl.id = c2.client_id
      WHERE c2.id = case_messages.case_id
        AND cl.profile_id = auth.uid()
    )
  );

CREATE POLICY "msgs_client_insert" ON public.case_messages
  FOR INSERT WITH CHECK (
    is_internal = FALSE
    AND sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cases c2
      JOIN public.clients cl ON cl.id = c2.client_id
      WHERE c2.id = case_messages.case_id
        AND cl.profile_id = auth.uid()
    )
  );

-- ── Last-seen tracking for unread badges ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.case_message_views (
  case_id      UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_id, profile_id)
);

ALTER TABLE public.case_message_views ENABLE ROW LEVEL SECURITY;

-- Each user can only read and write their own row
CREATE POLICY "views_own" ON public.case_message_views
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
