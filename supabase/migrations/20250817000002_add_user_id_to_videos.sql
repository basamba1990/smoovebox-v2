-- Migration pour ajouter la colonne user_id à la table videos et la lier à auth.users
-- Date: 2025-08-17

ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Mettre à jour les vidéos existantes pour définir user_id à partir de profile_id
-- Cette étape est cruciale pour la compatibilité avec le code existant qui utilise user_id
UPDATE public.videos
SET user_id = (SELECT user_id FROM public.profiles WHERE id = profile_id)
WHERE user_id IS NULL AND profile_id IS NOT NULL;

-- Créer un index pour améliorer les performances des requêtes par user_id
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);

-- Mettre à jour la politique RLS pour utiliser user_id si nécessaire
-- Assurez-vous que la politique 'User full access to own videos' utilise user_id
-- Si elle utilise profile_id, elle devra être mise à jour manuellement dans le fichier de migration principal ou via une nouvelle migration
-- Pour l'instant, nous supposons que le code client s'attend à user_id et que la base de données doit le supporter.


