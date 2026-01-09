-- ============================================================================
-- SCRIPT DE VÉRIFICATION ET CONFIGURATION : TABLE "videos" (CORRIGÉ)
-- Ce script vérifie l'existence de la table, des colonnes et configure le RLS.
-- À exécuter dans l'éditeur SQL de Supabase.
-- ============================================================================

DO $$ 
BEGIN
    -- 1. Vérifier si la table 'videos' existe, sinon la créer
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'videos') THEN
        CREATE TABLE public.videos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            title TEXT,
            video_url TEXT,
            public_url TEXT,
            url TEXT,
            storage_path TEXT,
            status TEXT DEFAULT 'pending',
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        RAISE NOTICE 'Table public.videos créée.';
    ELSE
        RAISE NOTICE 'Table public.videos existe déjà.';
    END IF;

    -- 2. Vérifier et ajouter la colonne 'user_id' si manquante
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'user_id') THEN
        ALTER TABLE public.videos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Colonne user_id ajoutée à la table videos.';
    END IF;

    -- 3. Vérifier et ajouter les colonnes d'URL si manquantes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'public_url') THEN
        ALTER TABLE public.videos ADD COLUMN public_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'url') THEN
        ALTER TABLE public.videos ADD COLUMN url TEXT;
    END IF;

END $$;

-- 4. Activer le Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- 5. Nettoyage des politiques existantes
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leurs propres vidéos" ON public.videos;
DROP POLICY IF EXISTS "Les utilisateurs peuvent insérer leurs propres vidéos" ON public.videos;
DROP POLICY IF EXISTS "Les utilisateurs peuvent mettre à jour leurs propres vidéos" ON public.videos;
DROP POLICY IF EXISTS "Service Role peut tout faire" ON public.videos;

-- 6. Création des politiques de sécurité (RLS)

-- Lecture : Un utilisateur ne voit que ses vidéos
CREATE POLICY "Les utilisateurs peuvent voir leurs propres vidéos" 
ON public.videos 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Insertion : Un utilisateur peut insérer pour son propre ID
CREATE POLICY "Les utilisateurs peuvent insérer leurs propres vidéos" 
ON public.videos 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Mise à jour : Un utilisateur peut modifier ses propres vidéos
CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres vidéos" 
ON public.videos 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- Service Role : Accès complet pour les Edge Functions
CREATE POLICY "Service Role peut tout faire" 
ON public.videos 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Note : Les commentaires SQL standard (--) sont autorisés ici, 
-- mais pas les commandes RAISE NOTICE qui doivent rester dans un bloc DO.
