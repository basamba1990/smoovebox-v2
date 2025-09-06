-- Migration consolidée pour SpotBulle - 2025-09-06

-- Suppression des triggers et fonctions obsolètes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users CASCADE;
DROP TRIGGER IF EXISTS normalize_video_status_trigger ON public.videos CASCADE;
DROP TRIGGER IF EXISTS trigger_invalidate_stats ON public.videos CASCADE;
DROP TRIGGER IF EXISTS sync_video_transcription_trigger ON public.videos CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_update() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_delete() CASCADE;
DROP FUNCTION IF EXISTS public.normalize_video_status() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_video_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment(BIGINT, TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_user_stats() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_global_stats() CASCADE;
DROP FUNCTION IF EXISTS public.invalidate_stats_cache() CASCADE;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Schéma privé
CREATE SCHEMA IF NOT EXISTS private;

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    email TEXT,
    skills JSONB,
    location TEXT,
    linkedin_url TEXT,
    github_url TEXT,
    is_creator BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: videos
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER,
    tags TEXT[],
    category TEXT,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded','transcribing','transcribed','analyzing','analyzed','published','draft','failed','PENDING','PROCESSING','COMPLETED','FAILED')),
    views INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    performance_score REAL,
    analysis JSONB,
    transcription JSONB,
    transcription_data JSONB,
    storage_path TEXT,
    original_file_name TEXT,
    http_extension_available BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: transcriptions
CREATE TABLE IF NOT EXISTS public.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'fr',
    transcription_text TEXT NOT NULL,
    segments JSONB,
    transcription_data JSONB,
    confidence_score REAL,
    duration REAL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Harmonisation JSONB : transcription_data et segments pour transcriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='transcriptions' AND column_name='transcription_data'
    ) THEN
        ALTER TABLE public.transcriptions ADD COLUMN transcription_data JSONB;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='transcriptions' AND column_name='segments'
    ) THEN
        ALTER TABLE public.transcriptions ALTER COLUMN segments TYPE JSONB USING segments::jsonb;
    END IF;

    -- Harmonisation JSONB pour videos
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='videos' AND column_name='transcription_data'
    ) THEN
        ALTER TABLE public.videos ADD COLUMN transcription_data JSONB;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='videos' AND column_name='analysis'
    ) THEN
        -- Pour éviter conflit avec la vue, on ne change pas le type si une vue dépend
        -- ALTER TABLE public.videos ALTER COLUMN analysis TYPE JSONB USING analysis::jsonb;
    END IF;
END $$;

-- Autres tables (ai_suggestions, quizzes, quiz_results, followers, comments, likes, user_activities, creative_challenges, challenge_submissions, challenge_progress)
-- [Le reste des tables est identique à ta version précédente]

-- Suppression des vues existantes pour éviter conflits
DROP VIEW IF EXISTS public.video_details;
DROP MATERIALIZED VIEW IF EXISTS public.user_video_stats;
DROP MATERIALIZED VIEW IF EXISTS public.global_stats;

-- Vues et vues matérialisées
CREATE VIEW public.video_details AS
SELECT
    v.id AS video_id,
    v.title,
    v.description,
    v.file_path,
    v.thumbnail_url,
    v.duration,
    v.tags,
    v.category,
    v.status,
    v.views,
    v.likes_count,
    v.comments_count,
    v.performance_score,
    v.analysis,
    v.transcription,
    v.transcription_data,
    v.storage_path,
    v.original_file_name,
    v.http_extension_available,
    v.created_at,
    v.updated_at,
    p.username AS uploader_username,
    p.full_name AS uploader_full_name
FROM public.videos v
JOIN public.profiles p ON v.profile_id = p.id;

CREATE MATERIALIZED VIEW public.user_video_stats AS
SELECT
    p.id AS profile_id,
    p.username,
    COUNT(v.id) AS total_videos,
    SUM(v.views) AS total_views,
    SUM(v.likes_count) AS total_likes,
    SUM(v.comments_count) AS total_comments,
    COALESCE(SUM(v.duration),0) AS total_duration_seconds
