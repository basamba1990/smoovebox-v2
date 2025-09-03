-- Migration pour corriger les erreurs de permissions et RLS identifiées
-- Date: 2025-09-03

-- 1. Correction de l'erreur de permission sur la vue matérialisée user_video_stats
-- Suppression et recréation de la vue matérialisée avec les bonnes permissions

DROP MATERIALIZED VIEW IF EXISTS public.user_video_stats;

-- Création de la vue matérialisée user_video_stats avec les bonnes permissions
CREATE MATERIALIZED VIEW public.user_video_stats AS
SELECT 
    p.user_id,
    p.username,
    COUNT(v.id) as total_videos,
    COALESCE(SUM(v.views), 0) as total_views,
    COALESCE(SUM(v.likes_count), 0) as total_likes,
    COALESCE(SUM(v.comments_count), 0) as total_comments,
    COALESCE(AVG(v.performance_score), 0) as avg_performance_score,
    COUNT(CASE WHEN v.status = 'published' THEN 1 END) as published_videos,
    COUNT(CASE WHEN v.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as videos_last_30_days
FROM public.profiles p
LEFT JOIN public.videos v ON p.id = v.profile_id
GROUP BY p.user_id, p.username;

-- Créer un index unique pour permettre le rafraîchissement concurrent
CREATE UNIQUE INDEX ON public.user_video_stats (user_id);

-- Donner les permissions appropriées
GRANT SELECT ON public.user_video_stats TO authenticated;
GRANT SELECT ON public.user_video_stats TO anon;

-- 2. Ajout des politiques RLS manquantes pour les tables sans politique

-- Table admin_notifications
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notifications" ON public.admin_notifications
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND (skills->>'admin' = 'true' OR skills->>'moderator' = 'true')
    )
);

-- Table collective_sessions
ALTER TABLE public.collective_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public sessions" ON public.collective_sessions
FOR SELECT USING (is_public = true);

CREATE POLICY "Users can manage their own sessions" ON public.collective_sessions
FOR ALL USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Participants can view their sessions" ON public.collective_sessions
FOR SELECT USING (
    auth.uid() = ANY(participant_ids) OR 
    auth.uid() = creator_id
);

-- Table creative_challenges
ALTER TABLE public.creative_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active challenges" ON public.creative_challenges
FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage challenges" ON public.creative_challenges
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() 
        AND (skills->>'admin' = 'true' OR skills->>'moderator' = 'true')
    )
);

-- Table playlist_videos
ALTER TABLE public.playlist_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their playlist videos" ON public.playlist_videos
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_id 
        AND user_id = auth.uid()
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_id 
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can view public playlist videos" ON public.playlist_videos
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.playlists 
        WHERE id = playlist_id 
        AND is_public = true
    )
);

-- Table playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own playlists" ON public.playlists
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view public playlists" ON public.playlists
FOR SELECT USING (is_public = true);

-- Table user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own badges" ON public.user_badges
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can award badges" ON public.user_badges
FOR INSERT WITH CHECK (TRUE);

-- 3. Correction des fonctions avec search_path mutable
-- Ajout du paramètre SECURITY DEFINER et SET search_path

-- Fonction update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fonction ensure_video_required_fields
CREATE OR REPLACE FUNCTION public.ensure_video_required_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.title IS NULL OR NEW.title = '' THEN
        RAISE EXCEPTION 'Le titre de la vidéo est requis';
    END IF;
    
    IF NEW.file_path IS NULL OR NEW.file_path = '' THEN
        RAISE EXCEPTION 'Le chemin du fichier est requis';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Fonction update_transcriptions_updated_at_column
CREATE OR REPLACE FUNCTION public.update_transcriptions_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Fonction update_video_counters
CREATE OR REPLACE FUNCTION public.update_video_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'likes' THEN
            UPDATE public.videos 
            SET likes_count = likes_count + 1 
            WHERE id = NEW.video_id;
        ELSIF TG_TABLE_NAME = 'comments' THEN
            UPDATE public.videos 
            SET comments_count = comments_count + 1 
            WHERE id = NEW.video_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'likes' THEN
            UPDATE public.videos 
            SET likes_count = GREATEST(0, likes_count - 1) 
            WHERE id = OLD.video_id;
        ELSIF TG_TABLE_NAME = 'comments' THEN
            UPDATE public.videos 
            SET comments_count = GREATEST(0, comments_count - 1) 
            WHERE id = OLD.video_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fonction validate_video_url
CREATE OR REPLACE FUNCTION public.validate_video_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.url IS NOT NULL AND NEW.url !~ '^https?://' THEN
        RAISE EXCEPTION 'L''URL de la vidéo doit commencer par http:// ou https://';
    END IF;
    
    RETURN NEW;
END;
$$;

-- 4. Activation de RLS pour les tables manquantes

-- Table analyses
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analyses" ON public.analyses
FOR SELECT USING (
    auth.uid() = (
        SELECT v.user_id 
        FROM public.videos v 
        WHERE v.id = video_id
    )
);

CREATE POLICY "Users can manage their own analyses" ON public.analyses
FOR ALL USING (
    auth.uid() = (
        SELECT v.user_id 
        FROM public.videos v 
        WHERE v.id = video_id
    )
) WITH CHECK (
    auth.uid() = (
        SELECT v.user_id 
        FROM public.videos v 
        WHERE v.id = video_id
    )
);

-- Table video_reactions
ALTER TABLE public.video_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reactions" ON public.video_reactions
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view reactions on public videos" ON public.video_reactions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.videos 
        WHERE id = video_id 
        AND status = 'published'
    )
);

-- Table improvement_suggestions
ALTER TABLE public.improvement_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions" ON public.improvement_suggestions
FOR SELECT USING (
    auth.uid() = (
        SELECT v.user_id 
        FROM public.videos v 
        WHERE v.id = video_id
    )
);

CREATE POLICY "System can create suggestions" ON public.improvement_suggestions
FOR INSERT WITH CHECK (TRUE);

-- 5. Rafraîchissement des vues matérialisées
REFRESH MATERIALIZED VIEW public.user_video_stats;

-- Si la vue global_stats existe, la rafraîchir aussi
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'global_stats' AND schemaname = 'public') THEN
        REFRESH MATERIALIZED VIEW public.global_stats;
    END IF;
END $$;

-- 6. Création d'une fonction pour rafraîchir les statistiques utilisateur de manière sécurisée
CREATE OR REPLACE FUNCTION public.refresh_user_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_video_stats;
EXCEPTION
    WHEN OTHERS THEN
        -- En cas d'erreur avec CONCURRENTLY, essayer sans
        REFRESH MATERIALIZED VIEW public.user_video_stats;
END;
$$;

-- Donner les permissions appropriées
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO authenticated;

