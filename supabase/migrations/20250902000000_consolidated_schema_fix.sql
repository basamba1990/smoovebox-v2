-- Migration consolidée pour SpotBulle - 2025-09-06

-- Supprimer triggers et fonctions obsolètes
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

-- Harmonisation colonnes JSONB pour transcriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transcriptions' AND column_name = 'transcription_data'
    ) THEN
        ALTER TABLE public.transcriptions ADD COLUMN transcription_data JSONB;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transcriptions' AND column_name = 'segments'
    ) THEN
        ALTER TABLE public.transcriptions ALTER COLUMN segments TYPE JSONB USING segments::jsonb;
    END IF;
END $$;

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

-- Table: ai_suggestions
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE CASCADE,
    suggestion_type TEXT CHECK (suggestion_type IN ('pitch','improvement','structure','keyword')),
    title TEXT,
    description TEXT,
    confidence_score REAL,
    priority TEXT CHECK (priority IN ('high','medium','low')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    quiz_type TEXT CHECK (quiz_type IN ('personality','skills','technical')),
    difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
    questions JSONB,
    max_score INTEGER,
    time_limit_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: quiz_results
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score REAL NOT NULL,
    details JSONB,
    percentile REAL,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: followers
CREATE TABLE IF NOT EXISTS public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    followed_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);

-- Table: comments
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.comments(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: likes
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, profile_id)
);

-- Table: user_activities
CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: creative_challenges
CREATE TABLE IF NOT EXISTS public.creative_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('easy','medium','hard')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: challenge_submissions
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('pending','approved','rejected')),
    score INTEGER,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: challenge_progress
CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    progress_details JSONB,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supprimer vues existantes pour éviter conflits
DROP VIEW IF EXISTS public.video_details;
DROP MATERIALIZED VIEW IF EXISTS public.user_video_stats;
DROP MATERIALIZED VIEW IF EXISTS public.global_stats;

-- Vues
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

-- Vues matérialisées
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
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles(id,user_id,username,email)
    VALUES (gen_random_uuid(),NEW.id,NEW.email,NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET username=NEW.email,email=NEW.email,updated_at=NOW()
    WHERE user_id=NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.handle_user_update();

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.profiles WHERE user_id=OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- Rafraîchissement des vues matérialisées
CREATE OR REPLACE FUNCTION public.refresh_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.user_video_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_global_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.global_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_user_video_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.videos
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_user_stats();

CREATE TRIGGER refresh_global_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.videos
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_global_stats();

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

-- Suppression sécurisée des policies existantes
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles';
    EXECUTE 'DROP POLICY IF EXISTS "Public videos are viewable by everyone" ON public.videos';
    EXECUTE 'DROP POLICY IF EXISTS "User full access to own videos" ON public.videos';
    EXECUTE 'DROP POLICY IF EXISTS "Transcription access by video owner" ON public.transcriptions';
    EXECUTE 'DROP POLICY IF EXISTS "AI suggestions access by owner" ON public.ai_suggestions';
    EXECUTE 'DROP POLICY IF EXISTS "Public quizzes are viewable" ON public.quizzes';
    EXECUTE 'DROP POLICY IF EXISTS "User access to own quiz results" ON public.quiz_results';
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage own follows" ON public.followers';
    EXECUTE 'DROP POLICY IF EXISTS "User manage own comments" ON public.comments';
    EXECUTE 'DROP POLICY IF EXISTS "Public comments on published videos" ON public.comments';
    EXECUTE 'DROP POLICY IF EXISTS "User manage own likes" ON public.likes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own activities" ON public.user_activities';
    EXECUTE 'DROP POLICY IF EXISTS "System can insert activities" ON public.user_activities';
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own submissions" ON public.challenge_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own progress" ON public.challenge_progress';
END $$;

-- Recréation des policies RLS correctement
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public videos are viewable by everyone" ON public.videos FOR SELECT USING (status='published');
CREATE POLICY "User full access to own videos" ON public.videos USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE POLICY "Transcription access by video owner" ON public.transcriptions FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "AI suggestions access by owner" ON public.ai_suggestions FOR SELECT USING (EXISTS(SELECT 1 FROM public.transcriptions WHERE id=transcription_id AND user_id=auth.uid()));

CREATE POLICY "Public quizzes are viewable" ON public.quizzes FOR SELECT USING (TRUE);
CREATE POLICY "User access to own quiz results" ON public.quiz_results FOR SELECT USING (auth.uid()=(SELECT user_id FROM public.profiles WHERE id=profile_id));

CREATE POLICY "Users can manage own follows" ON public.followers USING (auth.uid()=follower_id) WITH CHECK (auth.uid()=follower_id);

CREATE POLICY "User manage own comments" ON public.comments USING (auth.uid()=profile_id) WITH CHECK (auth.uid()=profile_id);
CREATE POLICY "Public comments on published videos" ON public.comments FOR SELECT USING (EXISTS(SELECT 1 FROM public.videos WHERE id=video_id AND status='published'));

CREATE POLICY "User manage own likes" ON public.likes USING (auth.uid()=profile_id) WITH CHECK (auth.uid()=profile_id);

CREATE POLICY "Users can view their own activities" ON public.user_activities FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "System can insert activities" ON public.user_activities FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can manage their own submissions" ON public.challenge_submissions USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users can manage their own progress" ON public.challenge_progress USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- Rafraîchir les vues matérialisées après migration
REFRESH MATERIALIZED VIEW public.user_video_stats;
REFRESH MATERIALIZED VIEW public.global_stats;
