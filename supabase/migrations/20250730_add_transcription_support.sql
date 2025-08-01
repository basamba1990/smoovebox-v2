-- Ajouter les colonnes nécessaires à la table videos
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS transcription_data JSONB,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS transcription_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS transcription_error TEXT,
ADD COLUMN IF NOT EXISTS analysis JSONB;

-- Créer une fonction d'incrémentation pour les compteurs
CREATE OR REPLACE FUNCTION public.increment(
  row_id BIGINT,
  table_name TEXT,
  column_name TEXT,
  default_value INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_value INTEGER;
  new_value INTEGER;
BEGIN
  EXECUTE format('SELECT COALESCE(%I, $1) FROM %I WHERE id = $2', column_name, table_name)
  INTO current_value
  USING default_value, row_id;
  
  new_value := current_value + 1;
  
  EXECUTE format('UPDATE %I SET %I = $1 WHERE id = $2', table_name, column_name)
  USING new_value, row_id;
  
  RETURN new_value;
END;
$$;

-- Créer la table transcriptions si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.transcriptions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  video_id BIGINT NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'fr',
  full_text TEXT NOT NULL,
  transcription_text TEXT NOT NULL,
  segments JSONB,
  confidence_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer un index sur video_id pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS transcriptions_video_id_idx ON public.transcriptions(video_id);
CREATE INDEX IF NOT EXISTS transcriptions_user_id_idx ON public.transcriptions(user_id);

-- Activer Row Level Security
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de voir uniquement leurs propres transcriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'transcriptions' AND policyname = 'users_select_own_transcriptions'
  ) THEN
    CREATE POLICY users_select_own_transcriptions ON public.transcriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;
