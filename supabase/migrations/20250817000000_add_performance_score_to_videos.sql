-- Migration pour ajouter la colonne performance_score à la table videos
-- Date: 2025-08-17

ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS performance_score REAL;

-- Mettre à jour les vidéos existantes pour définir performance_score à partir de analysis.performance.scores.global si disponible
UPDATE public.videos
SET performance_score = (analysis->'performance'->'scores'->>'global')::REAL
WHERE analysis IS NOT NULL
  AND analysis->'performance'->'scores'->>'global' IS NOT NULL
  AND performance_score IS NULL;


