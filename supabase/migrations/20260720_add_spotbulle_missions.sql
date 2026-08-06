-- SCRIPT DE MISE À JOUR FORCÉE SPOTBULLE
-- Ce script supprime les anciennes tables pour garantir la présence de la colonne "territory".

-- 1. SUPPRESSION RADICALE (pour repartir sur une structure propre)
DROP TABLE IF EXISTS public.user_missions CASCADE;
DROP TABLE IF EXISTS public.user_skill_progress CASCADE;
DROP TABLE IF EXISTS public.skill_compatibility CASCADE;
DROP TABLE IF EXISTS public.skill_prerequisites CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;

-- 2. CRÉATION DE LA NOUVELLE ARCHITECTURE
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  territory TEXT NOT NULL,
  element TEXT NOT NULL,
  energy TEXT NOT NULL,
  sub_energy TEXT,
  pure_score REAL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.skill_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  prerequisite_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  UNIQUE(skill_id, prerequisite_id)
);

CREATE TABLE public.skill_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_a_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  skill_b_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  score_p REAL,
  score_c REAL,
  score_t REAL,
  score_d REAL,
  total_score REAL,
  is_forbidden BOOLEAN DEFAULT FALSE,
  UNIQUE(skill_a_id, skill_b_id)
);

CREATE TABLE public.user_skill_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  territory TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE public.user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_a UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  skill_b UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  mission_type TEXT NOT NULL,
  total_score REAL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  territory TEXT NOT NULL
);

-- 3. INSERTION DES COMPÉTENCES (VALENTINA)
INSERT INTO public.skills (name, territory, element, energy, sub_energy) VALUES 
('Imagination', 'Calyxis', 'Feu', 'ACTION', 'AGIR'),
('Créativité', 'Calyxis', 'Feu', 'ACTION', 'AGIR'),
('Innovation', 'Calyxis', 'Feu', 'ACTION', 'AGIR'),
('Initiative', 'Calyxis', 'Feu', 'ACTION', 'AGIR'),
('Résilience', 'Calyxis', 'Feu', 'ACTION', 'AGIR'),
('Pitch', 'Sylvara', 'Terre', 'ACTION', 'AGIR'),
('Prise de parole', 'Sylvara', 'Terre', 'ACTION', 'AGIR'),
('Argumentation', 'Sylvara', 'Terre', 'ACTION', 'AGIR'),
('Analyse', 'Sylvara', 'Terre', 'ACTION', 'AGIR'),
('Esprit critique', 'Sylvara', 'Terre', 'ACTION', 'AGIR'),
('Organisation', 'Cattleya', 'Air', 'ACTION', 'AGIR'),
('Gestion de projet', 'Cattleya', 'Air', 'ACTION', 'AGIR'),
('Leadership', 'Cattleya', 'Air', 'ACTION', 'AGIR'),
('Résolution de problèmes', 'Cattleya', 'Air', 'ACTION', 'AGIR'),
('Travail d''équipe', 'Neptunus', 'Eau', 'ACTION', 'AGIR'),
('Écoute', 'Neptunus', 'Eau', 'ACTION', 'AGIR'),
('Contribution', 'Neptunus', 'Eau', 'ACTION', 'AGIR'),
('Autonomie', 'Neptunus', 'Eau', 'ACTION', 'AGIR');

