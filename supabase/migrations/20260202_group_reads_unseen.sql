-- Unseen group messages: track when each user last "read" each group chat.
-- Used to show unread counts and mark as read when opening or viewing a group.

CREATE TABLE IF NOT EXISTS public.group_reads (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_reads_user_id
  ON public.group_reads(user_id);

ALTER TABLE public.group_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_reads_select_own" ON public.group_reads;
CREATE POLICY "group_reads_select_own" ON public.group_reads
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_reads_insert_own" ON public.group_reads;
CREATE POLICY "group_reads_insert_own" ON public.group_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_reads_update_own" ON public.group_reads;
CREATE POLICY "group_reads_update_own" ON public.group_reads
  FOR UPDATE USING (auth.uid() = user_id);

-- Returns (group_id, unread_count) for groups the user is a member of.
-- Unread = messages from others after last_read_at.
CREATE OR REPLACE FUNCTION public.get_group_unread_counts(p_user_id uuid)
RETURNS TABLE(group_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.group_id,
    COUNT(*)::bigint
  FROM group_messages m
  JOIN group_members gm ON gm.group_id = m.group_id AND gm.user_id = p_user_id
  LEFT JOIN group_reads r ON r.group_id = m.group_id AND r.user_id = p_user_id
  WHERE m.sender_id IS DISTINCT FROM p_user_id
    AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    AND p_user_id = auth.uid()
  GROUP BY m.group_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_unread_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_unread_counts(uuid) TO service_role;

COMMENT ON TABLE public.group_reads IS 'Tracks when each user last read each group chat for unread badges.';
COMMENT ON FUNCTION public.get_group_unread_counts(uuid) IS 'Returns group_id and unread_count for the given user (messages from others after last_read_at).';
