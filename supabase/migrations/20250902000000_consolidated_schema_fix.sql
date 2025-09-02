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

-- Début des modifications pour gérer les dépendances des vues matérialisées et des vues simples

-- Suppression des vues dépendantes (matérialisées et simples)
DROP MATERIALIZED VIEW IF EXISTS public.user_video_stats;
DROP MATERIALIZED VIEW IF EXISTS public.global_stats;
DROP VIEW IF EXISTS public.video_details; -- Ajouté pour gérer la nouvelle dépendance

-- Mise à jour des colonnes existantes pour la table videos
DO $$
BEGIN
    -- Gestion de la colonne duration - correction du conflit
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'duration_seconds') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'duration') THEN
            -- Les deux colonnes existent, on migre les données et supprime l'ancienne
            UPDATE public.videos 
            SET duration = duration_seconds 
            WHERE duration IS NULL AND duration_seconds IS NOT NULL;
            
            ALTER TABLE public.videos DROP COLUMN duration_seconds;
        ELSE
            -- Seule duration_seconds existe, on la renomme
            ALTER TABLE public.videos RENAME COLUMN duration_seconds TO duration;
        END IF;
    END IF;

    -- Gestion de la colonne views - correction du conflit
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'views_count') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'views') THEN
            ALTER TABLE public.videos RENAME COLUMN views_count TO views;
        ELSE
            -- Si 'views' existe déjà, et 'views_count' aussi, on supprime 'views_count' car 'views' est la colonne désirée.
            ALTER TABLE public.videos DROP COLUMN views_count;
        END IF;
    END IF;
    
    -- Gestion de la colonne performance_score - correction du conflit
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'ai_score') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'performance_score') THEN
            ALTER TABLE public.videos RENAME COLUMN ai_score TO performance_score;
        ELSE
            -- Si 'performance_score' existe déjà, et 'ai_score' aussi, on supprime 'ai_score' car 'performance_score' est la colonne désirée.
            ALTER TABLE public.videos DROP COLUMN ai_score;
        END IF;
    END IF;
    
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS analysis JSONB;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS transcription JSONB;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS storage_path TEXT;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS original_file_name TEXT;
    ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS http_extension_available BOOLEAN;

    -- Mettre à jour user_id pour les vidéos existantes 
    UPDATE public.videos 
    SET user_id = (SELECT user_id FROM public.profiles WHERE id = profile_id) 
    WHERE user_id IS NULL AND profile_id IS NOT NULL;
    
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
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'full_text') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'transcription_text') THEN
        ALTER TABLE public.transcriptions RENAME COLUMN full_text TO transcription_text;
    END IF;
    
    -- Ajouter transcription_text si elle n'existe pas et copier depuis full_text
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'transcription_text') THEN
        ALTER TABLE public.transcriptions ADD COLUMN transcription_text TEXT;
        UPDATE public.transcriptions SET transcription_text = full_text WHERE full_text IS NOT NULL;
    END IF;
    
    -- Supprimer full_text si transcription_text existe et full_text est redondant
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'full_text') 
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transcriptions' AND column_name = 'transcription_text') 
    AND (SELECT count(*) FROM public.transcriptions WHERE full_text IS NOT NULL AND transcription_text IS NULL) = 0 THEN
        ALTER TABLE public.transcriptions DROP COLUMN full_text;
    END IF;

    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; 
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr'; 
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS confidence_score REAL; 
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS duration REAL; 
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(); 
    ALTER TABLE public.transcriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(); 
    
    -- Mettre à jour user_id pour les transcriptions existantes 
    UPDATE public.transcriptions 
    SET user_id = (SELECT v.user_id FROM public.videos v WHERE v.id = video_id) 
    WHERE user_id IS NULL;
    
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
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    submission_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')),
    score INTEGER,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: challenge_progress (inchangée)
CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    progress_details JSONB,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vues matérialisées et vues simples pour les statistiques (à recréer après les modifications de schéma)

-- Vue simple: video_details (recréée après les modifications de colonne)
CREATE OR REPLACE VIEW public.video_details AS
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
    v.storage_path,
    v.original_file_name,
    v.http_extension_available,
    v.created_at,
    v.updated_at,
    p.username AS uploader_username,
    p.full_name AS uploader_full_name
FROM
    public.videos v
JOIN
    public.profiles p ON v.profile_id = p.id;

-- Vue matérialisée: user_video_stats
CREATE MATERIALIZED VIEW public.user_video_stats AS
SELECT
    p.id AS profile_id,
    p.username,
    COUNT(v.id) AS total_videos,
    SUM(v.views) AS total_views,
    SUM(v.likes_count) AS total_likes,
    SUM(v.comments_count) AS total_comments,
    COALESCE(SUM(v.duration), 0) AS total_duration_seconds -- Utilise la nouvelle colonne 'duration'
FROM
    public.profiles p
LEFT JOIN
    public.videos v ON p.id = v.profile_id
GROUP BY
    p.id, p.username;

-- Vue matérialisée: global_stats
CREATE MATERIALIZED VIEW public.global_stats AS
SELECT
    COUNT(id) AS total_videos,
    SUM(views) AS total_views,
    SUM(likes_count) AS total_likes,
    SUM(comments_count) AS total_comments,
    COALESCE(SUM(duration), 0) AS total_duration_seconds -- Utilise la nouvelle colonne 'duration'
FROM
    public.videos;

-- Index pour les vues matérialisées
CREATE UNIQUE INDEX IF NOT EXISTS user_video_stats_profile_id_idx ON public.user_video_stats (profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS global_stats_idx ON public.global_stats (total_videos);

-- Fonctions et triggers pour la gestion des utilisateurs (inchangés)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, username, email)
  VALUES (gen_random_uuid(), NEW.id, NEW.email, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET username = NEW.email, email = NEW.email, updated_at = NOW()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE PROCEDURE public.handle_user_update();

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.profiles
  WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_user_delete();

-- Fonctions pour rafraîchir les vues matérialisées
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

-- Triggers pour rafraîchir les vues matérialisées lors des modifications de la table videos
CREATE TRIGGER refresh_user_video_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.videos
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_user_stats();

CREATE TRIGGER refresh_global_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.videos
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_global_stats();

-- Politiques RLS (inchangées)
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

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public videos are viewable by everyone" ON public.videos FOR SELECT USING (status = 'published');
CREATE POLICY "User full access to own videos" ON public.videos USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Transcription access by video owner" ON public.transcriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "AI suggestions access by owner" ON public.ai_suggestions FOR SELECT USING (EXISTS (SELECT 1 FROM public.transcriptions WHERE id = transcription_id AND user_id = auth.uid()));

CREATE POLICY "Public quizzes are viewable" ON public.quizzes FOR SELECT USING (TRUE);

CREATE POLICY "User access to own quiz results" ON public.quiz_results FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id));

CREATE POLICY "Users can manage own follows" ON public.followers USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "User manage own comments" ON public.comments USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Public comments on published videos" ON public.comments FOR SELECT USING (EXISTS (SELECT 1 FROM public.videos WHERE id = video_id AND status = 'published'));

CREATE POLICY "User manage own likes" ON public.likes USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own activities" ON public.user_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert activities" ON public.user_activities FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can manage their own submissions" ON public.challenge_submissions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own progress" ON public.challenge_progress USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Rafraîchir les vues matérialisées après la migration
REFRESH MATERIALIZED VIEW public.user_video_stats;
REFRESH MATERIALIZED VIEW public.global_stats;
