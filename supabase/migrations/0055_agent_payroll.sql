-- 0055_agent_payroll.sql
-- Agent Payroll module: daily payments owed to investigators.
-- Separate from expenses (operational costs). Tracks who is owed what,
-- payment status, and edit history via audit_logs.

-- 1. Status enum
CREATE TYPE payroll_status AS ENUM ('pending', 'paid', 'cancelled', 'adjusted');

-- 2. Main table
CREATE TABLE public.agent_payments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        REFERENCES public.agents(id)   ON DELETE SET NULL,
  case_id     uuid        REFERENCES public.cases(id)    ON DELETE SET NULL,
  work_date   date        NOT NULL,
  amount      numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency    text        NOT NULL DEFAULT 'THB',
  notes       text,
  status      payroll_status NOT NULL DEFAULT 'pending',
  paid_at     timestamptz,
  paid_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. updated_at trigger (reuses existing function)
CREATE TRIGGER trg_agent_payments_updated
  BEFORE UPDATE ON public.agent_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Indexes
CREATE INDEX agent_payments_agent_idx  ON public.agent_payments (agent_id);
CREATE INDEX agent_payments_case_idx   ON public.agent_payments (case_id);
CREATE INDEX agent_payments_date_idx   ON public.agent_payments (work_date DESC);
CREATE INDEX agent_payments_status_idx ON public.agent_payments (status);
CREATE INDEX agent_payments_paid_by    ON public.agent_payments (paid_by) WHERE paid_by IS NOT NULL;

-- 5. RLS
ALTER TABLE public.agent_payments ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD
CREATE POLICY "payroll admin all"
  ON public.agent_payments FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Supervisor: read all + update status (mark paid / adjust)
-- Supervisors can manage payroll for all agents (they run field teams).
CREATE POLICY "payroll supervisor select"
  ON public.agent_payments FOR SELECT
  USING (public.current_role() = 'supervisor');

CREATE POLICY "payroll supervisor update"
  ON public.agent_payments FOR UPDATE
  USING  (public.current_role() = 'supervisor')
  WITH CHECK (public.current_role() = 'supervisor');

-- Agents: read only their own records
CREATE POLICY "payroll agent read"
  ON public.agent_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = agent_payments.agent_id
        AND a.profile_id = auth.uid()
    )
  );
