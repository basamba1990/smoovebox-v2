-- Migration Supabase : Ajout des tables d'optimisation LLM
-- Date : 2025-12-13
-- Description : Tables pour le Prompt Tuning et l'Optimisation d'Agents

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. TABLE : llm_soft_prompts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.llm_soft_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_name TEXT NOT NULL UNIQUE,
    model_name TEXT NOT NULL DEFAULT 'qwen2.5-7b',
    prompt_length INTEGER NOT NULL DEFAULT 5,
    embedding_dimension INTEGER NOT NULL DEFAULT 768,
    embeddings vector(10) NOT NULL,
    -- prompt_text sera assuré ci-dessous via ALTER TABLE IF NOT EXISTS
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Assurer la présence de la colonne prompt_text si la table existait déjà
ALTER TABLE public.llm_soft_prompts
  ADD COLUMN IF NOT EXISTS prompt_text TEXT;

CREATE INDEX IF NOT EXISTS idx_llm_soft_prompts_task_name 
    ON public.llm_soft_prompts(task_name);
CREATE INDEX IF NOT EXISTS idx_llm_soft_prompts_is_active 
    ON public.llm_soft_prompts(is_active);

COMMENT ON TABLE public.llm_soft_prompts IS 
    'Stocke les embeddings optimisés (soft prompts) pour le Prompt Tuning. Permet de servir un LLM central gelé avec des adaptations spécifiques à la tâche.';

-- ============================================================================
-- 3. TABLE : agent_configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT FALSE,
    configuration JSONB NOT NULL,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(agent_name, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_configurations_agent_name 
    ON public.agent_configurations(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_configurations_is_active 
    ON public.agent_configurations(is_active);

COMMENT ON TABLE public.agent_configurations IS 
    'Stocke les configurations complètes des agents LLM (prompts, outils, hyperparamètres) et leurs métriques de performance pour l''optimisation évolutionnaire.';

-- ============================================================================
-- 4. TABLE : agent_execution_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    agent_config_id UUID REFERENCES public.agent_configurations(id) ON DELETE SET NULL,
    input_data JSONB,
    output_data JSONB,
    performance_feedback JSONB,
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_config_id 
    ON public.agent_execution_logs(agent_config_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_execution_time 
    ON public.agent_execution_logs(execution_time);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_video_id 
    ON public.agent_execution_logs(video_id);

COMMENT ON TABLE public.agent_execution_logs IS 
    'Logs détaillés des exécutions d''agents pour le calcul de la fitness et l''optimisation évolutionnaire (Artemis feedback).';

-- ============================================================================
-- 5. TABLE : soft_prompt_training_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.soft_prompt_training_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    soft_prompt_id UUID REFERENCES public.llm_soft_prompts(id) ON DELETE CASCADE,
    metrics_before JSONB,
    metrics_after JSONB,
    training_params JSONB,
    trained_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_soft_prompt_training_history_soft_prompt_id 
    ON public.soft_prompt_training_history(soft_prompt_id);

COMMENT ON TABLE public.soft_prompt_training_history IS 
    'Historique des entraînements de soft prompts pour audit et analyse des améliororations.';

-- ============================================================================
-- 6. TRIGGER updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_llm_soft_prompts_updated_at ON public.llm_soft_prompts;
CREATE TRIGGER update_llm_soft_prompts_updated_at
    BEFORE UPDATE ON public.llm_soft_prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_configurations_updated_at ON public.agent_configurations;
CREATE TRIGGER update_agent_configurations_updated_at
    BEFORE UPDATE ON public.agent_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. RLS - Idempotent
-- ============================================================================
ALTER TABLE public.llm_soft_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soft_prompt_training_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to rerun)
DROP POLICY IF EXISTS "allow_read_authenticated_llm_soft_prompts" ON public.llm_soft_prompts;
DROP POLICY IF EXISTS "allow_write_service_llm_soft_prompts_insert" ON public.llm_soft_prompts;
DROP POLICY IF EXISTS "allow_write_service_llm_soft_prompts_update" ON public.llm_soft_prompts;

DROP POLICY IF EXISTS "allow_read_authenticated_agent_configurations" ON public.agent_configurations;
DROP POLICY IF EXISTS "allow_write_service_agent_configurations_insert" ON public.agent_configurations;
DROP POLICY IF EXISTS "allow_write_service_agent_configurations_update" ON public.agent_configurations;

DROP POLICY IF EXISTS "allow_read_authenticated_agent_execution_logs" ON public.agent_execution_logs;
DROP POLICY IF EXISTS "allow_write_service_agent_execution_logs_insert" ON public.agent_execution_logs;

DROP POLICY IF EXISTS "allow_read_authenticated_soft_prompt_history" ON public.soft_prompt_training_history;

-- Read for authenticated users
CREATE POLICY "allow_read_authenticated_llm_soft_prompts" ON public.llm_soft_prompts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "allow_read_authenticated_agent_configurations" ON public.agent_configurations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "allow_read_authenticated_agent_execution_logs" ON public.agent_execution_logs
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "allow_read_authenticated_soft_prompt_history" ON public.soft_prompt_training_history
  FOR SELECT TO authenticated
  USING (true);

-- Writes reserved for service_role
CREATE POLICY "allow_write_service_llm_soft_prompts_insert" ON public.llm_soft_prompts
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "allow_write_service_llm_soft_prompts_update" ON public.llm_soft_prompts
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_write_service_agent_configurations_insert" ON public.agent_configurations
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "allow_write_service_agent_configurations_update" ON public.agent_configurations
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_write_service_agent_execution_logs_insert" ON public.agent_execution_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================================================
-- 8. DONNÉES DE TEST MISES À JOUR
-- ============================================================================
INSERT INTO public.llm_soft_prompts (
    task_name,
    model_name,
    prompt_length,
    embedding_dimension,
    embeddings,
    prompt_text,
    is_active,
    metadata
) VALUES (
    'young_talent_guidance',
    'qwen2.5-7b',
    5,
    768,
    '[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]'::vector,
    'Tu es un mentor bienveillant pour les jeunes talents. Ton objectif est de les aider à découvrir leurs passions, à reconnaître leurs forces uniques, et à visualiser des chemins de carrière hybrides qui combinent plusieurs intérêts. Sois encourageant, positif et constructif.',
    TRUE,
    '{"description": "Soft prompt pour les jeunes talents", "tone": "encourageant", "style": "mentor bienveillant"}'::jsonb
) ON CONFLICT (task_name) DO UPDATE SET 
    prompt_text = EXCLUDED.prompt_text,
    metadata = EXCLUDED.metadata;

INSERT INTO public.llm_soft_prompts (
    task_name,
    model_name,
    prompt_length,
    embedding_dimension,
    embeddings,
    prompt_text,
    is_active,
    metadata
) VALUES (
    'pitch_analysis',
    'qwen2.5-7b',
    5,
    768,
    '[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.1]'::vector,
    'Tu es un expert en analyse de discours et en communication. Analyse les pitches audio/vidéo pour identifier le ton, les émotions, la clarté du message, et fournis des retours constructifs pour améliorer la communication.',
    TRUE,
    '{"description": "Soft prompt pour l''analyse de pitch", "domain": "communication", "expertise": "analyse de discours"}'::jsonb
) ON CONFLICT (task_name) DO UPDATE SET 
    prompt_text = EXCLUDED.prompt_text,
    metadata = EXCLUDED.metadata;

INSERT INTO public.llm_soft_prompts (
    task_name,
    model_name,
    prompt_length,
    embedding_dimension,
    embeddings,
    prompt_text,
    is_active,
    metadata
) VALUES (
    'hybrid_career_recommendations',
    'qwen2.5-7b',
    5,
    768,
    '[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.1, 0.2]'::vector,
    'Tu es un expert en orientation professionnelle spécialisé dans les carrières hybrides et la multipotentialité. Crée des recommandations de métiers innovants qui combinent plusieurs passions de manière créative et réaliste.',
    TRUE,
    '{"description": "Soft prompt pour les recommandations de carrières hybrides", "model": "T/M", "focus": "multipotentialité"}'::jsonb
) ON CONFLICT (task_name) DO UPDATE SET 
    prompt_text = EXCLUDED.prompt_text,
    metadata = EXCLUDED.metadata;

-- Configurations d'agents pour les personas
INSERT INTO public.agent_configurations (
    agent_name,
    version,
    is_active,
    configuration,
    metrics
) VALUES (
    'personas_young-talent',
    1,
    TRUE,
    '{
        "system_prompt": "You are Spot, a compassionate and insightful guide for young talents discovering their potential. Speak in a friendly, encouraging tone in French.",
        "tool_descriptions": {
            "analyze_passion": "Analyze the user''s passions and strengths",
            "suggest_careers": "Suggest hybrid careers based on multiple passions",
            "analyze_pitch": "Provide constructive feedback on pitch delivery"
        },
        "hyperparameters": {
            "temperature": 0.7,
            "max_tokens": 512,
            "top_p": 0.9
        }
    }'::jsonb,
    '{
        "accuracy": 0.85,
        "cost_tokens": 1200,
        "latency_ms": 450,
        "fitness_score": 0.92
    }'::jsonb
) ON CONFLICT (agent_name, version) DO UPDATE SET 
    configuration = EXCLUDED.configuration,
    metrics = EXCLUDED.metrics;

