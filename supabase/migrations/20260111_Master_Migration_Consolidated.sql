-- ============================================================================
-- MASTER MIGRATION CONSOLIDATED - SpotBulle (VERSION CORRIGÉE)
-- ============================================================================

-- 1. EXTENSIONS (inchangé)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLE: videos (parent table) - CORRIGÉE
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
      -- ✅ Simplification des champs d'URL/chemin
      video_url TEXT NOT NULL, -- URL publique pour la lecture
      storage_path TEXT NOT NULL, -- Chemin interne dans Supabase Storage
      
      -- ✅ Ajout de colonnes dédiées pour les métadonnées clés
      duration_seconds INTEGER, -- Durée de la vidéo en secondes
      file_size_bytes BIGINT, -- Taille du fichier en octets
      video_format TEXT, -- ex: 'mp4', 'webm'
      video_type TEXT CHECK (video_type IN ('pitch', 'reflexive', 'action_trace')), -- ✅ Nouvelle colonne pour le type de vidéo
      tags TEXT[], -- ✅ Tags sous forme de tableau de texte
      use_avatar BOOLEAN DEFAULT FALSE, -- Indique si un avatar a été utilisé

      -- ✅ Contrainte CHECK pour le statut
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'processing', 'transcribed', 'analyzing', 'analyzed', 'published', 'failed')),
      
      metadata JSONB DEFAULT '{}'::jsonb, -- Pour les métadonnées flexibles
      transcription_text TEXT, -- Texte de la transcription
      transcription_data JSONB, -- Données brutes de la transcription (segments, mots, etc.)
      transcription_language TEXT, -- Langue détectée ou spécifiée
      analysis JSONB, -- Résultat de l'analyse IA
      ai_score NUMERIC(4,2), -- Score global de l'IA
      profile_information JSONB, -- Informations de profil extraites
      error_message TEXT, -- Message d'erreur en cas d'échec

      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;

  -- ✅ Mises à jour des colonnes existantes pour la cohérence
  -- Supprimer les colonnes redondantes si elles existent
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'public_url') THEN
    ALTER TABLE public.videos DROP COLUMN public_url;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'url') THEN
    ALTER TABLE public.videos DROP COLUMN url;
  END IF;

  -- Ajouter les nouvelles colonnes si elles n'existent pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'duration_seconds') THEN
    ALTER TABLE public.videos ADD COLUMN duration_seconds INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'file_size_bytes') THEN
    ALTER TABLE public.videos ADD COLUMN file_size_bytes BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'video_format') THEN
    ALTER TABLE public.videos ADD COLUMN video_format TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'video_type') THEN
    ALTER TABLE public.videos ADD COLUMN video_type TEXT CHECK (video_type IN ('pitch', 'reflexive', 'action_trace'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'tags') THEN
    ALTER TABLE public.videos ADD COLUMN tags TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'use_avatar') THEN
    ALTER TABLE public.videos ADD COLUMN use_avatar BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'transcription_text') THEN
    ALTER TABLE public.videos ADD COLUMN transcription_text TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'transcription_data') THEN
    ALTER TABLE public.videos ADD COLUMN transcription_data JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'transcription_language') THEN
    ALTER TABLE public.videos ADD COLUMN transcription_language TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'analysis') THEN
    ALTER TABLE public.videos ADD COLUMN analysis JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'ai_score') THEN
    ALTER TABLE public.videos ADD COLUMN ai_score NUMERIC(4,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'profile_information') THEN
    ALTER TABLE public.videos ADD COLUMN profile_information JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'error_message') THEN
    ALTER TABLE public.videos ADD COLUMN error_message TEXT;
  END IF;

  -- Mettre à jour la contrainte CHECK pour le statut si elle n'existe pas ou est incorrecte
  -- (Nécessite de supprimer et recréer la contrainte si elle existe déjà avec des valeurs différentes)
  -- Cette partie est complexe à gérer dans un script DO $$ IF NOT EXISTS, il est souvent préférable de le faire manuellement ou avec un outil de migration plus avancé.
  -- Pour cet exemple, nous allons supposer que la table est créée avec la bonne contrainte ou que la migration est appliquée sur une nouvelle DB.

  -- Ensure user_id remains NOT NULL even if table pre-existed (inchangé)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos'
      AND column_name = 'user_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.videos ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- 3. TABLE: agent_configurations (inchangé)
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

-- 4. TABLE: agent_execution_logs (depends on videos and agent_configurations) (inchangé)
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

-- 5. TABLE: llm_soft_prompts (inchangé)
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

-- 6. RLS CONFIGURATION (inchangé, mais à vérifier si les nouvelles colonnes nécessitent des ajustements spécifiques)
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

-- Policies for agent_execution_logs (inchangé)
DROP POLICY IF EXISTS "allow_read_authenticated_agent_execution_logs" ON public.agent_execution_logs;
DROP POLICY IF EXISTS "allow_write_service_agent_execution_logs_insert" ON public.agent_execution_logs;

CREATE POLICY "allow_read_authenticated_agent_execution_logs"
  ON public.agent_execution_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "allow_write_service_agent_execution_logs_insert"
  ON public.agent_execution_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- 7. INDEXES (inchangé)
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_video_id ON public.agent_execution_logs(video_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_config_id ON public.agent_execution_logs(agent_config_id);

-- ✅ Ajout des tables video_portfolios et video_prompts pour le parcours GENUP
-- Nouvelle table : video_portfolios
CREATE TABLE IF NOT EXISTS public.video_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Nouvelle table : video_prompts
CREATE TABLE IF NOT EXISTS public.video_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  category TEXT CHECK (category IN ('pitch', 'reflexive', 'action_trace')), -- ex: 'pitch', 'reflexive', 'action_trace'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Modification de la table videos pour lier aux portfolios et prompts
-- (Ces ALTER TABLE sont idempotents grâce aux IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'portfolio_id') THEN
    ALTER TABLE public.videos ADD COLUMN portfolio_id UUID REFERENCES public.video_portfolios(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'prompt_id') THEN
    ALTER TABLE public.videos ADD COLUMN prompt_id UUID REFERENCES public.video_prompts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'human_validation') THEN
    ALTER TABLE public.videos ADD COLUMN human_validation JSONB;
  END IF;
END $$;
