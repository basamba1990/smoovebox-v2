-- Migration pour corriger le schéma de la table videos
-- Date: 2025-07-29

-- Mettre à jour la contrainte de statut pour inclure les nouveaux statuts
ALTER TABLE public.videos 
DROP CONSTRAINT IF EXISTS videos_status_check;

ALTER TABLE public.videos 
ADD CONSTRAINT videos_status_check 
CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'uploaded', 'transcribing', 'transcribed', 'analyzing', 'analyzed', 'published', 'draft', 'failed'));

-- Ajouter une colonne pour stocker le chemin de stockage si elle n'existe pas
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Ajouter une colonne pour l'analyse IA si elle n'existe pas
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS analysis JSONB;

-- Ajouter une colonne pour la transcription si elle n'existe pas
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS transcription JSONB;

-- Mettre à jour les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_user_id_status ON public.videos(user_id, status);

-- Ajouter une fonction pour nettoyer les anciens statuts
CREATE OR REPLACE FUNCTION public.normalize_video_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Normaliser les anciens statuts vers les nouveaux
    CASE NEW.status
        WHEN 'uploaded' THEN NEW.status := 'PENDING';
        WHEN 'transcribing' THEN NEW.status := 'PROCESSING';
        WHEN 'transcribed' THEN NEW.status := 'PROCESSING';
        WHEN 'analyzing' THEN NEW.status := 'PROCESSING';
        WHEN 'analyzed' THEN NEW.status := 'COMPLETED';
        WHEN 'published' THEN NEW.status := 'COMPLETED';
        WHEN 'draft' THEN NEW.status := 'PENDING';
        WHEN 'failed' THEN NEW.status := 'FAILED';
        ELSE -- Garder le statut actuel s'il est déjà dans le nouveau format
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour normaliser les statuts
DROP TRIGGER IF EXISTS normalize_video_status_trigger ON public.videos;
CREATE TRIGGER normalize_video_status_trigger
    BEFORE INSERT OR UPDATE ON public.videos
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_video_status();

-- Mettre à jour les statuts existants
UPDATE public.videos 
SET status = CASE 
    WHEN status = 'uploaded' THEN 'PENDING'
    WHEN status = 'transcribing' THEN 'PROCESSING'
    WHEN status = 'transcribed' THEN 'PROCESSING'
    WHEN status = 'analyzing' THEN 'PROCESSING'
    WHEN status = 'analyzed' THEN 'COMPLETED'
    WHEN status = 'published' THEN 'COMPLETED'
    WHEN status = 'draft' THEN 'PENDING'
    WHEN status = 'failed' THEN 'FAILED'
    ELSE status
END
WHERE status IN ('uploaded', 'transcribing', 'transcribed', 'analyzing', 'analyzed', 'published', 'draft', 'failed');

