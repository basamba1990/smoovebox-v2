-- Configuration opérationnelle du parcours territorial Spotbulle.
-- L’interface et l’Edge Function lisent cette table au lieu d’embarquer l’ordre métier.

CREATE TABLE IF NOT EXISTS public.spotbulle_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  element TEXT NOT NULL,
  energy TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  color_class TEXT NOT NULL,
  order_index INTEGER NOT NULL UNIQUE,
  required_missions INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.spotbulle_territories
  (territory, display_name, element, energy, icon_key, color_class, order_index, required_missions)
VALUES
  ('Calyxis', 'Calyxis', 'Feu', 'CRÉATION', 'mountain', 'from-red-500 to-orange-500', 1, 5),
  ('Sylvara', 'Sylvara', 'Terre', 'ACTION', 'compass', 'from-green-500 to-emerald-500', 2, 5),
  ('Cattleya', 'Cattleya', 'Air', 'COOPERATION_COMMUNICATION', 'wind', 'from-blue-500 to-cyan-500', 3, 5),
  ('Neptunus', 'Neptunus', 'Eau', 'RÉSILIENCE', 'droplets', 'from-indigo-500 to-purple-500', 4, 5)
ON CONFLICT (territory) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  element = EXCLUDED.element,
  energy = EXCLUDED.energy,
  icon_key = EXCLUDED.icon_key,
  color_class = EXCLUDED.color_class,
  order_index = EXCLUDED.order_index,
  required_missions = EXCLUDED.required_missions;

ALTER TABLE public.spotbulle_territories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spotbulle_territories_read_all" ON public.spotbulle_territories;
CREATE POLICY "spotbulle_territories_read_all"
  ON public.spotbulle_territories FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_spotbulle_territories_order
  ON public.spotbulle_territories (order_index);
