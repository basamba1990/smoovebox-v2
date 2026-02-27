-- LUMIA TERRITORIAL - Écosystème de réussite territoriale
-- Date: 2026-02-25

-- ============================================================================
-- TABLE: Collectivités
-- ============================================================================
CREATE TABLE IF NOT EXISTS collectivites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL,
  region VARCHAR(255),
  adresse TEXT,
  contact_email VARCHAR(320),
  contact_phone VARCHAR(20),
  licence_status VARCHAR(50) DEFAULT 'active' CHECK (licence_status IN ('active', 'suspended', 'expired')),
  licence_start_date TIMESTAMP,
  licence_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(nom, region)
);

-- ============================================================================
-- TABLE: LUMIA
-- ============================================================================
CREATE TABLE IF NOT EXISTS lumia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collectivite_id UUID NOT NULL REFERENCES collectivites(id) ON DELETE CASCADE,
  territoire VARCHAR(255) NOT NULL,
  region VARCHAR(255),
  description TEXT,
  feu_score NUMERIC(3,1) DEFAULT 50 CHECK (feu_score >= 0 AND feu_score <= 100),
  air_score NUMERIC(3,1) DEFAULT 50 CHECK (air_score >= 0 AND air_score <= 100),
  terre_score NUMERIC(3,1) DEFAULT 50 CHECK (terre_score >= 0 AND terre_score <= 100),
  eau_score NUMERIC(3,1) DEFAULT 50 CHECK (eau_score >= 0 AND eau_score <= 100),
  equilibre_score NUMERIC(3,1) GENERATED ALWAYS AS (
    ROUND((feu_score + air_score + terre_score + eau_score) / 4, 1)
  ) STORED,
  total_missions INTEGER DEFAULT 0,
  total_constellations INTEGER DEFAULT 0,
  total_pitches INTEGER DEFAULT 0,
  validation_rate NUMERIC(3,1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(collectivite_id, territoire)
);

-- ============================================================================
-- EXTEND TABLE: Users
-- ============================================================================
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS lumia_id UUID REFERENCES lumia(id) ON DELETE SET NULL;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS dominant_zone VARCHAR(50) CHECK (dominant_zone IN ('feu', 'air', 'terre', 'eau'));
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS radar_scores JSONB DEFAULT '{"feu": 50, "air": 50, "terre": 50, "eau": 50}';
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS verticales JSONB DEFAULT '[]';
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS niveau INTEGER DEFAULT 1 CHECK (niveau >= 1 AND niveau <= 10);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS total_missions INTEGER DEFAULT 0;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS total_constellations INTEGER DEFAULT 0;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS total_pitches INTEGER DEFAULT 0;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN DEFAULT FALSE;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS mentor_since TIMESTAMP;

-- ============================================================================
-- TABLE: Missions
-- ============================================================================
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lumia_id UUID NOT NULL REFERENCES lumia(id) ON DELETE CASCADE,
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  objectifs JSONB DEFAULT '[]',
  zone_dominante VARCHAR(50) NOT NULL CHECK (zone_dominante IN ('feu', 'air', 'terre', 'eau')),
  zones_secondaires JSONB DEFAULT '[]',
  duree_jours INTEGER DEFAULT 42,
  livrables JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE: Constellations
-- ============================================================================
CREATE TABLE IF NOT EXISTS constellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  members UUID[] NOT NULL,
  mentor_id UUID REFERENCES auth.users(id),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE: Pitches
-- ============================================================================
CREATE TABLE IF NOT EXISTS pitches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constellation_id UUID NOT NULL REFERENCES constellations(id) ON DELETE CASCADE,
  video_url TEXT,
  validation_status VARCHAR(50) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'approved', 'rejected')),
  scores JSONB DEFAULT '{"feu": 0, "air": 0, "terre": 0, "eau": 0}',
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- TABLE: LUMIA Update Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS lumia_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lumia_id UUID NOT NULL REFERENCES lumia(id) ON DELETE CASCADE,
  delta_feu NUMERIC(3,1) DEFAULT 0,
  delta_air NUMERIC(3,1) DEFAULT 0,
  delta_terre NUMERIC(3,1) DEFAULT 0,
  delta_eau NUMERIC(3,1) DEFAULT 0,
  source VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lumia_collectivite ON lumia(collectivite_id);
CREATE INDEX IF NOT EXISTS idx_lumia_equilibre ON lumia(equilibre_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_lumia ON auth.users(lumia_id);
CREATE INDEX IF NOT EXISTS idx_users_dominant_zone ON auth.users(dominant_zone);
CREATE INDEX IF NOT EXISTS idx_users_is_mentor ON auth.users(is_mentor) WHERE is_mentor = TRUE;
CREATE INDEX IF NOT EXISTS idx_missions_lumia ON missions(lumia_id);
CREATE INDEX IF NOT EXISTS idx_missions_zone ON missions(zone_dominante);
CREATE INDEX IF NOT EXISTS idx_constellations_mission ON constellations(mission_id);
CREATE INDEX IF NOT EXISTS idx_pitches_constellation ON pitches(constellation_id);
CREATE INDEX IF NOT EXISTS idx_lumia_logs_lumia ON lumia_update_logs(lumia_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE lumia ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE constellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;

-- Policies pour LUMIA
CREATE POLICY "Users see their LUMIA" ON lumia
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users WHERE auth.users.lumia_id = lumia.id AND auth.users.id = auth.uid()
    )
  );

-- Policies pour Missions
CREATE POLICY "Users see missions in their LUMIA" ON missions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users WHERE auth.users.lumia_id = missions.lumia_id AND auth.users.id = auth.uid()
    )
  );

-- Policies pour Constellations
CREATE POLICY "Users see constellations they're in" ON constellations
  FOR SELECT USING (
    auth.uid() = ANY(members) OR
    mentor_id = auth.uid()
  );

-- Policies pour Pitches
CREATE POLICY "Users see pitches from their constellations" ON pitches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM constellations
      WHERE constellations.id = pitches.constellation_id
      AND (auth.uid() = ANY(members) OR mentor_id = auth.uid())
    )
  );

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Fonction pour calculer l'équilibre énergétique (déjà géré par GENERATED, mais on garde pour log)
CREATE OR REPLACE FUNCTION calculate_lumia_equilibre()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatiquement calculé via GENERATED ALWAYS AS
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lumia_timestamp
BEFORE UPDATE ON lumia
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_missions_timestamp
BEFORE UPDATE ON missions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_constellations_timestamp
BEFORE UPDATE ON constellations
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_pitches_timestamp
BEFORE UPDATE ON pitches
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
