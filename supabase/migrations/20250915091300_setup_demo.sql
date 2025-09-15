-- Étape 1 : Activer RLS sur user_video_stats (si ce n'est pas déjà fait)
ALTER TABLE user_video_stats ENABLE ROW LEVEL SECURITY;

-- Étape 2 : Supprimer les politiques RLS existantes pour user_video_stats
DROP POLICY IF EXISTS "Authenticated users can select their stats" ON user_video_stats;
DROP POLICY IF EXISTS "Authenticated users can update their stats" ON user_video_stats;
DROP POLICY IF EXISTS "Authenticated users can insert their stats" ON user_video_stats;

-- Étape 3 : Créer les politiques RLS pour user_video_stats
CREATE POLICY "Authenticated users can select their stats"
ON user_video_stats
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can update their stats"
ON user_video_stats
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert their stats"
ON user_video_stats
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Étape 4 : Vérifier la structure des tables videos et transcriptions
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS duration NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS views BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS status TEXT;

CREATE TABLE IF NOT EXISTS transcriptions (
  video_id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  full_text TEXT,
  transcription_text TEXT,
  transcription_data JSONB,
  segments JSONB,
  confidence_score NUMERIC,
  status TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Étape 5 : Supprimer les politiques existantes pour videos et transcriptions
DROP POLICY IF EXISTS "Authenticated users can select their videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users can update their videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users can insert their videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users can delete their videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users can manage their transcriptions" ON transcriptions;

-- Étape 6 : Activer RLS sur videos et transcriptions
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Étape 7 : Créer les politiques RLS pour videos et transcriptions
CREATE POLICY "Authenticated users can select their videos"
ON videos
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can update their videos"
ON videos
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert their videos"
ON videos
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authenticated users can delete their videos"
ON videos
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can manage their transcriptions"
ON transcriptions
FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Étape 8 : Vérifier la fonction get_user_video_stats
DROP FUNCTION IF EXISTS get_user_video_stats(uuid);

CREATE OR REPLACE FUNCTION get_user_video_stats(_user_id uuid)
RETURNS TABLE (
  total_videos bigint,
  total_duration numeric,
  last_upload timestamp,
  total_views bigint,
  total_likes bigint,
  transcribed_videos bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) AS total_videos,
    COALESCE(SUM(duration), 0) AS total_duration,
    MAX(created_at) AS last_upload,
    COALESCE(SUM(views), 0) AS total_views,
    COALESCE(SUM(likes_count), 0) AS total_likes,
    COUNT(*) FILTER (WHERE status = 'transcribed') AS transcribed_videos
  FROM videos
  WHERE user_id = _user_id;
END;
$$ LANGUAGE plpgsql;

-- Permissions pour la fonction
GRANT EXECUTE ON FUNCTION get_user_video_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_video_stats(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_user_video_stats(uuid) TO service_role;
