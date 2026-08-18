-- Scores PCTD détaillés transcrits des documents Valentina présents dans Docs/.
-- Les paires sont orientées : A->B et B->A restent distinctes.

WITH values_a(name_a, name_b, p, c, t, d, total_score) AS (
  VALUES
    ('Organisation', 'Gestion de projet', 10.0, 10.0, 9.0, 9.0, 9.7),
    ('Organisation', 'Leadership', 7.0, 8.0, 6.0, 7.0, 7.15),
    ('Organisation', 'Résolution de problèmes', 8.0, 8.0, 8.0, 7.0, 7.9),
    ('Gestion de projet', 'Organisation', 4.0, 6.0, 5.0, 6.0, 5.1),
    ('Gestion de projet', 'Leadership', 8.0, 9.0, 7.0, 8.0, 8.15),
    ('Gestion de projet', 'Résolution de problèmes', 8.0, 8.0, 8.0, 8.0, 8.0),
    ('Leadership', 'Organisation', 3.0, 5.0, 4.0, 6.0, 4.2),
    ('Leadership', 'Gestion de projet', 5.0, 6.0, 5.0, 6.0, 5.45),
    ('Leadership', 'Résolution de problèmes', 6.0, 6.0, 7.0, 6.0, 6.2),
    ('Résolution de problèmes', 'Organisation', 4.0, 5.0, 6.0, 5.0, 4.85),
    ('Résolution de problèmes', 'Gestion de projet', 5.0, 6.0, 6.0, 7.0, 5.75),
    ('Résolution de problèmes', 'Leadership', 6.0, 7.0, 7.0, 6.0, 6.55),
    ('Travail d''équipe', 'Écoute', 10.0, 10.0, 9.0, 9.0, 9.7),
    ('Travail d''équipe', 'Contribution', 9.0, 10.0, 9.0, 8.0, 9.25),
    ('Travail d''équipe', 'Autonomie', 5.0, 6.0, 7.0, 7.0, 5.95),
    ('Écoute', 'Travail d''équipe', 5.0, 6.0, 6.0, 6.0, 5.65),
    ('Écoute', 'Contribution', 9.0, 9.0, 9.0, 8.0, 8.9),
    ('Écoute', 'Autonomie', 5.0, 6.0, 7.0, 7.0, 5.95),
    ('Contribution', 'Travail d''équipe', 4.0, 5.0, 9.0, 8.0, 5.75),
    ('Contribution', 'Écoute', 9.0, 9.0, 9.0, 8.0, 8.9),
    ('Contribution', 'Autonomie', 7.0, 7.0, 7.0, 8.0, 7.1),
    ('Autonomie', 'Travail d''équipe', 5.0, 6.0, 7.0, 7.0, 5.95),
    ('Autonomie', 'Écoute', 5.0, 6.0, 7.0, 7.0, 5.95),
    ('Autonomie', 'Contribution', 7.0, 7.0, 7.0, 8.0, 7.1)
)
UPDATE public.skill_compatibility AS compatibility
SET score_p = values_a.p,
    score_c = values_a.c,
    score_t = values_a.t,
    score_d = values_a.d,
    total_score = values_a.total_score
FROM values_a
JOIN public.skills AS skill_a ON skill_a.name = values_a.name_a
JOIN public.skills AS skill_b ON skill_b.name = values_a.name_b
WHERE compatibility.skill_a_id = skill_a.id
  AND compatibility.skill_b_id = skill_b.id;

DO $$
DECLARE
  expected_count INTEGER := 24;
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.skill_compatibility AS compatibility
  JOIN public.skills AS skill_a ON skill_a.id = compatibility.skill_a_id
  JOIN public.skills AS skill_b ON skill_b.id = compatibility.skill_b_id
  WHERE (skill_a.territory = 'Cattleya' AND skill_b.territory = 'Cattleya')
     OR (skill_a.territory = 'Neptunus' AND skill_b.territory = 'Neptunus');
  IF updated_count < expected_count THEN
    RAISE EXCEPTION 'La matrice AIR/EAU est incomplète : % paires trouvées, % attendues', updated_count, expected_count;
  END IF;
END $$;
