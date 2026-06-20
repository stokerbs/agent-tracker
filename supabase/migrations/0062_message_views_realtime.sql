-- 0062_message_views_realtime.sql
-- Enable Realtime for case_message_views so the global unread badge updates
-- live when the current user reads a thread (last_seen_at insert/update),
-- not just when new messages arrive.

ALTER TABLE public.case_message_views REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'case_message_views'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_message_views;
  END IF;
END $$;
