-- Timeline v2 (Observation Module)
-- Adds timeline_entry_id FK to evidence, enabling photos/files to be attached
-- to a specific timeline entry. Nullable: existing evidence rows are unaffected.

ALTER TABLE public.evidence
  ADD COLUMN timeline_entry_id uuid
    REFERENCES public.timeline_entries(id)
    ON DELETE SET NULL;

CREATE INDEX idx_evidence_timeline_entry_id
  ON public.evidence (timeline_entry_id)
  WHERE timeline_entry_id IS NOT NULL;

-- Harden the agent insert policy: when timeline_entry_id is supplied it must
-- belong to the same case as the evidence row being inserted.
DROP POLICY IF EXISTS "evidence agent insert" ON public.evidence;

CREATE POLICY "evidence agent insert" ON public.evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   public.case_agents ca
      JOIN   public.agents a ON a.id = ca.agent_id
      WHERE  ca.case_id        = evidence.case_id
        AND  a.profile_id      = auth.uid()
    )
    AND (
      timeline_entry_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.timeline_entries te
        WHERE  te.id         = timeline_entry_id
          AND  te.case_id    = evidence.case_id
          AND  te.deleted_at IS NULL
      )
    )
  );
