-- Migration consolidée pour corriger et harmoniser le schéma de la base de données Smoovebox
-- Date: 2025-09-02

-- Suppression des fonctions et triggers obsolètes ou dupliqués pour éviter les conflits
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP TRIGGER IF EXISTS normalize_video_status_trigger ON public.videos;
DROP TRIGGER IF EXISTS trigger_invalidate_stats ON public.videos;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_update();
DROP FUNCTION IF EXISTS public.handle_user_delete();
DROP FUNCTION IF EXISTS public.normalize_video_status();
DROP FUNCTION IF EXISTS public.get_user_video_stats(UUID);
DROP FUNCTION IF EXISTS public.increment(BIGINT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.refresh_user_stats();
DROP FUNCTION IF EXISTS public.refresh_global_stats();
DROP FUNCTION IF EXISTS public.invalidate_stats_cache();

-- Suppression des politiques RLS obsolètes ou dupliquées
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own activities') THEN
        DROP POLICY "Users can view their own activities" ON public.user_activities;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can insert activities') THEN
        DROP POLICY "System can insert activities" ON public.user_activities;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profiles are viewable by everyone') THEN
        DROP POLICY "Profiles are viewable by everyone" ON public.profiles;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile') THEN
        DROP POLICY "Users can update their own profile" ON public.profiles;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public videos are viewable by everyone') THEN
        DROP POLICY "Public videos are viewable by everyone" ON public.videos;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User full access to own videos') THEN
        DROP POLICY "User full access to own videos" ON public.videos;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Transcription access by video owner') THEN
        DROP POLICY "Transcription access by video owner" ON public.transcriptions;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'AI suggestions access by owner') THEN
        DROP POLICY "AI suggestions access by owner" ON public.ai_suggestions;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User access to own quiz results') THEN
        DROP POLICY "User access to own quiz results" ON public.quiz_results;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own follows') THEN
        DROP POLICY "Users can manage own follows" ON public.followers;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User manage own comments') THEN
        DROP POLICY "User manage own comments" ON public.comments;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public comments on published videos') THEN
        DROP POLICY "Public comments on published videos" ON public.comments;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User manage own likes') THEN
        DROP POLICY "User manage own likes" ON public.likes;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public quizzes are viewable') THEN
        DROP POLICY "Public quizzes are viewable" ON public.quizzes;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_select_own_transcriptions') THEN
        DROP POLICY users_select_own_transcriptions ON public.transcriptions;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own submissions') THEN
        DROP POLICY "Users can manage their own submissions" ON public.challenge_submissions;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own progress') THEN
        DROP POLICY "Users can manage their own progress" ON public.challenge_progress;
    END IF;
END $$;

-- Suppression des tables pour recréation propre (à utiliser avec prudence en production)
-- DROP TABLE IF EXISTS public.user_activities CASCADE;
-- DROP TABLE IF EXISTS public.transcriptions CASCADE;
-- DROP TABLE IF EXISTS public.ai_suggestions CASCADE;
-- DROP TABLE IF EXISTS public.likes CASCADE;
-- DROP TABLE IF EXISTS public.comments CASCADE;
-- DROP TABLE IF EXISTS public.followers CASCADE;
-- DROP TABLE IF EXISTS public.quiz_results CASCADE;
-- DROP TABLE IF EXISTS public.quizzes CASCADE;
-- DROP TABLE IF EXISTS public.videos CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.challenge_submissions CASCADE;
-- DROP TABLE IF EXISTS public.challenge_progress CASCADE;
-- DROP TABLE IF EXISTS public.creative_challenges CASCADE;

-- Re-création des extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Création du schéma privé (idempotent)
CREATE SCHEMA IF NOT EXISTS private;

-- Table: Profiles (Harmonisée)
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

