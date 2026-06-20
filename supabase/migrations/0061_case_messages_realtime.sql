-- 0061_case_messages_realtime.sql
-- Enable Supabase Realtime for case_messages so open threads receive
-- INSERTs live (postgres_changes). RLS still applies to realtime payloads,
-- so clients only ever receive non-internal messages on their own cases.

-- REPLICA IDENTITY FULL ensures UPDATE/DELETE payloads carry full row data.
ALTER TABLE public.case_messages REPLICA IDENTITY FULL;

-- Add to the realtime publication if not already a member (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'case_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_messages;
  END IF;
END $$;
