-- Migration pour corriger les permissions de la vue matérialisée global_stats
-- Date: 2025-09-02

-- Accorder les permissions nécessaires sur la vue matérialisée global_stats
GRANT SELECT ON public.global_stats TO authenticated;
GRANT SELECT ON public.global_stats TO anon;

-- Accorder les permissions sur la fonction refresh_global_stats
GRANT EXECUTE ON FUNCTION public.refresh_global_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_global_stats() TO authenticated;

-- Accorder les permissions sur la vue matérialisée user_video_stats
GRANT SELECT ON public.user_video_stats TO authenticated;
GRANT SELECT ON public.user_video_stats TO anon;

-- Accorder les permissions sur la fonction refresh_user_stats
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO authenticated;

-- S'assurer que les vues matérialisées sont à jour
REFRESH MATERIALIZED VIEW public.global_stats;
REFRESH MATERIALIZED VIEW public.user_video_stats;

