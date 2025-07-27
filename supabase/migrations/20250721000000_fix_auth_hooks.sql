-- Supprimer les anciens triggers qui pourraient causer des conflits
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS before_user_created_trigger ON auth.users;
DROP TRIGGER IF EXISTS after_user_created_trigger ON auth.users;

-- Fonction unifiée pour la création d'utilisateur
CREATE OR REPLACE FUNCTION auth.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    username_base TEXT;
    username_suffix INT := 1;
    new_username TEXT;
    profile_id UUID;
BEGIN
    -- Générer un nom d'utilisateur unique
    username_base := LOWER(SPLIT_PART(NEW.email, '@', 1));
    new_username := username_base;
    
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
        new_username := username_base || username_suffix;
        username_suffix := username_suffix + 1;
    END LOOP;
    
    -- Créer le profil utilisateur avec toutes les informations nécessaires
    INSERT INTO public.profiles (
        user_id, 
        email, 
        username, 
        full_name
    )
    VALUES (
        NEW.id, 
        NEW.email,
        new_username,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            CONCAT(
                NEW.raw_user_meta_data->>'first_name', 
                ' ', 
                NEW.raw_user_meta_data->>'last_name'
            )
        )
    )
    RETURNING id INTO profile_id;
    
    -- Log de l'activité si la table existe
    BEGIN
        INSERT INTO public.user_activities (user_id, activity_type)
        VALUES (NEW.id, 'signup');
    EXCEPTION WHEN undefined_table THEN
        -- La table n'existe pas, ignorer silencieusement
        NULL;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Un seul trigger pour gérer la création d'utilisateur
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.handle_new_user();

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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own activities') THEN
        CREATE POLICY "Users can view their own activities" 
        ON public.user_activities FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Politique pour permettre au système d'insérer des activités
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can insert activities') THEN
        CREATE POLICY "System can insert activities" 
        ON public.user_activities FOR INSERT 
        WITH CHECK (true);
    END IF;
END $$;

