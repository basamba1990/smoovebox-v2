-- Unseen messages: track when each user last "read" each direct-message thread.
-- Used to show unread counts and mark as read when opening a conversation.

-- Table: last time the user read each thread (only participants)
CREATE TABLE IF NOT EXISTS public.direct_thread_reads (
  thread_id uuid NOT NULL REFERENCES public.direct_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_thread_reads_user_id
  ON public.direct_thread_reads(user_id);

ALTER TABLE public.direct_thread_reads ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own read state
DROP POLICY IF EXISTS "direct_thread_reads_select_own" ON public.direct_thread_reads;
CREATE POLICY "direct_thread_reads_select_own" ON public.direct_thread_reads
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "direct_thread_reads_insert_own" ON public.direct_thread_reads;
CREATE POLICY "direct_thread_reads_insert_own" ON public.direct_thread_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "direct_thread_reads_update_own" ON public.direct_thread_reads;
CREATE POLICY "direct_thread_reads_update_own" ON public.direct_thread_reads
  FOR UPDATE USING (auth.uid() = user_id);

-- Returns (thread_id, unread_count) for the current user's threads only.
-- Unread = messages from the other person after last_read_at.
CREATE OR REPLACE FUNCTION public.get_direct_thread_unread_counts(p_user_id uuid)
RETURNS TABLE(thread_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.thread_id,
    COUNT(*)::bigint
  FROM direct_messages m
  JOIN direct_threads t ON t.id = m.thread_id
  LEFT JOIN direct_thread_reads r
    ON r.thread_id = m.thread_id AND r.user_id = p_user_id
  WHERE (t.user_id_1 = p_user_id OR t.user_id_2 = p_user_id)
    AND m.sender_id IS DISTINCT FROM p_user_id
    AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    AND p_user_id = auth.uid()  -- only own counts
  GROUP BY m.thread_id;
$$;

-- Allow authenticated users to call the function (they only get their own counts via p_user_id check in app)
GRANT EXECUTE ON FUNCTION public.get_direct_thread_unread_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_direct_thread_unread_counts(uuid) TO service_role;

COMMENT ON TABLE public.direct_thread_reads IS 'Tracks when each user last read each DM thread for unread badges.';
COMMENT ON FUNCTION public.get_direct_thread_unread_counts(uuid) IS 'Returns thread_id and unread_count for the given user (messages from others after last_read_at).';
