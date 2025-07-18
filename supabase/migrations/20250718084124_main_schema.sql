/* 
  SMOOVEBOX DATABASE SCHEMA - VERSION 1.0
  Full schema for Supabase PostgreSQL
*/

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create private schema
CREATE SCHEMA IF NOT EXISTS private;

-- Table: Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INT,
    tags TEXT[],
    category TEXT,
    status TEXT DEFAULT 'processing' 
        CHECK (status IN ('processing', 'published', 'draft', 'failed')),
    views_count INT DEFAULT 0,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    ai_score REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Transcriptions
CREATE TABLE public.transcriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    full_text TEXT NOT NULL,
    segments JSONB,
    keywords TEXT[],
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: AI Suggestions
CREATE TABLE public.ai_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcription_id UUID REFERENCES public.transcriptions(id) ON DELETE CASCADE,
    suggestion_type TEXT CHECK (suggestion_type IN ('pitch', 'improvement', 'structure', 'keyword')),
    title TEXT,
    description TEXT,
    confidence_score REAL,
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Quizzes
CREATE TABLE public.quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE public.quiz_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    score REAL NOT NULL,
    details JSONB,
    percentile REAL,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Followers
CREATE TABLE public.followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    followed_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);

-- Table: Comments
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.comments(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Likes
CREATE TABLE public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, profile_id)
);

-- Performance Indexes
CREATE INDEX idx_videos_profile_id ON public.videos(profile_id);
CREATE INDEX idx_videos_tags ON public.videos USING GIN(tags);
CREATE INDEX idx_transcriptions_video_id ON public.transcriptions(video_id);
CREATE INDEX idx_ai_suggestions_transcription_id ON public.ai_suggestions(transcription_id);
CREATE INDEX idx_quiz_results_profile_id ON public.quiz_results(profile_id);
CREATE INDEX idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);
CREATE INDEX idx_followers_follower_id ON public.followers(follower_id);
CREATE INDEX idx_followers_followed_id ON public.followers(followed_id);
CREATE INDEX idx_comments_video_id ON public.comments(video_id);
CREATE INDEX idx_comments_profile_id ON public.comments(profile_id);
CREATE INDEX idx_likes_video_id ON public.likes(video_id);
CREATE INDEX idx_likes_profile_id ON public.likes(profile_id);

-- Function: Update modified timestamp
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_profiles_modtime
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER update_videos_modtime
BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER update_comments_modtime
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Sample Policies (customize as needed)
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);
