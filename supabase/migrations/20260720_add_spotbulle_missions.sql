-- 20260720_add_spotbulle_missions.sql
-- Moteur d'acquisition des compétences Spotbulle (Univers Lumia)

-- 1. Table des compétences
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  territory TEXT NOT NULL CHECK (territory IN ('Calyxis', 'Cattleya', 'Sylvara', 'Neptunus')),
  element TEXT NOT NULL CHECK (element IN ('Feu', 'Air', 'Terre', 'Eau')),
  energy TEXT NOT NULL,
  pure_score REAL DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skills_territory ON public.skills(territory);

-- 2. Table des prérequis (graphe orienté)
CREATE TABLE public.skill_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  prerequisite_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  CHECK (skill_id <> prerequisite_id),
  UNIQUE(skill_id, prerequisite_id)
);

-- 3. Matrice de compatibilité (pondération P=0.35 C=0.35 T=0.2 D=0.1)
CREATE TABLE public.skill_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_a UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  skill_b UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  score_p REAL NOT NULL CHECK (score_p BETWEEN 0 AND 10),
  score_c REAL NOT NULL CHECK (score_c BETWEEN 0 AND 10),
  score_t REAL NOT NULL CHECK (score_t BETWEEN 0 AND 10),
  score_d REAL NOT NULL CHECK (score_d BETWEEN 0 AND 10),
  total_score REAL GENERATED ALWAYS AS (
    (0.35 * score_p) + (0.35 * score_c) + (0.20 * score_t) + (0.10 * score_d)
  ) STORED,
  is_forbidden BOOLEAN DEFAULT FALSE,
  UNIQUE(skill_a, skill_b),
  CHECK (skill_a <> skill_b)
);

CREATE INDEX idx_compatibility_skill_a ON public.skill_compatibility(skill_a);
CREATE INDEX idx_compatibility_skill_b ON public.skill_compatibility(skill_b);

-- 4. Progression utilisateur (acumul des acquis A_t)
CREATE TABLE public.user_skill_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  territory TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, skill_id)
);

-- 5. Missions générées (résultat du solveur)
CREATE TABLE public.user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_a UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  skill_b UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('pure', 'hybrid')),
  total_score REAL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  territory TEXT NOT NULL
);

CREATE INDEX idx_missions_user_id ON public.user_missions(user_id);

-- RLS Policies
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- Skills : lecture publique
DROP POLICY IF EXISTS "skills_read_all" ON public.skills;
CREATE POLICY "skills_read_all" ON public.skills FOR SELECT USING (true);

-- Prerequisites : lecture publique
DROP POLICY IF EXISTS "prerequisites_read_all" ON public.skill_prerequisites;
CREATE POLICY "prerequisites_read_all" ON public.skill_prerequisites FOR SELECT USING (true);

-- Compatibility : lecture publique
DROP POLICY IF EXISTS "compatibility_read_all" ON public.skill_compatibility;
CREATE POLICY "compatibility_read_all" ON public.skill_compatibility FOR SELECT USING (true);

-- User progress : lecture/écriture par l'utilisateur
DROP POLICY IF EXISTS "progress_select_own" ON public.user_skill_progress;
CREATE POLICY "progress_select_own" ON public.user_skill_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "progress_insert_own" ON public.user_skill_progress;
CREATE POLICY "progress_insert_own" ON public.user_skill_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User missions : lecture/écriture par l'utilisateur
DROP POLICY IF EXISTS "missions_select_own" ON public.user_missions;
CREATE POLICY "missions_select_own" ON public.user_missions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "missions_insert_own" ON public.user_missions;
CREATE POLICY "missions_insert_own" ON public.user_missions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "missions_update_own" ON public.user_missions;
CREATE POLICY "missions_update_own" ON public.user_missions FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.skills IS 'Compétences du XXIe siècle associées aux territoires Lumia';
COMMENT ON TABLE public.skill_compatibility IS 'Matrice de compatibilité pondérée (P=0.35 C=0.35 T=0.2 D=0.1)';
COMMENT ON TABLE public.user_missions IS 'Missions générées par le solveur d''optimisation Spotbulle';
