-- Fonction pour créer automatiquement un profil
CREATE OR REPLACE FUNCTION auth.before_user_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour l'inscription
CREATE TRIGGER before_user_created_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION auth.before_user_created();
