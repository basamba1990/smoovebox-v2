-- Migration pour corriger le schéma de la table transcriptions
-- Ajouter les colonnes manquantes

-- Ajouter la colonne confidence_score si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transcriptions' 
                   AND column_name = 'confidence_score') THEN
        ALTER TABLE public.transcriptions ADD COLUMN confidence_score REAL;
    END IF;
END $$;

-- Ajouter la colonne created_at si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transcriptions' 
                   AND column_name = 'created_at') THEN
        ALTER TABLE public.transcriptions ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Ajouter la colonne transcription_text si elle n'existe pas (alias pour full_text)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transcriptions' 
                   AND column_name = 'transcription_text') THEN
        ALTER TABLE public.transcriptions ADD COLUMN transcription_text TEXT;
        -- Copier les données de full_text vers transcription_text
        UPDATE public.transcriptions SET transcription_text = full_text WHERE full_text IS NOT NULL;
    END IF;
END $$;

-- Ajouter la colonne analysis_result si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transcriptions' 
                   AND column_name = 'analysis_result') THEN
        ALTER TABLE public.transcriptions ADD COLUMN analysis_result JSONB;
    END IF;
END $$;

-- Mettre à jour les timestamps existants
UPDATE public.transcriptions 
SET created_at = processed_at 
WHERE created_at IS NULL AND processed_at IS NOT NULL;

