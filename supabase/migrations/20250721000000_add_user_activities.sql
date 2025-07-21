-- Création de la table user_activities si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);

-- RLS pour la table user_activities
ALTER TABLE IF EXISTS public.user_activities ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux utilisateurs de voir leurs propres activités
CREATE POLICY IF NOT EXISTS "Users can view their own activities" 
ON public.user_activities FOR SELECT 
USING (auth.uid() = user_id);

-- Politique pour permettre au système d'insérer des activités
CREATE POLICY IF NOT EXISTS "System can insert activities" 
ON public.user_activities FOR INSERT 
WITH CHECK (true);

