-- Migration pour optimiser les performances avec des index pertinents
-- Fichier: 20250827000001_optimize_database_indexes.sql

-- ===== INDEX POUR LA TABLE VIDEOS =====

-- Index composite pour les requêtes par utilisateur et date (le plus utilisé)
CREATE INDEX IF NOT EXISTS idx_videos_user_created 
ON public.videos (user_id, created_at DESC);

-- Index pour les requêtes par statut et utilisateur
CREATE INDEX IF NOT EXISTS idx_videos_user_status 
ON public.videos (user_id, status);

-- Index pour les requêtes par statut uniquement (pour les statistiques globales)
CREATE INDEX IF NOT EXISTS idx_videos_status 
ON public.videos (status);

-- Index pour les recherches par titre (avec support de recherche textuelle)
CREATE INDEX IF NOT EXISTS idx_videos_title_search 
ON public.videos USING gin(to_tsvector('french', title));

-- Index pour les requêtes de performance (engagement_score)
CREATE INDEX IF NOT EXISTS idx_videos_engagement 
ON public.videos (engagement_score DESC) 
WHERE engagement_score IS NOT NULL;

-- Index pour les requêtes de durée
CREATE INDEX IF NOT EXISTS idx_videos_duration 
ON public.videos (duration_seconds) 
WHERE duration_seconds IS NOT NULL;

-- Index pour les vues
CREATE INDEX IF NOT EXISTS idx_videos_views 
ON public.videos (views DESC) 
WHERE views IS NOT NULL;

-- ===== INDEX POUR LA TABLE PROFILES =====

-- Index unique sur user_id (déjà existant via FK, mais explicite)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles (user_id);

-- Index pour les recherches par email
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON public.profiles (email);

-- Index pour les recherches par nom complet
CREATE INDEX IF NOT EXISTS idx_profiles_fullname_search 
ON public.profiles USING gin(to_tsvector('french', full_name));

-- ===== INDEX POUR LA TABLE TRANSCRIPTIONS =====

-- Index composite pour les requêtes par vidéo
CREATE INDEX IF NOT EXISTS idx_transcriptions_video 
ON public.transcriptions (video_id, created_at DESC);

-- Index pour les recherches dans le contenu des transcriptions
CREATE INDEX IF NOT EXISTS idx_transcriptions_content_search 
ON public.transcriptions USING gin(to_tsvector('french', transcription_text))
WHERE transcription_text IS NOT NULL;

-- Index pour les requêtes par statut de transcription
CREATE INDEX IF NOT EXISTS idx_transcriptions_status 
ON public.transcriptions (status);

-- Index pour les scores de confiance
CREATE INDEX IF NOT EXISTS idx_transcriptions_confidence 
ON public.transcriptions (confidence_score) 
WHERE confidence_score IS NOT NULL;

-- ===== INDEX POUR LA TABLE USER_ACTIVITIES =====

-- Index composite pour les requêtes par utilisateur et date
CREATE INDEX IF NOT EXISTS idx_user_activities_user_created 
ON public.user_activities (user_id, created_at DESC);

-- Index pour les requêtes par type d'activité
CREATE INDEX IF NOT EXISTS idx_user_activities_type 
ON public.user_activities (activity_type);

-- Index composite pour les requêtes par utilisateur et type
CREATE INDEX IF NOT EXISTS idx_user_activities_user_type 
ON public.user_activities (user_id, activity_type);

-- Index pour les requêtes récentes (30 derniers jours)
CREATE INDEX IF NOT EXISTS idx_user_activities_recent 
ON public.user_activities (created_at DESC) 
WHERE created_at >= NOW() - INTERVAL '30 days';

-- ===== INDEX POUR LES TABLES DE CHALLENGES (si elles existent) =====

-- Vérifier si la table challenges existe avant de créer les index
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenges') THEN
        -- Index pour les challenges actifs
        CREATE INDEX IF NOT EXISTS idx_challenges_active 
        ON public.challenges (is_active, created_at DESC);
        
        -- Index pour les challenges par difficulté
        CREATE INDEX IF NOT EXISTS idx_challenges_difficulty 
        ON public.challenges (difficulty_level);
    END IF;
END $$;

-- Vérifier si la table user_challenges existe
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_challenges') THEN
        -- Index composite pour les défis utilisateur
        CREATE INDEX IF NOT EXISTS idx_user_challenges_user_status 
        ON public.user_challenges (user_id, status);
        
        -- Index pour les défis complétés
        CREATE INDEX IF NOT EXISTS idx_user_challenges_completed 
        ON public.user_challenges (completed_at DESC) 
        WHERE completed_at IS NOT NULL;
    END IF;
