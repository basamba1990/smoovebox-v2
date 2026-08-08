-- Alignement du modèle d'énergie avec le tableau pédagogique de Valentina.
-- Migration non destructive : elle conserve les identifiants et les matrices existantes.

UPDATE public.skills
SET energy = CASE
  WHEN name IN ('Créativité', 'Innovation', 'Imagination') THEN 'CRÉATION'
  WHEN name IN ('Initiative', 'Persévérance', 'Résilience') THEN 'ACTION'
  WHEN name IN ('Pitch', 'Prise de parole', 'Argumentation', 'Travail d''équipe', 'Écoute', 'Contribution') THEN 'COOPERATION_COMMUNICATION'
  WHEN name IN ('Organisation', 'Gestion de projet', 'Leadership') THEN 'CRÉATION'
  WHEN name IN ('Analyse', 'Esprit critique', 'Résolution de problèmes', 'Autonomie') THEN 'ACTION'
  ELSE energy
END,
sub_energy = CASE
  WHEN name IN ('Créativité', 'Innovation', 'Imagination') THEN 'CRÉER'
  WHEN name IN ('Initiative', 'Persévérance', 'Résilience') THEN 'AGIR'
  WHEN name IN ('Pitch', 'Prise de parole', 'Argumentation') THEN 'COMMUNIQUER'
  WHEN name IN ('Travail d''équipe', 'Écoute', 'Contribution') THEN 'COOPÉRER'
  WHEN name IN ('Organisation', 'Gestion de projet', 'Leadership') THEN 'PILOTER'
  WHEN name IN ('Analyse', 'Esprit critique', 'Résolution de problèmes') THEN 'RÉSOUDRE'
  WHEN name = 'Autonomie' THEN 'AGIR'
  ELSE sub_energy
END;

-- Le modèle de référence utilise Persévérance. On conserve Résilience comme
-- compatibilité de lecture pour les données historiques déjà présentes.
UPDATE public.skills
SET name = 'Persévérance'
WHERE name = 'Résilience'
  AND NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Persévérance');

CREATE INDEX IF NOT EXISTS idx_skills_territory_energy
  ON public.skills (territory, energy, sub_energy);

CREATE INDEX IF NOT EXISTS idx_user_missions_user_territory_status
  ON public.user_missions (user_id, territory, status);

COMMENT ON COLUMN public.user_missions.total_score IS
  'Score interne réservé à la validation pédagogique et à l’administration; ne pas afficher à l’utilisateur final.';
