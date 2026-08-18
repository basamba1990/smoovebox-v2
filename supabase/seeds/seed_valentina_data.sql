-- Seed canonique généré depuis le PDF combiné de Valentina.
-- Source de vérité : modèle pédagogique + matrices de compétences et de décision.
-- Les paires sont ordonnées (AB et BA sont distinctes lorsque le PDF les distingue).
DROP TABLE IF EXISTS public.user_missions CASCADE;
DROP TABLE IF EXISTS public.user_skill_progress CASCADE;
DROP TABLE IF EXISTS public.skill_compatibility CASCADE;
DROP TABLE IF EXISTS public.skill_prerequisites CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;

CREATE TABLE public.skills (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, territory TEXT NOT NULL, element TEXT NOT NULL, energy TEXT NOT NULL, sub_energy TEXT, pure_score REAL DEFAULT 0.0, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE public.skill_prerequisites (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE, prerequisite_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE, UNIQUE(skill_id, prerequisite_id));
CREATE TABLE public.skill_compatibility (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), skill_a_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE, skill_b_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE, score_p REAL, score_c REAL, score_t REAL, score_d REAL, total_score REAL NOT NULL, is_forbidden BOOLEAN DEFAULT FALSE, UNIQUE(skill_a_id, skill_b_id));
CREATE TABLE public.user_skill_progress (user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE, acquired_at TIMESTAMPTZ DEFAULT now(), territory TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (user_id, skill_id));
CREATE TABLE public.user_missions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, skill_a UUID REFERENCES public.skills(id) ON DELETE SET NULL, skill_b UUID REFERENCES public.skills(id) ON DELETE SET NULL, mission_type TEXT NOT NULL, total_score REAL, status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now(), territory TEXT NOT NULL);

INSERT INTO public.skills (name, territory, element, energy, sub_energy, pure_score) VALUES
  ('Créativité', 'Calyxis', 'Feu', 'CRÉATION', 'CRÉER', 0),
  ('Innovation', 'Calyxis', 'Feu', 'CRÉATION', 'CRÉER', 0),
  ('Imagination', 'Calyxis', 'Feu', 'CRÉATION', 'CRÉER', 0),
  ('Initiative', 'Calyxis', 'Feu', 'ACTION', 'AGIR', 0),
  ('Persévérance', 'Calyxis', 'Feu', 'ACTION', 'AGIR', 0),
  ('Organisation', 'Cattleya', 'Terre', 'CRÉATION', 'PILOTER', 0),
  ('Gestion de projet', 'Cattleya', 'Terre', 'CRÉATION', 'PILOTER', 0),
  ('Leadership', 'Cattleya', 'Terre', 'CRÉATION', 'PILOTER', 0),
  ('Résolution de problèmes', 'Cattleya', 'Terre', 'ACTION', 'RÉSOUDRE', 0),
  ('Pitch', 'Sylvara', 'Air', 'COOPERATION_COMMUNICATION', 'COMMUNIQUER', 0),
  ('Prise de parole', 'Sylvara', 'Air', 'COOPERATION_COMMUNICATION', 'COMMUNIQUER', 0),
  ('Argumentation', 'Sylvara', 'Air', 'COOPERATION_COMMUNICATION', 'COMMUNIQUER', 0),
  ('Analyse', 'Sylvara', 'Air', 'ACTION', 'RÉSOUDRE', 0),
  ('Esprit critique', 'Sylvara', 'Air', 'ACTION', 'RÉSOUDRE', 0),
  ('Travail d''équipe', 'Neptunus', 'Eau', 'COOPERATION_COMMUNICATION', 'COOPÉRER', 0),
  ('Écoute', 'Neptunus', 'Eau', 'COOPERATION_COMMUNICATION', 'COOPÉRER', 0),
  ('Contribution', 'Neptunus', 'Eau', 'COOPERATION_COMMUNICATION', 'COOPÉRER', 0),
  ('Autonomie', 'Neptunus', 'Eau', 'ACTION', 'AGIR', 0);