-- Table: Videos (Harmonisée)
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Ajouté pour cohérence
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER, -- Harmonisé: utilise INTEGER, renommé de duration_seconds
    tags TEXT[],
    category TEXT,
    status TEXT DEFAULT 'uploaded' 
        CHECK (status IN ('uploaded', 'transcribing', 'transcribed', 'analyzing', 'analyzed', 'published', 'draft', 'failed', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    views INTEGER DEFAULT 0, -- Harmonisé: utilise 'views' au lieu de 'views_count'
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    performance_score REAL, -- Harmonisé: utilise 'performance_score' au lieu de 'ai_score'
    analysis JSONB, -- Harmonisé: type JSONB
    transcription JSONB, -- Harmonisé: type JSONB
    storage_path TEXT, -- Ajouté
    original_file_name TEXT, -- Ajouté
    http_extension_available BOOLEAN, -- Ajouté
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mise à jour des colonnes existantes pour la table videos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'duration_seconds') THEN
        ALTER TABLE public.videos RENAME COLUMN duration_seconds TO duration;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'views_count') THEN
        ALTER TABLE public.videos RENAME COLUMN views_count TO views;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'ai_score') THEN
        ALTER TABLE public.videos RENAME COLUMN ai_score TO performance_score;
    END IF;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS analysis JSONB;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS transcription JSONB;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS storage_path TEXT;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS original_file_name TEXT;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS http_extension_available BOOLEAN;

    -- Mettre à jour user_id pour les vidéos existantes
    UPDATE public.videos SET user_id = (SELECT user_id FROM public.profiles WHERE id = profile_id) WHERE user_id IS NULL AND profile_id IS NOT NULL;

    -- Mettre à jour performance_score à partir de analysis.performance.scores.global si ai_score n'existait pas
    UPDATE public.videos
    SET performance_score = (analysis->'performance'->'scores'->>'global')::REAL
    WHERE analysis IS NOT NULL
      AND analysis->'performance'->'scores'->>'global' IS NOT NULL
      AND performance_score IS NULL;

END $$;

-- Table: Transcriptions (Harmonisée)
CREATE TABLE IF NOT EXISTS public.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Harmonisé: type UUID
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Ajouté
    language TEXT NOT NULL DEFAULT 'fr',
    transcription_text TEXT NOT NULL, -- Harmonisé: utilise transcription_text, supprime full_text et transcript
    segments JSONB,
    confidence_score REAL, -- Harmonisé: type REAL
    duration REAL, -- Harmonisé: type REAL
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mise à jour des colonnes existantes pour la table transcriptions
DO $$
BEGIN
    -- Renommer full_text en transcription_text si full_text existe et transcription_text n'existe pas
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'full_text') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'transcription_text') THEN
        ALTER TABLE public.transcriptions RENAME COLUMN full_text TO transcription_text;
    END IF;
    -- Ajouter transcription_text si elle n'existe pas et copier depuis full_text
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'transcription_text') THEN
        ALTER TABLE public.transcriptions ADD COLUMN transcription_text TEXT;
        UPDATE public.transcriptions SET transcription_text = full_text WHERE full_text IS NOT NULL;
    END IF;
    -- Supprimer full_text si transcription_text existe et full_text est redondant
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'full_text') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'transcription_text') AND (SELECT count(*) FROM public.transcriptions WHERE full_text IS NOT NULL AND transcription_text IS NULL) = 0 THEN
        ALTER TABLE public.transcriptions DROP COLUMN full_text;
    END IF;

    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS confidence_score REAL;
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS duration REAL;
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Mettre à jour user_id pour les transcriptions existantes
    UPDATE public.transcriptions SET user_id = (SELECT v.user_id FROM public.videos v WHERE v.id = video_id) WHERE user_id IS NULL;

    -- Supprimer analysis_result si elle existe et n'est plus utilisée
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'analysis_result') THEN
        ALTER TABLE public.transcriptions DROP COLUMN analysis_result;
    END IF;

END $$;

-- Table: AI Suggestions (inchangée, mais assure la cohérence)
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE CASCADE,
    suggestion_type TEXT CHECK (suggestion_type IN ('pitch', 'improvement', 'structure', 'keyword')),
    title TEXT,
    description TEXT,
    confidence_score REAL,
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Quizzes (inchangée)
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    quiz_type TEXT CHECK (quiz_type IN ('personality', 'skills', 'technical')),
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    questions JSONB,
    max_score INTEGER,
    time_limit_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Quiz Results (inchangée)
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score REAL NOT NULL,
    details JSONB,
    percentile REAL,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Followers (inchangée)
CREATE TABLE IF NOT EXISTS public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    followed_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);

-- Table: Comments (inchangée)
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

-- Table: Likes (inchangée)
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, profile_id)
);

-- Table: user_activities (Création unique et harmonisée)
CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: creative_challenges (Ajout de la table manquante)
CREATE TABLE IF NOT EXISTS public.creative_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: challenge_submissions (inchangée)
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    submission_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: challenge_progress (inchangée)
CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    progress_data JSONB,
    status TEXT NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, challenge_id)
);

