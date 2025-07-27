/* 
  SMOOVEBOX DATABASE SCHEMA - VERSION 1.2
  Full schema for Supabase PostgreSQL with complete RLS policies
*/

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create private schema
CREATE SCHEMA IF NOT EXISTS private;

-- Table: Profiles
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

-- Table: Videos
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INT,
    tags TEXT[],
    category TEXT,
    status TEXT DEFAULT 'uploaded' 
        CHECK (status IN ('uploaded', 'transcribing', 'transcribed', 'analyzing', 'analyzed', 'published', 'draft', 'failed')),
    views_count INT DEFAULT 0,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    ai_score REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Transcriptions
CREATE TABLE IF NOT EXISTS public.transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    full_text TEXT NOT NULL,
    segments JSONB,
    keywords TEXT[],
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: AI Suggestions
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

-- Table: Quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    quiz_type TEXT CHECK (quiz_type IN ('personality', 'skills', 'technical')),
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    questions JSONB,
    max_score INT,
    time_limit_minutes INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Quiz Results
CREATE TABLE IF NOT EXISTS public.quiz_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score REAL NOT NULL,
    details JSONB,
    percentile REAL,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Followers
CREATE TABLE IF NOT EXISTS public.followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    followed_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);

-- Table: Comments
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.comments(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Likes
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, profile_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_videos_profile_id ON public.videos(profile_id);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON public.videos USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_transcriptions_video_id ON public.transcriptions(video_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_transcription_id ON public.ai_suggestions(transcription_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_profile_id ON public.quiz_results(profile_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON public.followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_followed_id ON public.followers(followed_id);
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON public.comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON public.comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_likes_video_id ON public.likes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_profile_id ON public.likes(profile_id);

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
        FOR Each ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
END $$;

-- Row Level Security
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.likes ENABLE ROW LEVEL SECURITY;

-- Complete RLS Policies
DO $$
BEGIN
    -- Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profiles are viewable by everyone') THEN
        CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
        FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile') THEN
        CREATE POLICY "Users can update their own profile" ON public.profiles
        FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    
    -- Videos
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public videos are viewable by everyone') THEN
        CREATE POLICY "Public videos are viewable by everyone" ON public.videos
        FOR SELECT USING (status = 'published');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User full access to own videos') THEN
        CREATE POLICY "User full access to own videos" ON public.videos
        FOR ALL USING (
            auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id)
        );
    END IF;
    
    -- Transcriptions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Transcription access by video owner') THEN
        CREATE POLICY "Transcription access by video owner" ON public.transcriptions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.videos v
                WHERE v.id = video_id
                AND auth.uid() = (SELECT user_id FROM public.profiles p WHERE p.id = v.profile_id)
            )
        );
    END IF;
    
    -- AI Suggestions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'AI suggestions access by owner') THEN
        CREATE POLICY "AI suggestions access by owner" ON public.ai_suggestions
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.transcriptions t
                JOIN public.videos v ON t.video_id = v.id
                WHERE t.id = transcription_id
                AND auth.uid() = (SELECT user_id FROM public.profiles p WHERE p.id = v.profile_id)
            )
        );
    END IF;
    
    -- Quiz Results
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User access to own quiz results') THEN
        CREATE POLICY "User access to own quiz results" ON public.quiz_results
        FOR ALL USING (
            auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id)
        );
    END IF;
    
    -- Followers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own follows') THEN
        CREATE POLICY "Users can manage own follows" ON public.followers
        FOR ALL USING (
            auth.uid() = (SELECT user_id FROM public.profiles WHERE id = follower_id)
        );
    END IF;
    
    -- Comments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User manage own comments') THEN
        CREATE POLICY "User manage own comments" ON public.comments
        FOR ALL USING (
            auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id)
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public comments on published videos') THEN
        CREATE POLICY "Public comments on published videos" ON public.comments
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.videos
                WHERE id = video_id AND status = 'published'
            )
        );
    END IF;
    
    -- Likes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User manage own likes') THEN
        CREATE POLICY "User manage own likes" ON public.likes
        FOR ALL USING (
            auth.uid() = (SELECT user_id FROM public.profiles WHERE id = profile_id)
        );
    END IF;
    
    -- Quizzes (public read access)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public quizzes are viewable') THEN
        CREATE POLICY "Public quizzes are viewable" ON public.quizzes
        FOR SELECT USING (true);
    END IF;
END $$;

-- Function for auth hooks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, username)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
