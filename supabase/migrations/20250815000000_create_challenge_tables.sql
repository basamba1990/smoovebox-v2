-- Création des tables manquantes
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id uuid NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    submission_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'submitted',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id uuid NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    progress_data jsonb,
    status text NOT NULL DEFAULT 'in_progress',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

-- Politiques RLS
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own submissions"
ON public.challenge_submissions 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own progress"
ON public.challenge_progress 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

