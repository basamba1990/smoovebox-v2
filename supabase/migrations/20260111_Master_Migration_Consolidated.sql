-- ============================================================================
-- MASTER MIGRATION CONSOLIDATED - SpotBulle (corrected)
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. DROP dependent views of public.videos
DO $do$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schemaname, c.relname AS viewname
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class   c ON c.oid = r.ev_class AND c.relkind = 'v'
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class   tv ON tv.oid = d.refobjid
    JOIN pg_namespace tn ON tn.oid = tv.relnamespace
    WHERE tn.nspname = 'public' AND tv.relname = 'videos'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I;', rec.schemaname, rec.viewname);
  END LOOP;
END
$do$;

-- 2. TABLE: videos (create if missing + normalize)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='videos'
  ) THEN
    EXECUTE $sql$
      CREATE TABLE public.videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        profile_id UUID REFERENCES public.profiles(id),

        title TEXT DEFAULT 'Untitled video',
        description TEXT,
        file_path TEXT,
        thumbnail_url TEXT,

        duration INTEGER,
        category TEXT,
        status TEXT DEFAULT 'processing'
          CHECK (status = ANY (ARRAY[
            'uploaded','processing','transcribing','transcribed',
            'analyzing','analyzed','published','failed','draft','ready','pending','generating'
          ])),
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,

        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        is_public BOOLEAN DEFAULT FALSE,
        original_file_name TEXT,
        transcription_attempts INTEGER DEFAULT 0,
        transcription_error TEXT,
        file_size BIGINT,
        format TEXT,
        transcription JSONB,
        analysis JSONB DEFAULT '{}'::jsonb,
        processed_at TIMESTAMPTZ,
        -- Standardized target columns
        video_url TEXT,
        storage_path TEXT,
        transcription_data JSONB DEFAULT '{}'::jsonb,
        transcript JSONB,
        ai_result JSONB,
        error_message TEXT,
        performance_score REAL,
        transcription_text TEXT,
        engagement_score NUMERIC DEFAULT 0,
        views INTEGER DEFAULT 0,
        http_extension_available BOOLEAN DEFAULT FALSE,
        tags TEXT[] DEFAULT '{}',
        tone_analysis JSONB,
        use_avatar BOOLEAN DEFAULT FALSE,
        ai_score DOUBLE PRECISION,
        analysis_data JSONB,
        age_group TEXT,
        scenario_used TEXT,
        matching_insights JSONB,
        transcription_language TEXT,
        language_detected BOOLEAN DEFAULT TRUE,
        analysis_language TEXT,
        video_embedding vector,
        profile_information JSONB,
        processing_pipeline JSONB DEFAULT '{}'::jsonb,
        published_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    $sql$;
  END IF;

  -- 2.b Normalize: add missing columns if table already existed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='videos' AND column_name='video_url'
  ) THEN
    EXECUTE 'ALTER TABLE public.videos ADD COLUMN video_url TEXT;';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='videos' AND column_name='storage_path'
  ) THEN
    EXECUTE 'ALTER TABLE public.videos ADD COLUMN storage_path TEXT;';
  END IF;

  -- Ensure columns that were temporarily present are dropped if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='videos' AND column_name='url'
  ) THEN
    EXECUTE 'ALTER TABLE public.videos DROP COLUMN url;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='videos' AND column_name='public_url'
  ) THEN
    EXECUTE 'ALTER TABLE public.videos DROP COLUMN public_url;';
  END IF;
END
$do$;

-- 4. OTHER TABLES
CREATE TABLE IF NOT EXISTS public.agent_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT FALSE,
  configuration JSONB NOT NULL,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_name, version)
);

CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  agent_config_id UUID REFERENCES public.agent_configurations(id) ON DELETE SET NULL,
  input_data JSONB,
  output_data JSONB,
  performance_feedback JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  execution_time TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'running'
    CHECK (status IN ('running','success','error')),
  error_message TEXT,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS public.llm_soft_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL DEFAULT 'qwen2.5-7b',
  prompt_length INTEGER NOT NULL DEFAULT 5,
  embedding_dimension INTEGER NOT NULL DEFAULT 768,
  embeddings vector(768) NOT NULL,
  prompt_text TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_soft_prompts ENABLE ROW LEVEL SECURITY;

-- Policies videos
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leurs propres vidéos" ON public.videos;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs propres vidéos" ON public.videos;
DROP POLICY IF EXISTS "Service Role peut tout faire" ON public.videos;

CREATE POLICY "Les utilisateurs peuvent voir leurs propres vidéos"
  ON public.videos FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Les utilisateurs peuvent insérer leurs propres vidéos"
  ON public.videos FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service Role peut tout faire"
  ON public.videos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Policies agent_execution_logs
DROP POLICY IF EXISTS "allow_read_authenticated_agent_execution_logs" ON public.agent_execution_logs;
DROP POLICY IF EXISTS "allow_write_service_agent_execution_logs_insert" ON public.agent_execution_logs;

CREATE POLICY "allow_read_authenticated_agent_execution_logs"
  ON public.agent_execution_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "allow_write_service_agent_execution_logs_insert"
  ON public.agent_execution_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- 6. INDEXES
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_video_id ON public.agent_execution_logs(video_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_config_id ON public.agent_execution_logs(agent_config_id);

-- 7. COMPLEMENTARY TABLES
CREATE TABLE IF NOT EXISTS public.video_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT CHECK (category IN ('pitch','reflexive','action_trace')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES public.video_portfolios(id) ON DELETE SET NULL;

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES public.video_prompts(id) ON DELETE SET NULL;

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS human_validation JSONB;

-- 8. Diagnostic view
CREATE OR REPLACE VIEW public.problematic_videos AS
SELECT
  id, user_id, title, video_url, storage_path, status, error_message, created_at
FROM public.videos
WHERE status = 'failed';