-- Configuration d'agent pour l'analyse de pitch
INSERT INTO public.agent_configurations (
    agent_name,
    version,
    is_active,
    configuration,
    metrics
) VALUES (
    'pitch_young-talent_agent',
    1,
    TRUE,
    '{
        "system_prompt": "You are Spot, an expert pitch coach specialized in helping young talents express their ideas clearly and confidently. Provide constructive, encouraging feedback in French.",
        "hyperparameters": {
            "temperature": 0.7,
            "max_tokens": 512,
            "top_p": 0.9
        }
    }'::jsonb,
    '{
        "accuracy": 0.88,
        "cost_tokens": 850,
        "latency_ms": 320,
        "fitness_score": 0.95
    }'::jsonb
) ON CONFLICT (agent_name, version) DO UPDATE SET 
    configuration = EXCLUDED.configuration,
    metrics = EXCLUDED.metrics;

-- Configuration d'agent pour les recommandations de carrières hybrides
INSERT INTO public.agent_configurations (
    agent_name,
    version,
    is_active,
    configuration,
    metrics
) VALUES (
    'hybrid_career_agent',
    1,
    TRUE,
    '{
        "system_prompt": "You are Spot, an expert career advisor specializing in hybrid careers and multipotentiality. Provide creative, realistic, and inspiring career recommendations in French.",
        "hyperparameters": {
            "temperature": 0.8,
            "max_tokens": 1500,
            "top_p": 0.9
        }
    }'::jsonb,
    '{
        "accuracy": 0.82,
        "cost_tokens": 1800,
        "latency_ms": 520,
        "fitness_score": 0.89
    }'::jsonb
) ON CONFLICT (agent_name, version) DO UPDATE SET 
    configuration = EXCLUDED.configuration,
    metrics = EXCLUDED.metrics;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
