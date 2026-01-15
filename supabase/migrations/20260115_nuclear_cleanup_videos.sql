-- ============================================================================
-- 0) Nettoyage total des triggers et fonctions liés à videos (sécurisé)
-- ============================================================================

DO $do$
DECLARE
  _trg RECORD;
BEGIN
  FOR _trg IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'videos'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.videos;', _trg.trigger_name);
  END LOOP;
END
$do$;

-- Supprime les anciennes fonctions de trigger (si elles existent)
DROP FUNCTION IF EXISTS public.validate_video_url() CASCADE;
DROP FUNCTION IF EXISTS public.normalize_video_url() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_video_required_fields() CASCADE;
DROP FUNCTION IF EXISTS public.check_video_url() CASCADE;
DROP FUNCTION IF EXISTS public.v2_final_video_validator() CASCADE;

-- ============================================================================
-- 1) Alignement du schéma (idempotent)
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='videos' AND column_name='size'
  ) THEN
    ALTER TABLE public.videos ADD COLUMN size BIGINT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='videos' AND column_name='language'
  ) THEN
    ALTER TABLE public.videos ADD COLUMN language TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='videos' AND column_name='public_url'
  ) THEN
    ALTER TABLE public.videos ADD COLUMN public_url TEXT;
  END IF;
END
$do$;

-- ============================================================================
-- 2) Backfill des données (aucun trigger actif à ce stade)
-- ============================================================================

UPDATE public.videos
SET size = file_size
WHERE size IS NULL AND file_size IS NOT NULL;

UPDATE public.videos
SET language = transcription_language
WHERE language IS NULL AND transcription_language IS NOT NULL;

UPDATE public.videos
SET public_url = video_url
WHERE public_url IS NULL AND video_url IS NOT NULL;

-- ============================================================================
-- 3) Nouvelle fonction de validation (simple, sûre, sans NEW.url)
--    - Ne lève pas d'erreur 42703
--    - Ne bloque pas les écritures
-- ============================================================================

CREATE OR REPLACE FUNCTION public.videos_soft_validate()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Normalisation douce
  IF NEW.video_url IS NOT NULL THEN
    NEW.video_url := btrim(NEW.video_url);
  END IF;

  IF NEW.public_url IS NOT NULL THEN
    NEW.public_url := btrim(NEW.public_url);
  END IF;

  -- Validation minimale non bloquante (pas de RAISE EXCEPTION)
  -- Au besoin, remplacer par un insert dans une table de logs.

  -- Cohérence size
  IF NEW.size IS NOT NULL AND NEW.size < 0 THEN
    NEW.size := 0;
  END IF;

  RETURN NEW;
END;
$func$;

-- ============================================================================
-- 4) Recréation d’un unique trigger propre
-- ============================================================================

CREATE TRIGGER trg_videos_soft_validate
BEFORE INSERT OR UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.videos_soft_validate();
