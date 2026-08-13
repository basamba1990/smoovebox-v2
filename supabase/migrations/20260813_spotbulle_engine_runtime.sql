-- Configuration et structures d'exécution du moteur Spotbulle.
-- Les règles pédagogiques de progression et de badges doivent être alimentées
-- par la matrice validée ; aucune relation n'est inventée ici.

CREATE TABLE IF NOT EXISTS public.spotbulle_engine_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  max_combinations INTEGER NOT NULL CHECK (max_combinations > 0),
  min_pure INTEGER NOT NULL CHECK (min_pure >= 0),
  min_hybrid INTEGER NOT NULL CHECK (min_hybrid >= 0),
  min_compatibility_score REAL NOT NULL CHECK (min_compatibility_score >= 0),
  max_skill_repetitions INTEGER NOT NULL CHECK (max_skill_repetitions > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.spotbulle_engine_config
  (id, max_combinations, min_pure, min_hybrid, min_compatibility_score, max_skill_repetitions)
VALUES (TRUE, 5, 2, 3, 6.0, 3)
ON CONFLICT (id) DO UPDATE SET
  max_combinations = EXCLUDED.max_combinations,
  min_pure = EXCLUDED.min_pure,
  min_hybrid = EXCLUDED.min_hybrid,
  min_compatibility_score = EXCLUDED.min_compatibility_score,
  max_skill_repetitions = EXCLUDED.max_skill_repetitions,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.spotbulle_progression_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level > 0),
  sub_level INTEGER NOT NULL CHECK (sub_level > 0),
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('active', 'acquired', 'blocked')),
  unlock_after_skill_id UUID REFERENCES public.skills(id) ON DELETE RESTRICT,
  source_reference TEXT NOT NULL,
  UNIQUE (territory, level, sub_level, skill_id)
);

CREATE TABLE IF NOT EXISTS public.spotbulle_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key TEXT NOT NULL UNIQUE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('territory', 'level', 'six_territories')),
  territory TEXT,
  level INTEGER,
  required_missions INTEGER CHECK (required_missions IS NULL OR required_missions > 0),
  required_skill_id UUID REFERENCES public.skills(id) ON DELETE RESTRICT,
  source_reference TEXT NOT NULL,
  CHECK (
    (badge_type = 'territory' AND territory IS NOT NULL)
    OR (badge_type = 'level' AND level IS NOT NULL)
    OR (badge_type = 'six_territories')
  )
);

CREATE TABLE IF NOT EXISTS public.user_spotbulle_badges (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.spotbulle_badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.spotbulle_engine_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotbulle_progression_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotbulle_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_spotbulle_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spotbulle_engine_config_read_authenticated" ON public.spotbulle_engine_config;
CREATE POLICY "spotbulle_engine_config_read_authenticated"
  ON public.spotbulle_engine_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "spotbulle_progression_read_authenticated" ON public.spotbulle_progression_matrix;
CREATE POLICY "spotbulle_progression_read_authenticated"
  ON public.spotbulle_progression_matrix FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "spotbulle_badges_read_authenticated" ON public.spotbulle_badges;
CREATE POLICY "spotbulle_badges_read_authenticated"
  ON public.spotbulle_badges FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "user_spotbulle_badges_own" ON public.user_spotbulle_badges;
CREATE POLICY "user_spotbulle_badges_own"
  ON public.user_spotbulle_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
