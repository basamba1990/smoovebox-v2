-- Migration pour automatiser l'acquisition des compétences et la gestion des badges
-- Déclenchée lors du passage d'une mission à l'état 'completed'

CREATE OR REPLACE FUNCTION public.handle_mission_completion()
RETURNS TRIGGER AS $$
DECLARE
    skill_a_name TEXT;
    skill_b_name TEXT;
    territory_record RECORD;
BEGIN
    -- Ne traiter que si le statut passe à 'completed'
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        
        -- 1. Enregistrer la compétence A si elle n'est pas déjà acquise
        IF NEW.skill_a IS NOT NULL THEN
            INSERT INTO public.user_skill_progress (user_id, skill_id, territory)
            VALUES (NEW.user_id, NEW.skill_a, NEW.territory)
            ON CONFLICT (user_id, skill_id) DO NOTHING;
        END IF;

        -- 2. Enregistrer la compétence B si elle n'est pas déjà acquise (pour les missions hybrides)
        IF NEW.skill_b IS NOT NULL THEN
            INSERT INTO public.user_skill_progress (user_id, skill_id, territory)
            VALUES (NEW.user_id, NEW.skill_b, NEW.territory)
            ON CONFLICT (user_id, skill_id) DO NOTHING;
        END IF;

        -- 3. Vérifier et attribuer les badges de compétence
        -- Badge pour compétence A
        IF NEW.skill_a IS NOT NULL THEN
            INSERT INTO public.user_spotbulle_badges (user_id, badge_id)
            SELECT NEW.user_id, id 
            FROM public.spotbulle_badges 
            WHERE badge_type = 'competence' AND required_skill_id = NEW.skill_a
            ON CONFLICT (user_id, badge_id) DO NOTHING;
        END IF;

        -- Badge pour compétence B
        IF NEW.skill_b IS NOT NULL THEN
            INSERT INTO public.user_spotbulle_badges (user_id, badge_id)
            SELECT NEW.user_id, id 
            FROM public.spotbulle_badges 
            WHERE badge_type = 'competence' AND required_skill_id = NEW.skill_b
            ON CONFLICT (user_id, badge_id) DO NOTHING;
        END IF;

        -- 4. Vérifier si le territoire est complété pour attribuer le badge de territoire
        SELECT * INTO territory_record FROM public.spotbulle_territories WHERE territory = NEW.territory;
        
        IF territory_record IS NOT NULL THEN
            IF (
                SELECT COUNT(*) 
                FROM public.user_missions 
                WHERE user_id = NEW.user_id 
                AND territory = NEW.territory 
                AND status = 'completed'
            ) >= territory_record.required_missions THEN
                
                INSERT INTO public.user_spotbulle_badges (user_id, badge_id)
                SELECT NEW.user_id, id 
                FROM public.spotbulle_badges 
                WHERE badge_type = 'territory' AND territory = NEW.territory
                ON CONFLICT (user_id, badge_id) DO NOTHING;
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Création du trigger
DROP TRIGGER IF EXISTS trg_handle_mission_completion ON public.user_missions;
CREATE TRIGGER trg_handle_mission_completion
AFTER UPDATE ON public.user_missions
FOR EACH ROW
EXECUTE FUNCTION public.handle_mission_completion();

-- Note: La transition de niveau est gérée par le frontend et l'Edge Function via la vérification des missions complétées.
