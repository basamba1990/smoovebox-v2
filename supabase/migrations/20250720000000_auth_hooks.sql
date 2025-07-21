-- Fonction pour le hook before_user_created
CREATE OR REPLACE FUNCTION auth.before_user_created()
RETURNS TRIGGER AS $$
DECLARE
    username_base TEXT;
    username_suffix INT := 1;
    new_username TEXT;
BEGIN
    -- Générer un nom d'utilisateur unique
    username_base := LOWER(SPLIT_PART(NEW.email, '@', 1));
    new_username := username_base;
    
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
        new_username := username_base || username_suffix;
        username_suffix := username_suffix + 1;
    END LOOP;
    
    -- Créer le profil utilisateur
    INSERT INTO public.profiles (user_id, email, username, full_name)
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
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour le hook after_user_created
CREATE OR REPLACE FUNCTION auth.after_user_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Envoyer un email de bienvenue
    PERFORM net.http_post(
        url := 'https://your-api.com/send-welcome-email',
        body := jsonb_build_object(
            'email', NEW.email,
            'name', COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                CONCAT(
                    NEW.raw_user_meta_data->>'first_name', 
                    ' ', 
                    NEW.raw_user_meta_data->>'last_name'
                )
            )
        )
    );
    
    -- Autres actions post-création
    INSERT INTO public.user_activities (user_id, activity_type)
    VALUES (NEW.id, 'signup');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déclencheurs pour les hooks
CREATE TRIGGER before_user_created_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.before_user_created();

CREATE TRIGGER after_user_created_trigger
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.after_user_created();
