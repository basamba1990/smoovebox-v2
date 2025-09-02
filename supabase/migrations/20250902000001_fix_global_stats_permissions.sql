-- =========================================
-- Migration pour corriger les permissions des vues matérialisées
-- Date: 2025-09-02
-- =========================================

-- 1️⃣ Donner les droits de lecture aux rôles clients
GRANT SELECT ON public.global_stats TO authenticated;
GRANT SELECT ON public.global_stats TO anon;

GRANT SELECT ON public.user_video_stats TO authenticated;
GRANT SELECT ON public.user_video_stats TO anon;

-- 2️⃣ Accorder l'exécution des fonctions de refresh uniquement au service_role
GRANT EXECUTE ON FUNCTION public.refresh_global_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO service_role;

-- 3️⃣ Mettre à jour les vues matérialisées (doit être exécuté par un rôle possédant la vue)
-- ⚠️ Ces commandes doivent être exécutées avec Service Role Key ou depuis SQL console
REFRESH MATERIALIZED VIEW public.global_stats;
REFRESH MATERIALIZED VIEW public.user_video_stats;

-- 4️⃣ Notes importantes
-- • Les rôles clients (authenticated, anon) peuvent seulement lire les vues
-- • Les fonctions de refresh doivent être exécutées via Service Role Key
-- • Le propriétaire des vues reste postgres (normal en Supabase Cloud)
-- • Cette migration est sécurisée et compatible Supabase Cloud
