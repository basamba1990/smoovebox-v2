-- Migration pour optimiser les performances avec des index pertinents
-- Fichier: 20250827000001_optimize_database_indexes.sql

-- ===== AJOUT DE COLONNES MANQUANTES =====

-- Ajouter la colonne duration_seconds si elle n'existe pas déjà
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

-- Ajouter la colonne engagement_score si elle n'existe pas déjà
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS engagement_score DECIMAL DEFAULT 0;

-- Ajouter la colonne views si elle n'existe pas déjà
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- ===== INDEX POUR LA TABLE VIDEOS =====

CREATE INDEX IF NOT EXISTS idx_videos_user_created 
    ON public.videos (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_videos_user_status 
    ON public.videos (user_id, status);

CREATE INDEX IF NOT EXISTS idx_videos_status 
    ON public.videos (status);

CREATE INDEX IF NOT EXISTS idx_videos_title_search 
    ON public.videos USING gin(to_tsvector('french', title));

CREATE INDEX IF NOT EXISTS idx_videos_engagement 
    ON public.videos (engagement_score DESC);

CREATE INDEX IF NOT EXISTS idx_videos_duration 
    ON public.videos (duration_seconds);

CREATE INDEX IF NOT EXISTS idx_videos_views 
    ON public.videos (views DESC);

-- ===== INDEX POUR LA TABLE PROFILES =====

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id 
    ON public.profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_email 
    ON public.profiles (email);

CREATE INDEX IF NOT EXISTS idx_profiles_fullname_search 
    ON public.profiles USING gin(to_tsvector('french', full_name));

-- ===== INDEX POUR LA TABLE TRANSCRIPTIONS =====

CREATE INDEX IF NOT EXISTS idx_transcriptions_video 
    ON public.transcriptions (video_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcriptions_content_search 
    ON public.transcriptions USING gin(to_tsvector('french', transcription_text));

CREATE INDEX IF NOT EXISTS idx_transcriptions_status 
    ON public.transcriptions (status);

CREATE INDEX IF NOT EXISTS idx_transcriptions_confidence 
    ON public.transcriptions (confidence_score);

-- ===== INDEX POUR LA TABLE USER_ACTIVITIES =====

CREATE INDEX IF NOT EXISTS idx_user_activities_user_created 
    ON public.user_activities (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activities_type 
    ON public.user_activities (activity_type);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_type 
    ON public.user_activities (user_id, activity_type);

-- ===== INDEX POUR LES TABLES DE CHALLENGES =====

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenges') THEN
        CREATE INDEX IF NOT EXISTS idx_challenges_active 
            ON public.challenges (is_active, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_challenges_difficulty 
            ON public.challenges (difficulty_level);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_challenges') THEN
        CREATE INDEX IF NOT EXISTS idx_user_challenges_user_status 
            ON public.user_challenges (user_id, status);
        CREATE INDEX IF NOT EXISTS idx_user_challenges_completed 
            ON public.user_challenges (completed_at DESC);
    END IF;
END $$;

-- ===== OPTIMISATIONS SUPPLÉMENTAIRES =====

ALTER TABLE public.videos SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.transcriptions SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.user_activities SET (autovacuum_analyze_scale_factor = 0.02);

ALTER TABLE public.videos ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE public.videos ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE public.videos ALTER COLUMN created_at SET STATISTICS 1000;

-- ===== VUES MATÉRIALISÉES =====

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_video_stats_user_id 
    ON public.user_video_stats (user_id);

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

-- ===== FONCTIONS POUR RAFRAÎCHIR =====

CREATE OR REPLACE FUNCTION public.refresh_user_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_video_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_global_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.global_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== TRIGGERS =====

CREATE OR REPLACE FUNCTION public.invalidate_stats_cache()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('stats_invalidated', 'user_video_stats');
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invalidate_stats ON public.videos;
CREATE TRIGGER trigger_invalidate_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.videos
    FOR EACH ROW EXECUTE FUNCTION public.invalidate_stats_cache();

-- ===== PERMISSIONS =====

GRANT SELECT ON public.user_video_stats TO authenticated;
GRANT SELECT ON public.global_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_global_stats() TO service_role;

-- ===== ANALYSE DES PERFORMANCES =====

ANALYZE public.videos;
ANALYZE public.profiles;
ANALYZE public.transcriptions;
ANALYZE public.user_activities;