FROM public.profiles p
LEFT JOIN public.videos v ON p.id = v.profile_id
GROUP BY p.id,p.username;

CREATE MATERIALIZED VIEW public.global_stats AS
SELECT
    COUNT(id) AS total_videos,
    SUM(views) AS total_views,
    SUM(likes_count) AS total_likes,
    SUM(comments_count) AS total_comments,
    COALESCE(SUM(duration),0) AS total_duration_seconds
FROM public.videos;

-- Triggers et fonctions utilisateurs
-- [Identiques à la version précédente]

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

-- Suppression sécurisée et recréation des policies
DO $$
BEGIN
    -- DROP et CREATE pour chaque policy
    EXECUTE 'DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles';
    EXECUTE 'CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE)';

    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles';
    EXECUTE 'CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Public videos are viewable by everyone" ON public.videos';
    EXECUTE 'CREATE POLICY "Public videos are viewable by everyone" ON public.videos FOR SELECT USING (status=''published'')';

    EXECUTE 'DROP POLICY IF EXISTS "User full access to own videos" ON public.videos';
    EXECUTE 'CREATE POLICY "User full access to own videos" ON public.videos USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Transcription access by video owner" ON public.transcriptions';
    EXECUTE 'CREATE POLICY "Transcription access by video owner" ON public.transcriptions FOR SELECT USING (auth.uid()=user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "AI suggestions access by owner" ON public.ai_suggestions';
    EXECUTE 'CREATE POLICY "AI suggestions access by owner" ON public.ai_suggestions FOR SELECT USING (EXISTS(SELECT 1 FROM public.transcriptions WHERE id=transcription_id AND user_id=auth.uid()))';

    EXECUTE 'DROP POLICY IF EXISTS "Public quizzes are viewable" ON public.quizzes';
    EXECUTE 'CREATE POLICY "Public quizzes are viewable" ON public.quizzes FOR SELECT USING (TRUE)';

    EXECUTE 'DROP POLICY IF EXISTS "User access to own quiz results" ON public.quiz_results';
    EXECUTE 'CREATE POLICY "User access to own quiz results" ON public.quiz_results FOR SELECT USING (auth.uid()=(SELECT user_id FROM public.profiles WHERE id=profile_id))';

    EXECUTE 'DROP POLICY IF EXISTS "Users can manage own follows" ON public.followers';
    EXECUTE 'CREATE POLICY "Users can manage own follows" ON public.followers USING (auth.uid()=follower_id) WITH CHECK (auth.uid()=follower_id)';

    EXECUTE 'DROP POLICY IF EXISTS "User manage own comments" ON public.comments';
    EXECUTE 'CREATE POLICY "User manage own comments" ON public.comments USING (auth.uid()=profile_id) WITH CHECK (auth.uid()=profile_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Public comments on published videos" ON public.comments';
    EXECUTE 'CREATE POLICY "Public comments on published videos" ON public.comments FOR SELECT USING (EXISTS(SELECT 1 FROM public.videos WHERE id=video_id AND status=''published''))';

    EXECUTE 'DROP POLICY IF EXISTS "User manage own likes" ON public.likes';
    EXECUTE 'CREATE POLICY "User manage own likes" ON public.likes USING (auth.uid()=profile_id) WITH CHECK (auth.uid()=profile_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own activities" ON public.user_activities';
    EXECUTE 'CREATE POLICY "Users can view their own activities" ON public.user_activities FOR SELECT USING (auth.uid()=user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "System can insert activities" ON public.user_activities';
    EXECUTE 'CREATE POLICY "System can insert activities" ON public.user_activities FOR INSERT WITH CHECK (TRUE)';

    EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own submissions" ON public.challenge_submissions';
    EXECUTE 'CREATE POLICY "Users can manage their own submissions" ON public.challenge_submissions USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id)';

    EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own progress" ON public.challenge_progress';
    EXECUTE 'CREATE POLICY "Users can manage their own progress" ON public.challenge_progress USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id)';
END $$;

-- Rafraîchir les vues matérialisées après migration
REFRESH MATERIALIZED VIEW public.user_video_stats;
REFRESH MATERIALIZED VIEW public.global_stats;
