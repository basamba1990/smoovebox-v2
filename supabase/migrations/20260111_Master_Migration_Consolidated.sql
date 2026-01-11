-- ============================================================================
-- MASTER MIGRATION CONSOLIDATED - SpotBulle
-- Resolves dependency error: relation "public.videos" does not exist
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLE: videos (parent table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'videos'
  ) THEN
    CREATE TABLE public.videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title TEXT,
      video_url TEXT,
      public_url TEXT,
      url TEXT,
      storage_path TEXT,
      status TEXT DEFAULT 'pending',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;

  -- Ensure user_id remains NOT NULL even if table pre-existed
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos'
      AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.videos ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- 3. TABLE: agent_configurations
CREATE TABLE IF NOT EXISTS public.agent_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT FALSE,
  configuration JSONB NOT NULL,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  UNIQUE(agent_name, version)
);

-- 4. TABLE: agent_execution_logs (depends on videos and agent_configurations)
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  agent_config_id UUID REFERENCES public.agent_configurations(id) ON DELETE SET NULL,
  input_data JSONB,
  output_data JSONB,
  performance_feedback JSONB,
  execution_time TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status = ANY (ARRAY['running','success','error'])),
  error_message TEXT,
  duration_ms INTEGER
);

-- 5. TABLE: llm_soft_prompts
CREATE TABLE IF NOT EXISTS public.llm_soft_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL DEFAULT 'qwen2.5-7b',
  prompt_length INTEGER NOT NULL DEFAULT 5,
  embedding_dimension INTEGER NOT NULL DEFAULT 768,
  embeddings vector(10) NOT NULL,
  prompt_text TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 6. RLS CONFIGURATION
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_soft_prompts ENABLE ROW LEVEL SECURITY;

-- Policies for videos
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

-- Policies for agent_execution_logs
DROP POLICY IF EXISTS "allow_read_authenticated_agent_execution_logs" ON public.agent_execution_logs;
DROP POLICY IF EXISTS "allow_write_service_agent_execution_logs_insert" ON public.agent_execution_logs;

CREATE POLICY "allow_read_authenticated_agent_execution_logs"
  ON public.agent_execution_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "allow_write_service_agent_execution_logs_insert"
  ON public.agent_execution_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_video_id ON public.agent_execution_logs(video_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_config_id ON public.agent_execution_logs(agent_config_id);
