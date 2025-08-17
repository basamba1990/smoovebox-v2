-- Migration pour renommer la colonne duration_seconds en duration dans la table videos
-- Date: 2025-08-17

ALTER TABLE public.videos
RENAME COLUMN duration_seconds TO duration;


