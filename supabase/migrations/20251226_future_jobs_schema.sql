-- Table des métiers du futur
CREATE TABLE IF NOT EXISTS public.future_jobs (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
title TEXT NOT NULL,
year INTEGER NOT NULL,
key_tasks TEXT[] NOT NULL,
core_skills TEXT[] NOT NULL,
emerging_tech TEXT[] NOT NULL,
visual_elements TEXT[] NOT NULL,
sources JSONB DEFAULT '[]'::jsonb,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table des prompts générés par les utilisateurs
CREATE TABLE IF NOT EXISTS public.job_prompts (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
user_id UUID REFERENCES auth.users(id),
job_id UUID REFERENCES public.future_jobs(id),
generator TEXT NOT NULL, -- Sora, Runway, Pika
style TEXT NOT NULL,
duration INTEGER NOT NULL,
prompt_text TEXT NOT NULL,
metadata JSONB DEFAULT '{}'::jsonb,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table des vidéos générées
CREATE TABLE IF NOT EXISTS public.generated_videos (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
prompt_id UUID REFERENCES public.job_prompts(id),
video_url TEXT,
status TEXT DEFAULT 'pending', -- pending, generating, done, error
error_message TEXT,
metadata JSONB DEFAULT '{}'::jsonb,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insertion des données initiales pour les métiers du futur (basé sur futureJobsData.js)
-- Note: On pourrait automatiser ça via un script, mais voici un exemple pour l'ingénieur en énergies renouvelables
INSERT INTO public.future_jobs (title, year, key_tasks, core_skills, emerging_tech, visual_elements, sources)
VALUES (
'Ingénieur en énergies renouvelables',
2030,
ARRAY['Optimisation de systèmes énergies renouvelables', 'programmation de solutions smart grid', 'gestion de projets verts'],
ARRAY['Génie énergétique', 'Modélisation plante/réseaux', 'Réglementations environnementales'],
ARRAY['Transition Énergétique', 'Smart Grids', 'Véhicules Autonomes Électriques'],
ARRAY['Ville verte futuriste', 'smart grids solaires et éoliens', 'interfaces AR sur écrans tactiles volants', 'ambiance lumineuse et durable'],
'[{"name": "WEF 2025", "url": "https://www.weforum.org"}]'::jsonb
) ON CONFLICT DO NOTHING;

-- Activer RLS
ALTER TABLE public.future_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

-- Politiques de lecture publique pour les métiers
CREATE POLICY "Allow public read access on future_jobs" ON public.future_jobs FOR SELECT USING (true);

-- Politiques pour les prompts (utilisateur peut voir les siens)
CREATE POLICY "Users can view their own prompts" ON public.job_prompts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own prompts" ON public.job_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politiques pour les vidéos
CREATE POLICY "Users can view videos of their prompts" ON public.generated_videos FOR SELECT USING (
EXISTS (SELECT 1 FROM public.job_prompts WHERE id = prompt_id AND user_id = auth.uid())
);
