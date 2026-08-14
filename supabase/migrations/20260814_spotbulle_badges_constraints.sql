-- Répare les contraintes créées par 20260813_spotbulle_engine_runtime.sql.
-- Les badges de compétence exigent required_skill_id ; les badges de niveau exigent level.

ALTER TABLE public.spotbulle_badges
  DROP CONSTRAINT IF EXISTS spotbulle_badges_badge_type_check,
  DROP CONSTRAINT IF EXISTS spotbulle_badges_check,
  DROP CONSTRAINT IF EXISTS spotbulle_badges_requirements_check;

ALTER TABLE public.spotbulle_badges
  ADD CONSTRAINT spotbulle_badges_badge_type_check
    CHECK (badge_type IN ('territory', 'level', 'competence', 'six_territories')),
  ADD CONSTRAINT spotbulle_badges_requirements_check
    CHECK (
      (badge_type = 'territory' AND territory IS NOT NULL AND level IS NULL AND required_skill_id IS NULL)
      OR (badge_type = 'level' AND level IS NOT NULL AND territory IS NULL AND required_skill_id IS NULL)
      OR (badge_type = 'competence' AND required_skill_id IS NOT NULL AND territory IS NULL AND level IS NULL)
      OR (badge_type = 'six_territories' AND territory IS NULL AND level IS NULL AND required_skill_id IS NULL)
    );