END $$;

-- ===== OPTIMISATIONS SUPPLÉMENTAIRES =====

-- Statistiques automatiques pour l'optimiseur de requêtes
ALTER TABLE public.videos SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.transcriptions SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.user_activities SET (autovacuum_analyze_scale_factor = 0.02);

-- Augmenter les statistiques pour les colonnes importantes
ALTER TABLE public.videos ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE public.videos ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE public.videos ALTER COLUMN created_at SET STATISTICS 1000;

-- ===== VUES MATÉRIALISÉES POUR LES STATISTIQUES =====

-- Vue matérialisée pour les statistiques utilisateur (mise à jour périodique)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_video_stats AS
SELECT 
    v.user_id,
    COUNT(*) as total_videos,
    COUNT(*) FILTER (WHERE v.status = 'ready') as ready_videos,
    COUNT(*) FILTER (WHERE v.status = 'processing') as processing_videos,
    COUNT(*) FILTER (WHERE v.status = 'failed') as failed_videos,
    COALESCE(SUM(v.views), 0) as total_views,
    COALESCE(AVG(v.engagement_score), 0) as avg_engagement,
    COALESCE(SUM(v.duration_seconds), 0) as total_duration,
    MAX(v.created_at) as last_upload,
    COUNT(*) FILTER (WHERE v.created_at >= NOW() - INTERVAL '7 days') as videos_last_week,
    COUNT(*) FILTER (WHERE v.created_at >= NOW() - INTERVAL '30 days') as videos_last_month
FROM public.videos v
GROUP BY v.user_id;

-- Index sur la vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_video_stats_user_id 
ON public.user_video_stats (user_id);

-- Vue matérialisée pour les statistiques globales
CREATE MATERIALIZED VIEW IF NOT EXISTS public.global_stats AS
SELECT 
    COUNT(*) as total_videos,
    COUNT(DISTINCT user_id) as total_users,
    COUNT(*) FILTER (WHERE status = 'ready') as ready_videos,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_videos,
    COALESCE(SUM(views), 0) as total_views,
    COALESCE(AVG(engagement_score), 0) as avg_engagement,
    COALESCE(SUM(duration_seconds), 0) as total_duration,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as videos_last_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as videos_last_week
FROM public.videos;

-- ===== FONCTIONS POUR RAFRAÎCHIR LES VUES MATÉRIALISÉES =====

-- Fonction pour rafraîchir les statistiques utilisateur
CREATE OR REPLACE FUNCTION public.refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_video_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour rafraîchir les statistiques globales
CREATE OR REPLACE FUNCTION public.refresh_global_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.global_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== TRIGGERS POUR MISE À JOUR AUTOMATIQUE =====

-- Fonction trigger pour invalider les statistiques lors de changements
CREATE OR REPLACE FUNCTION public.invalidate_stats_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Marquer les vues matérialisées comme nécessitant une mise à jour
    -- (implémentation simplifiée - en production, utiliser un système de queue)
    PERFORM pg_notify('stats_invalidated', 'user_video_stats');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger sur les changements de vidéos
DROP TRIGGER IF EXISTS trigger_invalidate_stats ON public.videos;
CREATE TRIGGER trigger_invalidate_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.videos
    FOR EACH ROW EXECUTE FUNCTION public.invalidate_stats_cache();

-- ===== PERMISSIONS =====

-- Accorder les permissions pour les vues matérialisées
GRANT SELECT ON public.user_video_stats TO authenticated;
GRANT SELECT ON public.global_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_global_stats() TO service_role;

-- ===== COMMENTAIRES POUR LA DOCUMENTATION =====

COMMENT ON INDEX idx_videos_user_created IS 'Index principal pour les requêtes de vidéos par utilisateur triées par date';
COMMENT ON INDEX idx_videos_user_status IS 'Index pour filtrer les vidéos par utilisateur et statut';
COMMENT ON INDEX idx_videos_title_search IS 'Index de recherche textuelle dans les titres de vidéos';
COMMENT ON MATERIALIZED VIEW public.user_video_stats IS 'Statistiques pré-calculées par utilisateur pour améliorer les performances du dashboard';
COMMENT ON MATERIALIZED VIEW public.global_stats IS 'Statistiques globales pré-calculées pour les métriques de la plateforme';

-- ===== ANALYSE DES PERFORMANCES =====

-- Forcer une analyse des statistiques après création des index
ANALYZE public.videos;
ANALYZE public.profiles;
ANALYZE public.transcriptions;
ANALYZE public.user_activities;

