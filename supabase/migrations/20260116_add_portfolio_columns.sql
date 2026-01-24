-- Migration pour ajouter les colonnes nécessaires au Portfolio Vidéo GENUP
-- Ces colonnes permettent de grouper les vidéos par session et par type de contenu.

DO $$
BEGIN
    -- Ajout de la colonne session_id si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE public.videos ADD COLUMN session_id TEXT;
        COMMENT ON COLUMN public.videos.session_id IS 'ID de la session de transformation GENUP';
    END IF;

    -- Ajout de la colonne video_type si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'video_type'
    ) THEN
        ALTER TABLE public.videos ADD COLUMN video_type TEXT;
        COMMENT ON COLUMN public.videos.video_type IS 'Type de contenu (pitch, reflexive, action_trace, ai_synthesis)';
    END IF;

    -- Ajout d'index pour optimiser les requêtes du portfolio
    CREATE INDEX IF NOT EXISTS idx_videos_session_id ON public.videos(session_id);
    CREATE INDEX IF NOT EXISTS idx_videos_video_type ON public.videos(video_type);

END $$;
