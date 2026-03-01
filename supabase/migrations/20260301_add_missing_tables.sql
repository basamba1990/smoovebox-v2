-- MIGRATION: Ajout des tables manquantes et des politiques RLS
-- Date: 2026-03-01

-- ============================================================================
-- TABLE: user_lumia_profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_lumia_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  territoire TEXT DEFAULT 'Casablanca',
  feu_score INT DEFAULT 50 CHECK (feu_score >= 0 AND feu_score <= 100),
  air_score INT DEFAULT 50 CHECK (air_score >= 0 AND air_score <= 100),
  terre_score INT DEFAULT 50 CHECK (terre_score >= 0 AND terre_score <= 100),
  eau_score INT DEFAULT 50 CHECK (eau_score >= 0 AND eau_score <= 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- ============================================================================
-- TABLE: development_pathways
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.development_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pathway_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE: milestones
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id UUID NOT NULL REFERENCES public.development_pathways(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TABLE: talent_matches
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.talent_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  talent2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Assuming public.profiles exists
  compatibility_score INT DEFAULT 0 CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  reason TEXT,
  complementarity_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(talent1_id, talent2_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.user_lumia_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_matches ENABLE ROW LEVEL SECURITY;

-- Policies for user_lumia_profiles
CREATE POLICY "Users can view their own lumia profiles" ON public.user_lumia_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own lumia profiles" ON public.user_lumia_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own lumia profiles" ON public.user_lumia_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for development_pathways
CREATE POLICY "Users can view their own development pathways" ON public.development_pathways
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own development pathways" ON public.development_pathways
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own development pathways" ON public.development_pathways
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own development pathways" ON public.development_pathways
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for milestones
CREATE POLICY "Users can view milestones of their pathways" ON public.milestones
  FOR SELECT USING ((SELECT user_id FROM public.development_pathways WHERE id = pathway_id) = auth.uid());
CREATE POLICY "Users can insert milestones into their pathways" ON public.milestones
  FOR INSERT WITH CHECK ((SELECT user_id FROM public.development_pathways WHERE id = pathway_id) = auth.uid());
CREATE POLICY "Users can update milestones in their pathways" ON public.milestones
  FOR UPDATE USING ((SELECT user_id FROM public.development_pathways WHERE id = pathway_id) = auth.uid());
CREATE POLICY "Users can delete milestones from their pathways" ON public.milestones
  FOR DELETE USING ((SELECT user_id FROM public.development_pathways WHERE id = pathway_id) = auth.uid());

-- Policies for talent_matches
CREATE POLICY "Users can view their own talent matches" ON public.talent_matches
  FOR SELECT USING (auth.uid() = talent1_id OR auth.uid() = talent2_id);
CREATE POLICY "Users can insert talent matches" ON public.talent_matches
  FOR INSERT WITH CHECK (auth.uid() = talent1_id);
CREATE POLICY "Users can update their own talent matches" ON public.talent_matches
  FOR UPDATE USING (auth.uid() = talent1_id OR auth.uid() = talent2_id);
CREATE POLICY "Users can delete their own talent matches" ON public.talent_matches
  FOR DELETE USING (auth.uid() = talent1_id);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_lumia_profiles_user_id ON public.user_lumia_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_development_pathways_user_id ON public.development_pathways(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_pathway_id ON public.milestones(pathway_id);
CREATE INDEX IF NOT EXISTS idx_talent_matches_talent1_id ON public.talent_matches(talent1_id);
CREATE INDEX IF NOT EXISTS idx_talent_matches_talent2_id ON public.talent_matches(talent2_id);
