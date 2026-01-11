-- ============================================================================
-- MASTER MIGRATION FINAL FIX - SpotBulle (version corrigée)
-- Aligne les contraintes sans casser les données existantes
-- ============================================================================

-- 1) EXTENSIONS (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) TABLE: public.videos
-- Ne pas recréer la table: elle existe avec un schéma étendu.
-- Corriger uniquement la contrainte de statut pour couvrir toutes les valeurs déjà présentes.

DO $$
DECLARE
  rec record;
BEGIN
  -- Supprimer toutes les contraintes CHECK portant sur la colonne status
  FOR rec IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'videos'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS %I;', rec.conname);
  END LOOP;

  -- Ajouter une contrainte compatible avec les valeurs existantes
  -- Valeurs observées dans la table:
  -- 'uploaded','processing','transcribing','transcribed','analyzing','analyzed','published','failed','draft','ready'
  -- On inclut aussi 'pending','generating' pour l'avenir.
  EXECUTE $sql$
    ALTER TABLE public.videos
    ADD CONSTRAINT videos_status_check
    CHECK (
      status = ANY (ARRAY[
        'uploaded','processing','transcribing','transcribed','analyzing','analyzed',
        'published','failed','draft','ready',
        'pending','generating'
      ])
    );
  $sql$;

  -- Ne pas forcer user_id NOT NULL ici: données existantes potentiellement nulles.
END $$;

-- 3) TABLE: agent_configurations (existe déjà: ne pas la recréer)
DO $$
BEGIN
  -- Rien à faire si la table existe (elle existe avec colonnes compatibles).
  NULL;
END $$;

-- 4) TABLE: agent_execution_logs (existe déjà: ne pas la recréer)
DO $$
BEGIN
  -- Rien à faire: structure déjà en place.
  NULL;
END $$;

-- 5) TABLE: llm_soft_prompts (existe déjà: colonnes alignées)
DO $$
BEGIN
  -- Rien à faire: structure déjà en place.
  NULL;
END $$;

-- 6) RLS CONFIGURATION
-- Activer RLS si non activé (idempotent)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_soft_prompts ENABLE ROW LEVEL SECURITY;

-- Politiques pour videos (adapter aux conventions existantes: user_id est la FK vers auth.users)
DO $$
BEGIN
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
END $$;

-- Politiques pour agent_execution_logs
DO $$
BEGIN
  DROP POLICY IF EXISTS "allow_read_authenticated_agent_execution_logs" ON public.agent_execution_logs;
  DROP POLICY IF EXISTS "allow_write_service_agent_execution_logs_insert" ON public.agent_execution_logs;

  CREATE POLICY "allow_read_authenticated_agent_execution_logs"
  ON public.agent_execution_logs FOR SELECT TO authenticated
  USING (true);

  CREATE POLICY "allow_write_service_agent_execution_logs_insert"
  ON public.agent_execution_logs FOR INSERT TO service_role
  WITH CHECK (true);
END $$;

-- 7) INDEXES (idempotents)
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_video_id ON public.agent_execution_logs(video_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_agent_config_id ON public.agent_execution_logs(agent_config_id);
