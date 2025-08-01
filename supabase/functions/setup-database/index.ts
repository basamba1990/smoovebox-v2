import { createClient } from 'npm:@supabase/supabase-js@2.38.4';

// Headers CORS pour toutes les réponses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    // Récupérer les informations d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Authentification requise'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Créer le client Supabase avec le rôle de service pour avoir les permissions nécessaires
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Vérifier si l'utilisateur est authentifié
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      return new Response(JSON.stringify({
        error: 'Utilisateur non authentifié',
        details: userError
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    console.log(`Configuration de la base de données demandée par l'utilisateur: ${user.id}`);

    // Vérifier si la table videos existe
    const { error: checkError } = await supabaseAdmin
      .from('videos')
      .select('id')
      .limit(1);

    let tableCreated = false;
    let tableUpdated = false;

    if (checkError && checkError.code === '42P01') {
      console.log('La table videos n\'existe pas, création...');
      
      // Créer la table videos avec toutes les colonnes nécessaires
      // CORRECTION: Changement de 'PENDING' à 'processing' pour être cohérent avec la contrainte existante
      const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS public.videos (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            storage_path TEXT NOT NULL,
            public_url TEXT,
            status TEXT NOT NULL DEFAULT 'processing',
            views INTEGER DEFAULT 0,
            engagement_score FLOAT DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          -- Activer RLS
          ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
          
          -- Créer les politiques RLS
          CREATE POLICY "Users can view their own videos" ON public.videos
            FOR SELECT USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can insert their own videos" ON public.videos
            FOR INSERT WITH CHECK (auth.uid() = user_id);
          
          CREATE POLICY "Users can update their own videos" ON public.videos
            FOR UPDATE USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can delete their own videos" ON public.videos
            FOR DELETE USING (auth.uid() = user_id);
        `
      });

      if (createError) {
        console.error('Erreur lors de la création de la table videos:', createError);
        return new Response(JSON.stringify({
          error: 'Erreur lors de la création de la table videos',
          details: createError
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      tableCreated = true;
      console.log('Table videos créée avec succès');
    } else {
      console.log('La table videos existe déjà, vérification des colonnes...');
      
      // Vérifier si la colonne public_url existe
      const { error: columnCheckError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'videos' 
          AND column_name = 'public_url';
        `
      });

      // Si la colonne n'existe pas, l'ajouter
      if (columnCheckError) {
        console.log('Ajout de la colonne public_url...');
        const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
          sql: `ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS public_url TEXT;`
        });

        if (alterError) {
          console.error('Erreur lors de l\'ajout de la colonne public_url:', alterError);
          return new Response(JSON.stringify({
            error: 'Erreur lors de l\'ajout de la colonne public_url',
            details: alterError
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }

        tableUpdated = true;
        console.log('Colonne public_url ajoutée avec succès');
      }
    }

    // Vérifier si le bucket videos existe
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    let bucketCreated = false;

    if (bucketsError) {
      console.error('Erreur lors de la vérification des buckets:', bucketsError);
    } else {
      const videosBucket = buckets.find(b => b.name === 'videos');
      if (!videosBucket) {
        console.log('Création du bucket videos...');
        const { error: createBucketError } = await supabaseAdmin.storage.createBucket('videos', {
          public: true,
          fileSizeLimit: 100 * 1024 * 1024 // 100MB
        });

        if (createBucketError) {
          console.error('Erreur lors de la création du bucket videos:', createBucketError);
        } else {
          bucketCreated = true;
          console.log('Bucket videos créé avec succès');
        }
      }
    }

    // Créer une politique de stockage pour permettre l'accès public aux vidéos
    if (bucketCreated) {
      const { error: policyError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          BEGIN;
          -- Supprimer les politiques existantes pour éviter les conflits
          DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
          
          -- Créer une nouvelle politique pour l'accès public en lecture
          CREATE POLICY "Allow public read access" 
          ON storage.objects 
          FOR SELECT 
          USING (bucket_id = 'videos');
          
          -- Politique pour permettre aux utilisateurs authentifiés d'uploader des vidéos
          DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
          CREATE POLICY "Allow authenticated uploads" 
          ON storage.objects 
          FOR INSERT 
          WITH CHECK (
            bucket_id = 'videos' AND 
            auth.role() = 'authenticated' AND
            (storage.foldername(name))[1] = auth.uid()::text
          );
          COMMIT;
        `
      });

      if (policyError) {
        console.error('Erreur lors de la création des politiques de stockage:', policyError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Configuration de la base de données terminée',
      details: {
        tableCreated,
        tableUpdated,
        bucketCreated
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (err) {
    console.error('Erreur lors de la configuration de la base de données:', err);
    return new Response(JSON.stringify({
      error: 'Erreur serveur',
      details: err.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});
