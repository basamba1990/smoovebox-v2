-- ============================================================================
-- Migration: Ensure videos exists and create/align agent_execution_logs
-- Safe, idempotent, production-ready
-- ============================================================================

-- 0) Guard: ensure prerequisite tables exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'videos'
  ) THEN
    RAISE EXCEPTION 'Prerequisite missing: public.videos must exist before running this migration.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agent_configurations'
  ) THEN
    RAISE EXCEPTION 'Prerequisite missing: public.agent_configurations must exist before running this migration.';
  END IF;
END
$$;

-- 1) Create table if not exists (structure aligned with current project state)
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  video_id UUID,
  agent_config_id UUID,
  input_data JSONB,
  output_data JSONB,
  performance_feedback JSONB,
  execution_time TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status = ANY(ARRAY['running','success','error'])),
  error_message TEXT,
  duration_ms INTEGER
);

-- 2) Ensure columns exist (for forward-compat with older environments)
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_execution_logs' AND column_name='started_at'
  ) THEN
    ALTER TABLE public.agent_execution_logs
      ADD COLUMN started_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_execution_logs' AND column_name='ended_at'
  ) THEN
    ALTER TABLE public.agent_execution_logs
      ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_execution_logs' AND column_name='status'
  ) THEN
    ALTER TABLE public.agent_execution_logs
      ADD COLUMN status TEXT DEFAULT 'running';
    -- Add check constraint if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'agent_execution_logs_status_check'
    ) THEN
      ALTER TABLE public.agent_execution_logs
        ADD CONSTRAINT agent_execution_logs_status_check
        CHECK (status = ANY(ARRAY['running','success','error']));
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_execution_logs' AND column_name='error_message'
  ) THEN
    ALTER TABLE public.agent_execution_logs
      ADD COLUMN error_message TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agent_execution_logs' AND column_name='duration_ms'
  ) THEN
    ALTER TABLE public.agent_execution_logs
      ADD COLUMN duration_ms INTEGER;
  END IF;
END
$$;

-- 3) Ensure foreign keys exist and point to the right targets
DO $$
BEGIN
  -- FK to public.videos(id)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_execution_logs_video_id_fkey'
  ) THEN
    ALTER TABLE public.agent_execution_logs
      ADD CONSTRAINT agent_execution_logs_video_id_fkey
      FOREIGN KEY (video_id)
      REFERENCES public.videos(id)
      ON DELETE SET NULL;
  END IF;

  -- FK to public.agent_configurations(id)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_execution_logs_agent_config_id_fkey'
  ) THEN
    ALTER TABLE public.agent_execution_logs
      ADD CONSTRAINT agent_execution_logs_agent_config_id_fkey
      FOREIGN KEY (agent_config_id)
      REFERENCES public.agent_configurations(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 4) Indexes for performance (optional but recommended)
-- Speeds up lookups by video or configuration
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_video_id
  ON public.agent_execution_logs (video_id);

CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_config_id
  ON public.agent_execution_logs (agent_config_id);

CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_status_started
  ON public.agent_execution_logs (status, started_at DESC);
