-- Données lisibles dans la matrice envoyée par Valentina.
-- Cette migration ne crée pas de badges par mission : l'image indique « A DEFINIR ».

UPDATE public.spotbulle_territories
SET element = CASE territory
  WHEN 'Sylvara' THEN 'Terre'
  WHEN 'Cattleya' THEN 'Air'
  ELSE element
END;

UPDATE public.skills
SET element = CASE territory
  WHEN 'Sylvara' THEN 'Terre'
  WHEN 'Cattleya' THEN 'Air'
  ELSE element
END;

CREATE TABLE IF NOT EXISTS public.spotbulle_progression_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_key TEXT NOT NULL UNIQUE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
  level_label TEXT NOT NULL,
  sub_level_start INTEGER NOT NULL CHECK (sub_level_start BETWEEN 1 AND 15),
  sub_level_end INTEGER NOT NULL CHECK (sub_level_end BETWEEN sub_level_start AND 15),
  territory TEXT REFERENCES public.spotbulle_territories(territory) ON DELETE RESTRICT,
  element TEXT,
  activated_sub_energy_a TEXT,
  activated_sub_energy_b TEXT,
  unlock_event TEXT NOT NULL,
  source_reference TEXT NOT NULL
);

INSERT INTO public.spotbulle_progression_stages
  (stage_key, level, level_label, sub_level_start, sub_level_end, territory, element, activated_sub_energy_a, activated_sub_energy_b, unlock_event, source_reference)
VALUES
  ('level-1-explorateur', 1, 'Explorateur', 1, 2, NULL, NULL, 'CRÉER', 'AGIR', 'Créer + agir', 'Matrice Valentina — Tableau 2'),
  ('level-2-eclaireur', 2, 'Éclaireur', 3, 5, 'Calyxis', 'Feu', NULL, NULL, 'Territoire FEU « Calyxis » débloqué', 'Matrice Valentina — Tableau 2'),
  ('level-3-ambassadeur', 3, 'Ambassadeur', 6, 8, 'Sylvara', 'Terre', 'COMMUNIQUER', 'RÉSOUDRE', 'Communiquer + résoudre ; territoire TERRE « Sylvara » débloqué', 'Matrice Valentina — Tableau 2'),
  ('level-4-stratege', 4, 'Stratège', 9, 11, 'Cattleya', 'Air', 'PILOTER', 'RÉSOUDRE', 'Piloter + résoudre ; territoire AIR « Cattleya » débloqué', 'Matrice Valentina — Tableau 2'),
  ('level-5-mentor', 5, 'Mentor', 12, 14, 'Neptunus', 'Eau', 'COOPÉRER', 'AGIR', 'Coopérer + agir ; territoire EAU « Neptunus » débloqué', 'Matrice Valentina — Tableau 2'),
  ('level-6-capitaine-lumia', 6, 'Capitaine Lumia', 15, 15, NULL, NULL, NULL, NULL, 'Badge de niveau VI Capitaine Lumia débloqué', 'Matrice Valentina — Tableau 2')
ON CONFLICT (stage_key) DO UPDATE SET
  level = EXCLUDED.level,
  level_label = EXCLUDED.level_label,
  sub_level_start = EXCLUDED.sub_level_start,
  sub_level_end = EXCLUDED.sub_level_end,
  territory = EXCLUDED.territory,
  element = EXCLUDED.element,
  activated_sub_energy_a = EXCLUDED.activated_sub_energy_a,
  activated_sub_energy_b = EXCLUDED.activated_sub_energy_b,
  unlock_event = EXCLUDED.unlock_event,
  source_reference = EXCLUDED.source_reference;

ALTER TABLE public.spotbulle_badges DROP CONSTRAINT IF EXISTS spotbulle_badges_badge_type_check;
ALTER TABLE public.spotbulle_badges ADD CONSTRAINT spotbulle_badges_badge_type_check
  CHECK (badge_type IN ('territory', 'level', 'competence', 'six_territories'));

INSERT INTO public.spotbulle_badges (badge_key, badge_type, territory, level, required_missions, required_skill_id, source_reference)
SELECT 'level:' || level::text, 'level', NULL, level, NULL, NULL, 'Matrice Valentina — 6 badges par niveaux'
FROM (VALUES
  (1), (2), (3), (4), (5), (6)
) AS levels(level)
ON CONFLICT (badge_key) DO UPDATE SET
  badge_type = EXCLUDED.badge_type,
  level = EXCLUDED.level,
  source_reference = EXCLUDED.source_reference;

INSERT INTO public.spotbulle_badges (badge_key, badge_type, territory, level, required_missions, required_skill_id, source_reference)
SELECT 'territory:' || territory, 'territory', territory, NULL, required_missions, NULL, 'Matrice Valentina — 4 badges par territoire'
FROM public.spotbulle_territories
ON CONFLICT (badge_key) DO UPDATE SET
  badge_type = EXCLUDED.badge_type,
  territory = EXCLUDED.territory,
  required_missions = EXCLUDED.required_missions,
  source_reference = EXCLUDED.source_reference;

INSERT INTO public.spotbulle_badges (badge_key, badge_type, territory, level, required_missions, required_skill_id, source_reference)
SELECT 'competence:' || id::text, 'competence', NULL, NULL, NULL, id, 'Matrice Valentina — 18 badges par compétences'
FROM public.skills
ON CONFLICT (badge_key) DO UPDATE SET
  badge_type = EXCLUDED.badge_type,
  required_skill_id = EXCLUDED.required_skill_id,
  source_reference = EXCLUDED.source_reference;

ALTER TABLE public.spotbulle_progression_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spotbulle_progression_stages_read_authenticated" ON public.spotbulle_progression_stages;
CREATE POLICY "spotbulle_progression_stages_read_authenticated"
  ON public.spotbulle_progression_stages FOR SELECT TO authenticated USING (true);
