-- =========================================
-- Migration complète: Gestion profils et stats utilisateur
-- Fichier: 20250827000002_user_profile_and_stats.sql
-- =========================================

-- -----------------------------
-- 1. Supprimer l'ancienne fonction de stats si elle existe
-- -----------------------------
DROP FUNCTION IF EXISTS public.get_user_video_stats(UUID);

-- -----------------------------
-- 2. Création de la fonction get_user_video_stats
-- -----------------------------
CREATE FUNCTION public.get_user_video_stats(user_id_param UUID)
RETURNS TABLE (
    total_videos INTEGER,
    total_views INTEGER,
    avg_engagement DECIMAL,
    total_duration INTEGER,
    videos_by_status JSONB,
    performance_data JSONB,
    progress_stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH video_stats AS (
        SELECT
            COUNT(*)::INTEGER AS video_count,
            COALESCE(SUM(v.views),0)::INTEGER AS total_view_count,
            COALESCE(AVG(v.engagement_score),0)::DECIMAL AS avg_engagement_score,
            COALESCE(SUM(v.duration_seconds),0)::INTEGER AS total_duration_seconds,
            jsonb_object_agg(COALESCE(v.status,'unknown'), COUNT(*)) AS status_distribution
        FROM public.videos v
        WHERE v.user_id = user_id_param
    ),
    performance_data AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', DATE(v.created_at),
                'videos', COUNT(*),
                'avg_engagement', COALESCE(AVG(v.engagement_score),0),
                'total_views', COALESCE(SUM(v.views),0)
            ) ORDER BY DATE(v.created_at)
        ) AS perf_data
        FROM public.videos v
        WHERE v.user_id = user_id_param
          AND v.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(v.created_at)
    ),
    progress_data AS (
        SELECT jsonb_build_object(
            'completed', COUNT(*) FILTER (WHERE v.status IN ('ready','published')),
            'inProgress', COUNT(*) FILTER (WHERE v.status IN ('processing','analyzing','transcribing')),
            'totalTime', COALESCE(SUM(v.duration_seconds),0)
        ) AS prog_data
        FROM public.videos v
        WHERE v.user_id = user_id_param
    )
    SELECT
        vs.video_count,
        vs.total_view_count,
        vs.avg_engagement_score,
        vs.total_duration_seconds,
        vs.status_distribution,
        pd.perf_data,
        pr.prog_data
    FROM video_stats vs
    CROSS JOIN performance_data pd
    CROSS JOIN progress_data pr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_video_stats(UUID) TO authenticated;

-- -----------------------------
-- 3. Trigger pour création automatique d'un profil utilisateur
-- -----------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        user_id, email, full_name, avatar_url, created_at, updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(),
        NOW()
    );

    INSERT INTO public.user_activities (
        user_id, activity_type, activity_data, created_at
    ) VALUES (
        NEW.id,
        'user_registered',
        jsonb_build_object(
            'email', NEW.email,
            'registration_method', COALESCE(NEW.raw_app_meta_data->>'provider','email')
        ),
        NOW()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- -----------------------------
-- 4. Trigger pour mise à jour automatique du profil
-- -----------------------------
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.email IS DISTINCT FROM NEW.email
       OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data THEN

        UPDATE public.profiles
        SET
            email = NEW.email,
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            avatar_url = NEW.raw_user_meta_data->>'avatar_url',
            updated_at = NOW()
        WHERE user_id = NEW.id;

        INSERT INTO public.user_activities (
            user_id, activity_type, activity_data, created_at
        ) VALUES (
            NEW.id,
            'profile_updated',
            jsonb_build_object(
                'old_email', OLD.email,
                'new_email', NEW.email,
                'updated_fields', CASE
                    WHEN OLD.email IS DISTINCT FROM NEW.email THEN 'email'
                    ELSE 'metadata'
                END
            ),
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

GRANT EXECUTE ON FUNCTION public.handle_user_update() TO service_role;

-- -----------------------------
-- 5. Trigger pour suppression automatique des données utilisateur
-- -----------------------------
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.user_activities WHERE user_id = OLD.id;
    DELETE FROM public.transcriptions WHERE video_id IN (
        SELECT id FROM public.videos WHERE user_id = OLD.id
    );
    DELETE FROM public.videos WHERE user_id = OLD.id;
    DELETE FROM public.profiles WHERE user_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

GRANT EXECUTE ON FUNCTION public.handle_user_delete() TO service_role;

-- -----------------------------
-- 6. Commentaires
-- -----------------------------
COMMENT ON FUNCTION public.get_user_video_stats(UUID) IS 'Retourne les stats complètes d''un utilisateur';
COMMENT ON FUNCTION public.handle_new_user() IS 'Crée automatiquement un profil utilisateur lors de l''inscription';
COMMENT ON FUNCTION public.handle_user_update() IS 'Met à jour automatiquement le profil lors de modifications de l''utilisateur';
COMMENT ON FUNCTION public.handle_user_delete() IS 'Supprime toutes les données associées lors de la suppression d''un utilisateur';
