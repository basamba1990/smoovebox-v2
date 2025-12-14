-- Migration Supabase : Ajout des tables d'optimisation LLM
-- Date : 2025-12-13
-- Description : Tables pour le Prompt Tuning et l'Optimisation d'Agents

-- ============================================================================
-- 1. EXTENSION PGVECTOR (pour stocker les embeddings des soft prompts)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. TABLE : llm_soft_prompts
-- Stocke les embeddings optimisés (soft prompts) pour le Prompt Tuning
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.llm_soft_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Identifiant unique de la tâche
    task_name TEXT NOT NULL UNIQUE,
    
    -- Modèle LLM utilisé (ex: 't5-xxl', 'qwen2.5-7b')
    model_name TEXT NOT NULL DEFAULT 'qwen2.5-7b',
    
    -- Longueur du soft prompt (nombre de tokens)
    prompt_length INTEGER NOT NULL DEFAULT 5,
    
    -- Dimension de l'embedding (ex: 768, 1024)
    embedding_dimension INTEGER NOT NULL DEFAULT 768,
    
    -- Tenseur d'embeddings optimisé (vecteur)
    embeddings vector(768) NOT NULL,
    
    -- Indique si ce soft prompt est actuellement utilisé en production
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_llm_soft_prompts_task_name 
    ON public.llm_soft_prompts(task_name);
CREATE INDEX IF NOT EXISTS idx_llm_soft_prompts_is_active 
    ON public.llm_soft_prompts(is_active);

-- Commentaire
COMMENT ON TABLE public.llm_soft_prompts IS 
    'Stocke les embeddings optimisés (soft prompts) pour le Prompt Tuning. Permet de servir un LLM central gelé avec des adaptations spécifiques à la tâche.';

-- ============================================================================
-- 3. TABLE : agent_configurations
-- Stocke les configurations complètes des agents LLM et leurs métriques
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Nom de l'agent (ex: 'video_analysis_agent', 'personas_young-talent')
    agent_name TEXT NOT NULL,
    
    -- Version de la configuration (pour l'historique)
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Indique si cette configuration est utilisée en production
    is_active BOOLEAN DEFAULT FALSE,
    
    -- Configuration complète de l'agent (JSONB pour flexibilité)
    -- Structure attendue :
    -- {
    --   "system_prompt": "You are a professional...",
    --   "tool_descriptions": {"tool_name": "description"},
    --   "hyperparameters": {"temperature": 0.7, "max_tokens": 512}
    -- }
    configuration JSONB NOT NULL,
    
    -- Métriques de performance (pour le feedback de l'algorithme génétique)
    -- Structure attendue :
    -- {
    --   "accuracy": 0.85,
    --   "cost_tokens": 1200,
    --   "latency_ms": 450,
    --   "fitness_score": 0.92
    -- }
    metrics JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- Contrainte d'unicité : un agent peut avoir plusieurs versions
    UNIQUE(agent_name, version)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_agent_configurations_agent_name 
    ON public.agent_configurations(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_configurations_is_active 
    ON public.agent_configurations(is_active);

-- Commentaire
COMMENT ON TABLE public.agent_configurations IS 
    'Stocke les configurations complètes des agents LLM (prompts, outils, hyperparamètres) et leurs métriques de performance pour l\'optimisation évolutionnaire.';

-- ============================================================================
-- 4. TABLE : agent_execution_logs
-- Logs détaillés des exécutions d'agents pour le calcul de la fitness
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    
    -- Référence au video (si applicable)
    video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
    
    -- Référence à la configuration d'agent utilisée
    agent_config_id UUID REFERENCES public.agent_configurations(id) ON DELETE SET NULL,
    
    -- Données d'entrée de l'exécution
    input_data JSONB,
    
    -- Données de sortie de l'exécution
    output_data JSONB,
    
    -- Feedback de performance (pour l'optimisation)
    -- Structure attendue :
    -- {
    --   "tokens_used": 1500,
    --   "latency_ms": 300,
    --   "confidence": 0.92,
    --   "relevance_score": 0.85
    -- }
    performance_feedback JSONB,
    
    -- Timestamp de l'exécution
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_config_id 
    ON public.agent_execution_logs(agent_config_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_execution_time 
    ON public.agent_execution_logs(execution_time);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_video_id 
    ON public.agent_execution_logs(video_id);

-- Commentaire
COMMENT ON TABLE public.agent_execution_logs IS 
    'Logs détaillés des exécutions d\'agents pour le calcul de la fitness et l\'optimisation évolutionnaire (Artemis feedback).';

-- ============================================================================
-- 5. TABLE : soft_prompt_training_history
-- Historique des entraînements de soft prompts (optionnel, pour audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.soft_prompt_training_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Référence au soft prompt
    soft_prompt_id UUID REFERENCES public.llm_soft_prompts(id) ON DELETE CASCADE,
    
    -- Métriques avant l'entraînement
    metrics_before JSONB,
    
    -- Métriques après l'entraînement
    metrics_after JSONB,
    
    -- Paramètres d'entraînement utilisés
    training_params JSONB,
    
    -- Timestamp
    trained_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index
CREATE INDEX IF NOT EXISTS idx_soft_prompt_training_history_soft_prompt_id 
    ON public.soft_prompt_training_history(soft_prompt_id);

-- Commentaire
COMMENT ON TABLE public.soft_prompt_training_history IS 
    'Historique des entraînements de soft prompts pour audit et analyse des améliorations.';

-- ============================================================================
-- 6. FONCTION : trigger pour mettre à jour updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux tables
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
-- 7. POLITIQUES RLS (Row Level Security)
-- ============================================================================

-- Activer RLS sur les tables
ALTER TABLE public.llm_soft_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soft_prompt_training_history ENABLE ROW LEVEL SECURITY;

-- Politiques de lecture (tous les utilisateurs authentifiés peuvent lire)
CREATE POLICY "Allow read for authenticated users" ON public.llm_soft_prompts
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY "Allow read for authenticated users" ON public.agent_configurations
    FOR SELECT USING (auth.role() = 'authenticated_user');

CREATE POLICY "Allow read for authenticated users" ON public.agent_execution_logs
    FOR SELECT USING (auth.role() = 'authenticated_user');

-- Politiques d'écriture (seuls les administrateurs/services peuvent écrire)
CREATE POLICY "Allow insert for service role" ON public.llm_soft_prompts
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow update for service role" ON public.llm_soft_prompts
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Allow insert for service role" ON public.agent_configurations
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow update for service role" ON public.agent_configurations
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Allow insert for service role" ON public.agent_execution_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 8. DONNÉES DE TEST (optionnel)
-- ============================================================================

-- Insérer un soft prompt de test
INSERT INTO public.llm_soft_prompts (
    task_name,
    model_name,
    prompt_length,
    embedding_dimension,
    embeddings,
    is_active,
    metadata
) VALUES (
    'young_talent_guidance',
    'qwen2.5-7b',
    5,
    768,
    '[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]'::vector,
    TRUE,
    '{"description": "Soft prompt pour les jeunes talents"}'::jsonb
) ON CONFLICT (task_name) DO NOTHING;

-- Insérer une configuration d'agent de test
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
        "system_prompt": "You are Spot, a compassionate and insightful guide for young talents discovering their potential.",
        "tool_descriptions": {
            "analyze_passion": "Analyze the user''s passions and strengths",
            "suggest_careers": "Suggest hybrid careers based on multiple passions"
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
) ON CONFLICT (agent_name, version) DO NOTHING;

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
