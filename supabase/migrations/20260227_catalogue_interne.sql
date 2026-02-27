-- CATALOGUE INTERNE - Suivi de progression utilisateur
-- Date: 2026-02-27

-- ============================================================================
-- TABLE: Progression Catalogue
-- ============================================================================
CREATE TABLE IF NOT EXISTS catalogue_progression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_etape INT NOT NULL DEFAULT 1 CHECK (current_etape >= 1 AND current_etape <= 10),
  completed_etapes INT[] DEFAULT '{}',
  etape_data JSONB DEFAULT '{}',
  started_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(user_id)
);

-- ============================================================================
-- TABLE: Étape Completion
-- ============================================================================
CREATE TABLE IF NOT EXISTS etape_completion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etape_id INT NOT NULL CHECK (etape_id >= 1 AND etape_id <= 10),
  module_name TEXT,
  data JSONB DEFAULT '{}',
  completed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, etape_id)
);

-- ============================================================================
-- TABLE: Énergie Scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS energie_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feu INT DEFAULT 50 CHECK (feu >= 0 AND feu <= 100),
  air INT DEFAULT 50 CHECK (air >= 0 AND air <= 100),
  terre INT DEFAULT 50 CHECK (terre >= 0 AND terre <= 100),
  eau INT DEFAULT 50 CHECK (eau >= 0 AND eau <= 100),
  balance_score INT DEFAULT 50,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- TABLE: Étape Data
-- ============================================================================
CREATE TABLE IF NOT EXISTS etape_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etape_id INT NOT NULL CHECK (etape_id >= 1 AND etape_id <= 10),
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, etape_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_catalogue_progression_user_id ON catalogue_progression(user_id);
CREATE INDEX IF NOT EXISTS idx_catalogue_progression_current_etape ON catalogue_progression(current_etape);
CREATE INDEX IF NOT EXISTS idx_etape_completion_user_id ON etape_completion(user_id);
CREATE INDEX IF NOT EXISTS idx_etape_completion_etape_id ON etape_completion(etape_id);
CREATE INDEX IF NOT EXISTS idx_energie_scores_user_id ON energie_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_etape_data_user_id ON etape_data(user_id);
CREATE INDEX IF NOT EXISTS idx_etape_data_etape_id ON etape_data(etape_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE catalogue_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE etape_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE energie_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE etape_data ENABLE ROW LEVEL SECURITY;

-- Catalogue Progression
CREATE POLICY "Users see own catalogue progression" ON catalogue_progression
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own catalogue progression" ON catalogue_progression
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own catalogue progression" ON catalogue_progression
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Étape Completion
CREATE POLICY "Users see own etape completion" ON etape_completion
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own etape completion" ON etape_completion
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Énergie Scores
CREATE POLICY "Users see own energie scores" ON energie_scores
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own energie scores" ON energie_scores
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own energie scores" ON energie_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Étape Data
CREATE POLICY "Users see own etape data" ON etape_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own etape data" ON etape_data
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own etape data" ON etape_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Fonction pour calculer le score d'équilibre énergétique
CREATE OR REPLACE FUNCTION calculate_energie_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance_score := ROUND((NEW.feu + NEW.air + NEW.terre + NEW.eau) / 4.0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_energie_balance
BEFORE INSERT OR UPDATE ON energie_scores
FOR EACH ROW
EXECUTE FUNCTION calculate_energie_balance();

-- Fonction pour mettre à jour la date de modification
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_catalogue_timestamp
BEFORE UPDATE ON catalogue_progression
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_energie_timestamp
BEFORE UPDATE ON energie_scores
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_etape_data_timestamp
BEFORE UPDATE ON etape_data
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Fonction pour obtenir la progression d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_catalogue_progress(user_id UUID)
RETURNS TABLE (
  current_etape INT,
  total_etapes INT,
  percentage INT,
  completed_count INT,
  remaining_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.current_etape,
    10,
    ROUND((cp.current_etape::FLOAT / 10) * 100)::INT,
    COALESCE(ARRAY_LENGTH(cp.completed_etapes, 1), 0)::INT,
    10 - COALESCE(ARRAY_LENGTH(cp.completed_etapes, 1), 0)::INT
  FROM catalogue_progression cp
  WHERE cp.user_id = $1;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les scores énergétiques
CREATE OR REPLACE FUNCTION get_user_energie_scores(user_id UUID)
RETURNS TABLE (
  feu INT,
  air INT,
  terre INT,
  eau INT,
  balance_score INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    es.feu,
    es.air,
    es.terre,
    es.eau,
    es.balance_score
  FROM energie_scores es
  WHERE es.user_id = $1;
END;
$$ LANGUAGE plpgsql;
