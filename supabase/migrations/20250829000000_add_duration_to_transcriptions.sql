-- Migration pour ajouter la colonne duration à la table transcriptions
-- Date: 2025-08-29
-- Résout l'erreur: "Could not find the 'duration' column of 'transcriptions' in the schema cache"

ALTER TABLE public.transcriptions
ADD COLUMN IF NOT EXISTS duration REAL;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.transcriptions.duration IS 'Durée de la transcription en secondes, fournie par OpenAI Whisper';

-- Créer un index pour améliorer les performances des requêtes sur la durée
CREATE INDEX IF NOT EXISTS transcriptions_duration_idx ON public.transcriptions(duration);