INSERT INTO public.skill_compatibility (skill_a_id, skill_b_id, score_p, score_c, score_t, score_d, total_score) VALUES
  ((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 9, 9, 8, 8, 8.7),
  ((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 2, 5, 4, 6, 3.9),
  ((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 5, 6, 7, 7, 6),
  ((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Persévérance'), 4, 5, 6, 7, 5.1),
  ((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 4, 6, 5, 5, 5),
  ((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 1, 4, 3, 7, 3.1),
  ((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 8, 8, 8, 7, 7.9),
  ((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Persévérance'), 7, 8, 7, 8, 7.5),
  ((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 8, 10, 9, 8, 8.9),
  ((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 8, 9, 9, 8, 8.6),
  ((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 4, 5, 6, 7, 5.1),
  ((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Persévérance'), 3, 5, 5, 6, 4.4),
  ((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 5, 4, 5, 5, 4.7),
  ((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 8, 8, 8, 7, 7.9),
  ((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 3, 4, 4, 5, 3.8),
  ((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Persévérance'), 9, 9, 8, 8, 8.7),
  ((SELECT id FROM public.skills WHERE name = 'Persévérance'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 3, 5, 4, 5, 4.1),
  ((SELECT id FROM public.skills WHERE name = 'Persévérance'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 7, 6, 6, 6, 6.35),
  ((SELECT id FROM public.skills WHERE name = 'Persévérance'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 2, 4, 3, 6, 3.3),
  ((SELECT id FROM public.skills WHERE name = 'Persévérance'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 7, 8, 7, 6, 7.25),
  ((SELECT id FROM public.skills WHERE name = 'Organisation'), (SELECT id FROM public.skills WHERE name = 'Gestion de projet'), 10, 10, 9, 9, 9.7),
  ((SELECT id FROM public.skills WHERE name = 'Organisation'), (SELECT id FROM public.skills WHERE name = 'Leadership'), 7, 8, 6, 7, 7.15),
  ((SELECT id FROM public.skills WHERE name = 'Organisation'), (SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), 8, 8, 8, 7, 7.9),
  ((SELECT id FROM public.skills WHERE name = 'Gestion de projet'), (SELECT id FROM public.skills WHERE name = 'Organisation'), 4, 6, 5, 6, 5.1),
  ((SELECT id FROM public.skills WHERE name = 'Gestion de projet'), (SELECT id FROM public.skills WHERE name = 'Leadership'), 8, 9, 7, 8, 8.15),
  ((SELECT id FROM public.skills WHERE name = 'Gestion de projet'), (SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), 8, 8, 8, 8, 8),
  ((SELECT id FROM public.skills WHERE name = 'Leadership'), (SELECT id FROM public.skills WHERE name = 'Organisation'), 3, 5, 4, 6, 4.2),
  ((SELECT id FROM public.skills WHERE name = 'Leadership'), (SELECT id FROM public.skills WHERE name = 'Gestion de projet'), 5, 6, 5, 6, 5.45),
  ((SELECT id FROM public.skills WHERE name = 'Leadership'), (SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), 6, 6, 7, 6, 6.2),
  ((SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), (SELECT id FROM public.skills WHERE name = 'Organisation'), 4, 5, 6, 5, 4.85),
  ((SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), (SELECT id FROM public.skills WHERE name = 'Gestion de projet'), 5, 6, 6, 7, 5.75),
  ((SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), (SELECT id FROM public.skills WHERE name = 'Leadership'), 6, 7, 7, 6, 6.55),
  ((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 9, 9, 9, 8, 8.9),
  ((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 8, 10, 9, 8, 8.9),
  ((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 6, 7, 7, 8, 6.8),
  ((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 6, 7, 7, 7, 6.7),
  ((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 3, 5, 4, 6, 4.2),
  ((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 10, 10, 9, 8, 9.6),
  ((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 6, 7, 7, 8, 6.8),
  ((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 5, 6, 7, 7, 6),
  ((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 2, 4, 3, 6, 3.3),
  ((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 4, 6, 5, 5, 5),
  ((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 9, 9, 9, 8, 8.9),
  ((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 9, 10, 9, 8, 9.3),
  ((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 3, 4, 5, 6, 4.1),
  ((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 4, 5, 5, 6, 4.8),
  ((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 6, 7, 6, 7, 6.5),
  ((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 10, 10, 10, 8, 9.8),
  ((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 2, 5, 4, 7, 4),
  ((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 3, 5, 5, 6, 4.4),
  ((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 5, 6, 6, 6, 5.65),
  ((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 7, 8, 8, 7, 7.55),
  ((SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), (SELECT id FROM public.skills WHERE name = 'Écoute'), 10, 10, 9, 9, 9.7),
  ((SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), (SELECT id FROM public.skills WHERE name = 'Contribution'), 9, 10, 9, 8, 9.25),
  ((SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), (SELECT id FROM public.skills WHERE name = 'Autonomie'), 5, 6, 7, 7, 5.95),
  ((SELECT id FROM public.skills WHERE name = 'Écoute'), (SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), 5, 6, 6, 6, 5.65),
  ((SELECT id FROM public.skills WHERE name = 'Écoute'), (SELECT id FROM public.skills WHERE name = 'Contribution'), 9, 9, 9, 8, 8.9),
  ((SELECT id FROM public.skills WHERE name = 'Écoute'), (SELECT id FROM public.skills WHERE name = 'Autonomie'), 5, 6, 7, 7, 5.95),
  ((SELECT id FROM public.skills WHERE name = 'Contribution'), (SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), 4, 5, 9, 8, 5.75),
  ((SELECT id FROM public.skills WHERE name = 'Contribution'), (SELECT id FROM public.skills WHERE name = 'Écoute'), 9, 9, 9, 8, 8.9),
  ((SELECT id FROM public.skills WHERE name = 'Contribution'), (SELECT id FROM public.skills WHERE name = 'Autonomie'), 7, 7, 7, 8, 7.1),
  ((SELECT id FROM public.skills WHERE name = 'Autonomie'), (SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), 5, 6, 7, 7, 5.95),
  ((SELECT id FROM public.skills WHERE name = 'Autonomie'), (SELECT id FROM public.skills WHERE name = 'Écoute'), 5, 6, 7, 7, 5.95),
  ((SELECT id FROM public.skills WHERE name = 'Autonomie'), (SELECT id FROM public.skills WHERE name = 'Contribution'), 7, 7, 7, 8, 7.1);

-- Le PDF ne définit aucune relation compétence-prérequis explicite.
-- La table reste vide jusqu’à validation pédagogique d’une matrice de prérequis.

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "skills_read_all" ON public.skills;
CREATE POLICY "skills_read_all" ON public.skills FOR SELECT USING (true);
DROP POLICY IF EXISTS "progress_all_own" ON public.user_skill_progress;
CREATE POLICY "progress_all_own" ON public.user_skill_progress FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "missions_all_own" ON public.user_missions;
CREATE POLICY "missions_all_own" ON public.user_missions FOR ALL USING (auth.uid() = user_id);
