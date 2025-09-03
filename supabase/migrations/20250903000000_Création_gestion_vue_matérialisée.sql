-- 9.5 Création et gestion d'une vue matérialisée pour les statistiques utilisateur
DROP MATERIALIZED VIEW IF EXISTS public.user_video_stats CASCADE;

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

-- Création d'une fonction pour rafraîchir les statistiques utilisateur
CREATE OR REPLACE FUNCTION public.refresh_user_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Essayer de rafraîchir la vue matérialisée de manière concurrente
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_video_stats;
    EXCEPTION
        WHEN OTHERS THEN
            -- En cas d'erreur avec CONCURRENTLY, essayer sans
            REFRESH MATERIALIZED VIEW public.user_video_stats;
    END;
    
    -- Retourner la ligne appropriée selon le type d'opération
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Donner les permissions appropriées
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO authenticated;

-- Supprimer le trigger existant s'il existe
DROP TRIGGER IF EXISTS refresh_user_video_stats_trigger ON public.videos;

-- Créer le trigger sur la table videos
CREATE TRIGGER refresh_user_video_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.refresh_user_stats();
