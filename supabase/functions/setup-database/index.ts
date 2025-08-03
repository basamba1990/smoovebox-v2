// Edge Function pour configurer la base de données avec les tables et contraintes nécessaires
import { createClient } from 'jsr:@supabase/supabase-js@^2';

Deno.serve(async (req) => {
  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  }

  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    // Initialiser le client Supabase avec le token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Utiliser le rôle de service pour les opérations de création de table
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Vérifier l'authentification de l'utilisateur
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur non authentifié', details: authError?.message }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Vérifier si la table videos existe déjà
    const { data: tableExists, error: checkError } = await supabaseAdmin.rpc(
      'check_table_exists',
      { table_name: 'videos', schema_name: 'public' }
    );

    if (checkError) {
      console.error('Erreur lors de la vérification de la table:', checkError);
      
      // Créer la fonction RPC si elle n'existe pas
      await supabaseAdmin.rpc('create_check_table_exists_function').catch(err => {
        console.warn('Erreur lors de la création de la fonction check_table_exists:', err);
      });
    }

    // Résultats des opérations
    const results = {
      tableCreated: false,
      bucketsCreated: {
        videos: false,
        thumbnails: false
      },
      policiesCreated: false,
      message: ''
    };

    // Créer la table videos si elle n'existe pas
    if (!tableExists) {
      const { error: createError } = await supabaseAdmin.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.videos (
            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            title TEXT NOT NULL,
            description TEXT,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            url TEXT,
            storage_path TEXT,
            thumbnail_url TEXT,
            duration NUMERIC,
            view_count INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'processing',
            error_message TEXT,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CHECK (url IS NOT NULL OR storage_path IS NOT NULL)
          );
          
          -- Ajouter un index sur user_id pour améliorer les performances
          CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos(user_id);
          
          -- Activer RLS sur la table videos
          ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
          
          -- Créer une fonction pour incrémenter le compteur de vues
          CREATE OR REPLACE FUNCTION increment_view_count(video_id BIGINT)
          RETURNS void
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            UPDATE public.videos
            SET view_count = view_count + 1
            WHERE id = video_id;
          END;
          $$;
        `
      });

      if (createError) {
        console.error('Erreur lors de la création de la table:', createError);
        results.message = `Erreur lors de la création de la table: ${createError.message}`;
      } else {
        results.tableCreated = true;
        results.message = 'Table videos créée avec succès';
      }
    } else {
      results.message = 'La table videos existe déjà';
    }

    // Créer les politiques RLS
    const { error: policyError } = await supabaseAdmin.rpc('execute_sql', {
      sql: `
        -- Politique pour permettre à tous les utilisateurs de voir les vidéos
        CREATE POLICY IF NOT EXISTS "Tous les utilisateurs peuvent voir les vidéos"
          ON public.videos
          FOR SELECT
          USING (status = 'ready');
        
        -- Politique pour permettre aux utilisateurs authentifiés de voir leurs propres vidéos (même en traitement)
        CREATE POLICY IF NOT EXISTS "Les utilisateurs peuvent voir leurs propres vidéos"
          ON public.videos
          FOR SELECT
          USING (auth.uid() = user_id);
        
        -- Politique pour permettre aux utilisateurs authentifiés d'insérer leurs propres vidéos
        CREATE POLICY IF NOT EXISTS "Les utilisateurs peuvent insérer leurs propres vidéos"
          ON public.videos
          FOR INSERT
          WITH CHECK (auth.uid() = user_id);
        
        -- Politique pour permettre aux utilisateurs authentifiés de mettre à jour leurs propres vidéos
        CREATE POLICY IF NOT EXISTS "Les utilisateurs peuvent mettre à jour leurs propres vidéos"
          ON public.videos
          FOR UPDATE
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
        
        -- Politique pour permettre aux utilisateurs authentifiés de supprimer leurs propres vidéos
        CREATE POLICY IF NOT EXISTS "Les utilisateurs peuvent supprimer leurs propres vidéos"
          ON public.videos
          FOR DELETE
          USING (auth.uid() = user_id);
      `
    });

    if (policyError) {
      console.error('Erreur lors de la création des politiques:', policyError);
      results.message += ` | Erreur lors de la création des politiques: ${policyError.message}`;
    } else {
      results.policiesCreated = true;
      results.message += ' | Politiques RLS créées avec succès';
    }

    // Vérifier et créer les buckets de stockage si nécessaires
    const { data: buckets, error: bucketsError } = await supabaseAdmin
      .storage
      .listBuckets();

    if (bucketsError) {
      console.error('Erreur lors de la vérification des buckets:', bucketsError);
      results.message += ` | Erreur lors de la vérification des buckets: ${bucketsError.message}`;
    } else {
      // Vérifier si le bucket videos existe
      const videosBucketExists = buckets.some(b => b.name === 'videos');
      if (!videosBucketExists) {
        const { error: createVideosError } = await supabaseAdmin
          .storage
          .createBucket('videos', {
            public: false,
            fileSizeLimit: 104857600, // 100MB
            allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
          });

        if (createVideosError) {
          console.error('Erreur lors de la création du bucket videos:', createVideosError);
          results.message += ` | Erreur lors de la création du bucket videos: ${createVideosError.message}`;
        } else {
          results.bucketsCreated.videos = true;
          results.message += ' | Bucket videos créé avec succès';
        }
      } else {
        results.bucketsCreated.videos = true;
        results.message += ' | Le bucket videos existe déjà';
      }

      // Vérifier si le bucket thumbnails existe
      const thumbnailsBucketExists = buckets.some(b => b.name === 'thumbnails');
      if (!thumbnailsBucketExists) {
        const { error: createThumbnailsError } = await supabaseAdmin
          .storage
          .createBucket('thumbnails', {
            public: true,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
          });

        if (createThumbnailsError) {
          console.error('Erreur lors de la création du bucket thumbnails:', createThumbnailsError);
          results.message += ` | Erreur lors de la création du bucket thumbnails: ${createThumbnailsError.message}`;
        } else {
          results.bucketsCreated.thumbnails = true;
          results.message += ' | Bucket thumbnails créé avec succès';
        }
      } else {
        results.bucketsCreated.thumbnails = true;
        results.message += ' | Le bucket thumbnails existe déjà';
      }
    }

    // Créer les politiques de stockage pour les buckets
    if (results.bucketsCreated.videos) {
      const { error: videosPolicyError } = await supabaseAdmin.rpc('execute_sql', {
        sql: `
          -- Politique pour permettre aux utilisateurs authentifiés de lire leurs propres vidéos
          BEGIN;
          INSERT INTO storage.policies (name, bucket_id, definition)
          SELECT 
            'Les utilisateurs peuvent lire leurs propres vidéos',
            id,
            '(bucket_id = ''${bucket.id}'' AND auth.uid()::text = (storage.foldername(name))[1])'
          FROM storage.buckets
          WHERE name = 'videos'
          ON CONFLICT (name, bucket_id) DO NOTHING;
          
          -- Politique pour permettre aux utilisateurs authentifiés d'uploader leurs propres vidéos
          INSERT INTO storage.policies (name, bucket_id, definition, operation)
          SELECT 
            'Les utilisateurs peuvent uploader leurs propres vidéos',
            id,
            '(bucket_id = ''${bucket.id}'' AND auth.uid()::text = (storage.foldername(name))[1])',
            'INSERT'
          FROM storage.buckets
          WHERE name = 'videos'
          ON CONFLICT (name, bucket_id, operation) DO NOTHING;
          
          -- Politique pour permettre aux utilisateurs authentifiés de supprimer leurs propres vidéos
          INSERT INTO storage.policies (name, bucket_id, definition, operation)
          SELECT 
            'Les utilisateurs peuvent supprimer leurs propres vidéos',
            id,
            '(bucket_id = ''${bucket.id}'' AND auth.uid()::text = (storage.foldername(name))[1])',
            'DELETE'
          FROM storage.buckets
          WHERE name = 'videos'
          ON CONFLICT (name, bucket_id, operation) DO NOTHING;
          
          -- Politique pour permettre aux utilisateurs authentifiés de mettre à jour leurs propres vidéos
          INSERT INTO storage.policies (name, bucket_id, definition, operation)
          SELECT 
            'Les utilisateurs peuvent mettre à jour leurs propres vidéos',
            id,
            '(bucket_id = ''${bucket.id}'' AND auth.uid()::text = (storage.foldername(name))[1])',
            'UPDATE'
          FROM storage.buckets
          WHERE name = 'videos'
          ON CONFLICT (name, bucket_id, operation) DO NOTHING;
          COMMIT;
        `
      });

      if (videosPolicyError) {
        console.error('Erreur lors de la création des politiques de stockage pour videos:', videosPolicyError);
        results.message += ` | Erreur lors de la création des politiques de stockage pour videos: ${videosPolicyError.message}`;
      } else {
        results.message += ' | Politiques de stockage pour videos créées avec succès';
      }
    }

    // Retourner la réponse avec les résultats
    return new Response(
      JSON.stringify({
        success: true,
        results
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (err) {
    console.error('Erreur non gérée:', err);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: err.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
});