-- Index de performance (consolidés et optimisés)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_search ON public.profiles USING gin(to_tsvector('french', full_name));

CREATE INDEX IF NOT EXISTS idx_videos_profile_id ON public.videos(profile_id);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON public.videos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_videos_category ON public.videos(category);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_user_created ON public.videos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_engagement ON public.videos (engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_videos_duration ON public.videos (duration);
CREATE INDEX IF NOT EXISTS idx_videos_views ON public.videos (views DESC);

CREATE INDEX IF NOT EXISTS idx_transcriptions_video_id ON public.transcriptions(video_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON public.transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_confidence ON public.transcriptions(confidence_score);
CREATE INDEX IF NOT EXISTS idx_transcriptions_duration ON public.transcriptions(duration);
CREATE INDEX IF NOT EXISTS idx_transcriptions_content_search ON public.transcriptions USING gin(to_tsvector('french', transcription_text));

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_transcription_id ON public.ai_suggestions(transcription_id);

CREATE INDEX IF NOT EXISTS idx_quiz_results_profile_id ON public.quiz_results(profile_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_followed_id ON public.followers(followed_id);

CREATE INDEX IF NOT EXISTS idx_comments_video_id ON public.comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON public.comments(profile_id);

CREATE INDEX IF NOT EXISTS idx_likes_video_id ON public.likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_profile_id ON public.likes(profile_id);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON public.user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_type ON public.user_activities (user_id, activity_type);

CREATE INDEX IF NOT EXISTS idx_challenges_active ON public.creative_challenges (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_difficulty ON public.creative_challenges (difficulty_level);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user_challenge ON public.challenge_submissions (user_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_progress_user_challenge ON public.challenge_progress (user_id, challenge_id);

-- Fonctions et Triggers (consolidés et mis à jour)

-- Function: Update modified timestamp
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers with conditional creation
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_modtime') THEN
        CREATE TRIGGER update_profiles_modtime
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_videos_modtime') THEN
        CREATE TRIGGER update_videos_modtime
        BEFORE UPDATE ON public.videos
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_comments_modtime') THEN
        CREATE TRIGGER update_comments_modtime
        BEFORE UPDATE ON public.comments
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_transcriptions_modtime') THEN
        CREATE TRIGGER update_transcriptions_modtime
        BEFORE UPDATE ON public.transcriptions
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_challenge_submissions_modtime') THEN
        CREATE TRIGGER update_challenge_submissions_modtime
        BEFORE UPDATE ON public.challenge_submissions
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_challenge_progress_modtime') THEN
        CREATE TRIGGER update_challenge_progress_modtime
        BEFORE UPDATE ON public.challenge_progress
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_creative_challenges_modtime') THEN
        CREATE TRIGGER update_creative_challenges_modtime
        BEFORE UPDATE ON public.creative_challenges
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
END $$;

-- Fonction handle_new_user (version la plus récente et complète)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    username_base TEXT;
    username_suffix INT := 1;
    new_username TEXT;
    profile_id UUID;
BEGIN
    -- Générer un nom d'utilisateur unique
    username_base := LOWER(SPLIT_PART(NEW.email, '@', 1));
    new_username := username_base;
    
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
        new_username := username_base || username_suffix;
        username_suffix := username_suffix + 1;
    END LOOP;
    
    -- Créer le profil utilisateur avec toutes les informations nécessaires
    INSERT INTO public.profiles (
        user_id, 
        email, 
        username, 
        full_name,
        avatar_url
    )
    VALUES (
        NEW.id, 
        NEW.email,
        new_username,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            CONCAT(
                NEW.raw_user_meta_data->>'first_name', 
                ' ', 
                NEW.raw_user_meta_data->>'last_name'
            )
        ),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    RETURNING id INTO profile_id;
    
    -- Log de l'activité
    INSERT INTO public.user_activities (user_id, activity_type, details)
    VALUES (NEW.id, 'signup', jsonb_build_object(
        'email', NEW.email,
        'registration_method', COALESCE(NEW.raw_app_meta_data->>'provider','email')
    ));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour la création d'utilisateur
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fonction handle_user_update
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.email IS DISTINCT FROM NEW.email
       OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data THEN

        UPDATE public.profiles
        SET
            email = NEW.email,
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            avatar_url = NEW.raw_user_meta_data->>'avatar_url',
            updated_at = NOW()
        WHERE user_id = NEW.id;

        INSERT INTO public.user_activities (
            user_id, activity_type, details
        ) VALUES (
            NEW.id,
            'profile_updated',
            jsonb_build_object(
                'old_email', OLD.email,
                'new_email', NEW.email,
                'updated_fields', CASE
                    WHEN OLD.email IS DISTINCT FROM NEW.email THEN 'email'
                    ELSE 'metadata'
                END
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour la mise à jour d'utilisateur
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- Fonction handle_user_delete
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.user_activities WHERE user_id = OLD.id;
    DELETE FROM public.transcriptions WHERE user_id = OLD.id; -- Supprime les transcriptions de l'utilisateur
    DELETE FROM public.videos WHERE user_id = OLD.id;
    DELETE FROM public.profiles WHERE user_id = OLD.id;
    DELETE FROM public.challenge_submissions WHERE user_id = OLD.id;
    DELETE FROM public.challenge_progress WHERE user_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour la suppression d'utilisateur
CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- Fonction get_user_video_stats (version optimisée)
CREATE OR REPLACE FUNCTION public.get_user_video_stats(user_id_param UUID)
RETURNS TABLE (
    total_videos INTEGER,
    total_views INTEGER,
    avg_engagement DECIMAL,
    total_duration INTEGER,
    videos_by_status JSONB,
    performance_data JSONB,
    progress_stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH video_stats AS (
        SELECT
            COUNT(*)::INTEGER AS video_count,
            COALESCE(SUM(v.views),0)::INTEGER AS total_view_count,
            COALESCE(AVG(v.engagement_score),0)::DECIMAL AS avg_engagement_score,
            COALESCE(SUM(v.duration),0)::INTEGER AS total_duration_seconds, -- Utilise 'duration'
            jsonb_object_agg(COALESCE(v.status,'unknown'), COUNT(*)) AS status_distribution
        FROM public.videos v
        WHERE v.user_id = user_id_param
    ),
    performance_data AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', DATE(v.created_at),
                'videos', COUNT(*),
                'avg_engagement', COALESCE(AVG(v.engagement_score),0),
                'total_views', COALESCE(SUM(v.views),0)
            ) ORDER BY DATE(v.created_at)
        ) AS perf_data
        FROM public.videos v
        WHERE v.user_id = user_id_param
          AND v.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(v.created_at)
    ),
    progress_data AS (
        SELECT jsonb_build_object(
            'completed', COUNT(*) FILTER (WHERE v.status IN ('COMPLETED','published')),
            'inProgress', COUNT(*) FILTER (WHERE v.status IN ('PROCESSING','transcribing','analyzing')),
            'totalTime', COALESCE(SUM(v.duration),0) -- Utilise 'duration'
        ) AS prog_data
        FROM public.videos v
        WHERE v.user_id = user_id_param
    )
    SELECT
        vs.video_count,
        vs.total_view_count,
        vs.avg_engagement_score,
        vs.total_duration_seconds,
        vs.status_distribution,
        pd.perf_data,
        pr.prog_data
    FROM video_stats vs
    CROSS JOIN performance_data pd
    CROSS JOIN progress_data pr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_video_stats(UUID) TO authenticated;

-- Vues Matérialisées (consolidées)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_video_stats AS
SELECT 
    v.user_id,
    COUNT(*) as total_videos,
    COUNT(*) FILTER (WHERE v.status = 'COMPLETED') as completed_videos,
    COUNT(*) FILTER (WHERE v.status = 'PROCESSING') as processing_videos,
    COUNT(*) FILTER (WHERE v.status = 'FAILED') as failed_videos,
    COALESCE(SUM(v.views), 0) as total_views,
    COALESCE(AVG(v.engagement_score), 0) as avg_engagement,
    COALESCE(SUM(v.duration), 0) as total_duration,
    MAX(v.created_at) as last_upload,
    COUNT(*) FILTER (WHERE v.created_at >= NOW() - INTERVAL '7 days') as videos_last_week,
    COUNT(*) FILTER (WHERE v.created_at >= NOW() - INTERVAL '30 days') as videos_last_month
FROM public.videos v
GROUP BY v.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_video_stats_user_id 
    ON public.user_video_stats (user_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.global_stats AS
SELECT 
    COUNT(*) as total_videos,
    COUNT(DISTINCT user_id) as total_users,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_videos,
    COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing_videos,
    COALESCE(SUM(views), 0) as total_views,
    COALESCE(AVG(performance_score), 0) as avg_performance_score, -- Utilise performance_score
    COALESCE(SUM(duration), 0) as total_duration,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as videos_last_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as videos_last_week
FROM public.videos;

-- Fonctions pour rafraîchir les vues matérialisées
CREATE OR REPLACE FUNCTION public.refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_video_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_global_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.global_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour invalider le cache des stats
CREATE OR REPLACE FUNCTION public.invalidate_stats_cache()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('stats_invalidated', 'user_video_stats');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.videos
    FOR EACH ROW EXECUTE FUNCTION public.invalidate_stats_cache();

-- Row Level Security Policies (consolidées et mises à jour)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.creative_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.challenge_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Profiles
    CREATE POLICY IF NOT EXISTS "Profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);
    
    CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);
    
    -- Videos
    CREATE POLICY IF NOT EXISTS "Public videos are viewable by everyone" ON public.videos
    FOR SELECT USING (status = 'published' OR status = 'COMPLETED');
    
    CREATE POLICY IF NOT EXISTS "User full access to own videos" ON public.videos
    FOR ALL USING (
        auth.uid() = user_id
    );
    
    -- Transcriptions
    CREATE POLICY IF NOT EXISTS "Transcription access by video owner" ON public.transcriptions
    FOR ALL USING (
        auth.uid() = user_id
    );
    
    -- AI Suggestions
    CREATE POLICY IF NOT EXISTS "AI suggestions access by owner" ON public.ai_suggestions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.transcriptions t
            WHERE t.id = transcription_id
            AND auth.uid() = t.user_id
        )
    );
    
    -- Quiz Results
    CREATE POLICY IF NOT EXISTS "User access to own quiz results" ON public.quiz_results
    FOR ALL USING (
        auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id)
    );
    
    -- Followers
    CREATE POLICY IF NOT EXISTS "Users can manage own follows" ON public.followers
    FOR ALL USING (
        auth.uid() = (SELECT user_id FROM public.profiles WHERE id = follower_id)
    );
    
    -- Comments
    CREATE POLICY IF NOT EXISTS "User manage own comments" ON public.comments
    FOR ALL USING (
        auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id)
    );
    
    CREATE POLICY IF NOT EXISTS "Public comments on published videos" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.videos
            WHERE id = video_id AND (status = 'published' OR status = 'COMPLETED')
        )
    );
    
    -- Likes
    CREATE POLICY IF NOT EXISTS "User manage own likes" ON public.likes
    FOR ALL USING (
        auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id)
    );
    
    -- Quizzes (public read access)
    CREATE POLICY IF NOT EXISTS "Public quizzes are viewable" ON public.quizzes
    FOR SELECT USING (true);

    -- User Activities
    CREATE POLICY IF NOT EXISTS "Users can view their own activities" 
    ON public.user_activities FOR SELECT 
    USING (auth.uid() = user_id);

    CREATE POLICY IF NOT EXISTS "System can insert activities" 
    ON public.user_activities FOR INSERT 
    WITH CHECK (true);

    -- Creative Challenges
    CREATE POLICY IF NOT EXISTS "Creative challenges are viewable by everyone" ON public.creative_challenges
    FOR SELECT USING (true);

    -- Challenge Submissions
    CREATE POLICY IF NOT EXISTS "Users can manage their own submissions"
    ON public.challenge_submissions 
    FOR ALL 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

    -- Challenge Progress
    CREATE POLICY IF NOT EXISTS "Users can manage their own progress"
    ON public.challenge_progress 
    FOR ALL 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

END $$;

-- Permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Analyse pour optimiser les performances
ANALYZE public.videos;
ANALYZE public.profiles;
ANALYZE public.transcriptions;
ANALYZE public.user_activities;
ANALYZE public.ai_suggestions;
ANALYZE public.quizzes;
ANALYZE public.quiz_results;
ANALYZE public.followers;
ANALYZE public.comments;
ANALYZE public.likes;
ANALYZE public.creative_challenges;
ANALYZE public.challenge_submissions;
ANALYZE public.challenge_progress;


