-- Persistance opérationnelle de la progression Spotbulle.
-- Une compétence validée est acquise une seule fois et le niveau correspondant
-- est déterminé par les étapes persistées de Valentina.

CREATE OR REPLACE FUNCTION public.handle_mission_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_pure_count INTEGER;
  completed_territory_pure_count INTEGER;
  current_level INTEGER;
  skill_id_value UUID;
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    FOREACH skill_id_value IN ARRAY ARRAY[NEW.skill_a, NEW.skill_b]
    LOOP
      IF skill_id_value IS NOT NULL THEN
        INSERT INTO public.user_skill_progress (user_id, skill_id, territory, level)
        VALUES (NEW.user_id, skill_id_value, NEW.territory, 1)
        ON CONFLICT (user_id, skill_id) DO NOTHING;
      END IF;
    END LOOP;

    SELECT COUNT(*)
      INTO completed_pure_count
      FROM public.user_missions
     WHERE user_id = NEW.user_id
       AND status = 'completed'
       AND mission_type = 'pure';

    SELECT COUNT(*)
      INTO completed_territory_pure_count
      FROM public.user_missions
     WHERE user_id = NEW.user_id
       AND territory = NEW.territory
       AND status = 'completed'
       AND mission_type = 'pure';

    SELECT COALESCE(MAX(level), 1)
      INTO current_level
      FROM public.spotbulle_progression_stages
     WHERE sub_level_end <= completed_pure_count;

    UPDATE public.user_skill_progress
       SET level = current_level
     WHERE user_id = NEW.user_id
       AND territory = NEW.territory;

    INSERT INTO public.user_spotbulle_badges (user_id, badge_id)
    SELECT NEW.user_id, badge.id
      FROM public.spotbulle_badges AS badge
     WHERE badge.badge_type = 'competence'
       AND badge.required_skill_id IN (NEW.skill_a, NEW.skill_b)
    ON CONFLICT (user_id, badge_id) DO NOTHING;

    INSERT INTO public.user_spotbulle_badges (user_id, badge_id)
    SELECT NEW.user_id, badge.id
      FROM public.spotbulle_badges AS badge
     WHERE badge.badge_type = 'territory'
       AND badge.territory = NEW.territory
       AND completed_territory_pure_count >= COALESCE(badge.required_missions, 0)
    ON CONFLICT (user_id, badge_id) DO NOTHING;

    INSERT INTO public.user_spotbulle_badges (user_id, badge_id)
    SELECT NEW.user_id, badge.id
      FROM public.spotbulle_badges AS badge
      JOIN public.spotbulle_progression_stages AS stage
        ON stage.level = badge.level
     WHERE badge.badge_type = 'level'
       AND completed_pure_count >= stage.sub_level_end
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_mission_completion ON public.user_missions;
CREATE TRIGGER trg_handle_mission_completion
AFTER INSERT OR UPDATE OF status ON public.user_missions
FOR EACH ROW
EXECUTE FUNCTION public.handle_mission_completion();

-- Le moteur doit respecter la règle produit : cinq missions pures avant toute hybride.
UPDATE public.spotbulle_engine_config
   SET min_pure = 5,
       updated_at = now()
 WHERE id = TRUE;

COMMENT ON FUNCTION public.handle_mission_completion() IS
  'Persiste les compétences acquises, met à jour le niveau de progression et attribue les badges après une mission pure ou hybride complétée.';