-- 4. INSERTION DE LA COMPATIBILITÉ (VALENTINA - 64 RELATIONS)
INSERT INTO public.skill_compatibility (skill_a_id, skill_b_id, score_p, score_c, score_t, score_d, total_score) VALUES 
((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 8.0, 10.0, 9.0, 8.0, 8.9),
((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 8.0, 9.0, 9.0, 8.0, 8.6),
((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 4.0, 5.0, 6.0, 7.0, 5.1),
((SELECT id FROM public.skills WHERE name = 'Imagination'), (SELECT id FROM public.skills WHERE name = 'Résilience'), 3.0, 5.0, 5.0, 6.0, 4.4),
((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 2.0, 5.0, 4.0, 6.0, 3.9),
((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 9.0, 9.0, 8.0, 8.0, 8.7),
((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 5.0, 6.0, 7.0, 7.0, 6.0),
((SELECT id FROM public.skills WHERE name = 'Créativité'), (SELECT id FROM public.skills WHERE name = 'Résilience'), 4.0, 5.0, 6.0, 7.0, 5.1),
((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 1.0, 4.0, 3.0, 7.0, 3.1),
((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 4.0, 6.0, 5.0, 5.0, 5.0),
((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 8.0, 8.0, 8.0, 7.0, 7.9),
((SELECT id FROM public.skills WHERE name = 'Innovation'), (SELECT id FROM public.skills WHERE name = 'Résilience'), 7.0, 8.0, 7.0, 8.0, 7.5),
((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 3.0, 4.0, 4.0, 5.0, 3.75),
((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 5.0, 4.0, 5.0, 5.0, 4.65),
((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 8.0, 8.0, 8.0, 7.0, 7.9),
((SELECT id FROM public.skills WHERE name = 'Initiative'), (SELECT id FROM public.skills WHERE name = 'Résilience'), 9.0, 9.0, 8.0, 8.0, 8.7),
((SELECT id FROM public.skills WHERE name = 'Résilience'), (SELECT id FROM public.skills WHERE name = 'Imagination'), 2.0, 4.0, 3.0, 6.0, 3.3),
((SELECT id FROM public.skills WHERE name = 'Résilience'), (SELECT id FROM public.skills WHERE name = 'Créativité'), 3.0, 5.0, 4.0, 5.0, 4.1),
((SELECT id FROM public.skills WHERE name = 'Résilience'), (SELECT id FROM public.skills WHERE name = 'Innovation'), 7.0, 6.0, 6.0, 6.0, 6.35),
((SELECT id FROM public.skills WHERE name = 'Résilience'), (SELECT id FROM public.skills WHERE name = 'Initiative'), 7.0, 8.0, 7.0, 6.0, 7.25),
((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 9.0, 9.0, 9.0, 8.0, 8.9),
((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 8.0, 10.0, 9.0, 8.0, 8.9),
((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 6.0, 7.0, 7.0, 8.0, 6.75),
((SELECT id FROM public.skills WHERE name = 'Pitch'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 6.0, 7.0, 7.0, 7.0, 6.65),
((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 3.0, 5.0, 4.0, 6.0, 4.2),
((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 10.0, 10.0, 9.0, 8.0, 9.6),
((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 6.0, 7.0, 7.0, 8.0, 6.75),
((SELECT id FROM public.skills WHERE name = 'Prise de parole'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 6.0, 7.0, 7.0, 5.0, 6.95),
((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 2.0, 4.0, 3.0, 6.0, 3.3),
((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 6.0, 5.0, 5.0, 5.0, 5.0),
((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 9.0, 9.0, 9.0, 8.0, 8.9),
((SELECT id FROM public.skills WHERE name = 'Argumentation'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 9.0, 10.0, 9.0, 8.0, 9.25),
((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 3.0, 4.0, 5.0, 6.0, 4.05),
((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 4.0, 5.0, 5.0, 6.0, 4.75),
((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 6.0, 7.0, 6.0, 7.0, 6.45),
((SELECT id FROM public.skills WHERE name = 'Analyse'), (SELECT id FROM public.skills WHERE name = 'Esprit critique'), 10.0, 10.0, 10.0, 8.0, 9.8),
((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Pitch'), 5.0, 4.0, 7.0, 3.0, 3.95),
((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Prise de parole'), 3.0, 5.0, 5.0, 6.0, 4.4),
((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Argumentation'), 5.0, 6.0, 6.0, 6.0, 5.65),
((SELECT id FROM public.skills WHERE name = 'Esprit critique'), (SELECT id FROM public.skills WHERE name = 'Analyse'), 7.0, 8.0, 8.0, 7.0, 7.55),
((SELECT id FROM public.skills WHERE name = 'Organisation'), (SELECT id FROM public.skills WHERE name = 'Gestion de projet'), 10.0, 10.0, 9.0, 9.0, 9.7),
((SELECT id FROM public.skills WHERE name = 'Organisation'), (SELECT id FROM public.skills WHERE name = 'Leadership'), 7.0, 8.0, 7.0, 6.0, 7.2),
((SELECT id FROM public.skills WHERE name = 'Organisation'), (SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), 8.0, 8.0, 8.0, 7.0, 7.9),
((SELECT id FROM public.skills WHERE name = 'Gestion de projet'), (SELECT id FROM public.skills WHERE name = 'Organisation'), 5.0, 5.0, 6.0, 4.0, 5.1),
((SELECT id FROM public.skills WHERE name = 'Gestion de projet'), (SELECT id FROM public.skills WHERE name = 'Leadership'), 8.0, 9.0, 8.0, 8.0, 8.2),
((SELECT id FROM public.skills WHERE name = 'Gestion de projet'), (SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), 8.0, 8.0, 8.0, 8.0, 8.0),
((SELECT id FROM public.skills WHERE name = 'Leadership'), (SELECT id FROM public.skills WHERE name = 'Organisation'), 4.0, 4.0, 5.0, 4.0, 4.2),
((SELECT id FROM public.skills WHERE name = 'Leadership'), (SELECT id FROM public.skills WHERE name = 'Gestion de projet'), 5.0, 6.0, 6.0, 5.0, 5.5),
((SELECT id FROM public.skills WHERE name = 'Leadership'), (SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), 6.0, 7.0, 6.0, 5.0, 6.2),
((SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), (SELECT id FROM public.skills WHERE name = 'Organisation'), 5.0, 5.0, 5.0, 4.0, 4.9),
((SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), (SELECT id FROM public.skills WHERE name = 'Gestion de projet'), 6.0, 6.0, 5.0, 5.0, 5.8),
((SELECT id FROM public.skills WHERE name = 'Résolution de problèmes'), (SELECT id FROM public.skills WHERE name = 'Leadership'), 7.0, 7.0, 6.0, 5.0, 6.6),
((SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), (SELECT id FROM public.skills WHERE name = 'Écoute'), 10.0, 10.0, 9.0, 9.0, 9.7),
((SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), (SELECT id FROM public.skills WHERE name = 'Contribution'), 9.0, 10.0, 9.0, 9.0, 9.3),
((SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), (SELECT id FROM public.skills WHERE name = 'Autonomie'), 6.0, 6.0, 6.0, 5.0, 6.0),
((SELECT id FROM public.skills WHERE name = 'Écoute'), (SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), 6.0, 6.0, 5.0, 5.0, 5.7),
((SELECT id FROM public.skills WHERE name = 'Écoute'), (SELECT id FROM public.skills WHERE name = 'Contribution'), 9.0, 9.0, 9.0, 8.0, 8.9),
((SELECT id FROM public.skills WHERE name = 'Écoute'), (SELECT id FROM public.skills WHERE name = 'Autonomie'), 6.0, 6.0, 6.0, 5.0, 6.0),
((SELECT id FROM public.skills WHERE name = 'Contribution'), (SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), 6.0, 6.0, 5.0, 5.0, 5.8),
((SELECT id FROM public.skills WHERE name = 'Contribution'), (SELECT id FROM public.skills WHERE name = 'Écoute'), 9.0, 9.0, 9.0, 8.0, 8.9),
((SELECT id FROM public.skills WHERE name = 'Contribution'), (SELECT id FROM public.skills WHERE name = 'Autonomie'), 7.0, 7.0, 8.0, 6.0, 7.1),
((SELECT id FROM public.skills WHERE name = 'Autonomie'), (SELECT id FROM public.skills WHERE name = 'Travail d''équipe'), 6.0, 6.0, 6.0, 5.0, 6.0),
((SELECT id FROM public.skills WHERE name = 'Autonomie'), (SELECT id FROM public.skills WHERE name = 'Écoute'), 6.0, 6.0, 6.0, 5.0, 6.0),
((SELECT id FROM public.skills WHERE name = 'Autonomie'), (SELECT id FROM public.skills WHERE name = 'Contribution'), 7.0, 7.0, 8.0, 6.0, 7.1);

-- 5. POLITIQUES RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_read_all" ON public.skills;
CREATE POLICY "skills_read_all" ON public.skills FOR SELECT USING (true);
DROP POLICY IF EXISTS "progress_all_own" ON public.user_skill_progress;
CREATE POLICY "progress_all_own" ON public.user_skill_progress FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "missions_all_own" ON public.user_missions;
CREATE POLICY "missions_all_own" ON public.user_missions FOR ALL USING (auth.uid() = user_id);
