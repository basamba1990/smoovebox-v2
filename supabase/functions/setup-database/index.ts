// Edge Function pour configurer automatiquement la base de données
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'

// Récupérer les variables d'environnement
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  try {
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
      )
    }

    // Gérer les requêtes OPTIONS pour CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      })
    }

    // Extraire le token d'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé: Token manquant' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      )
    }
    const token = authHeader.split(' ')[1]

    // Créer un client Supabase avec le token de l'utilisateur pour vérifier l'authentification
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    // Créer un client admin pour les opérations privilégiées
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Vérifier l'utilisateur
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé: Utilisateur non authentifié' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      )
    }

    // Vérifier si l'utilisateur est administrateur (optionnel)
    // const isAdmin = user.app_metadata?.role === 'admin'

    // Configurer la base de données
    const setupResults = await setupDatabase(supabaseAdmin)

    return new Response(
      JSON.stringify({
        message: 'Configuration de la base de données terminée avec succès',
        results: setupResults
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  } catch (error) {
    console.error('Erreur lors de la configuration de la base de données:', error)
    return new Response(
      JSON.stringify({ error: `Erreur: ${error.message}` }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})

// Fonction pour configurer la base de données
async function setupDatabase(supabaseAdmin) {
  const results = {
    storage: { success: false, message: '' },
    tables: { success: false, message: '' },
    policies: { success: false, message: '' }
  }

  try {
    // 1. Configurer le bucket de stockage
    try {
      // Vérifier si le bucket existe déjà
      const { data: buckets, error: bucketsError } = await supabaseAdmin
        .storage
        .listBuckets()

      if (bucketsError) {
        throw new Error(`Erreur lors de la vérification des buckets: ${bucketsError.message}`)
      }

      const videoBucketExists = buckets.some(bucket => bucket.name === 'videos')

      if (!videoBucketExists) {
        // Créer le bucket videos
        const { error: createBucketError } = await supabaseAdmin
          .storage
          .createBucket('videos', {
            public: true,
            fileSizeLimit: 104857600, // 100MB
            allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
          })

        if (createBucketError) {
          throw new Error(`Erreur lors de la création du bucket: ${createBucketError.message}`)
        }
      }

      results.storage = { success: true, message: 'Bucket de stockage configuré avec succès' }
    } catch (storageError) {
      console.error('Erreur lors de la configuration du stockage:', storageError)
      results.storage = { success: false, message: storageError.message }
    }

    // 2. Configurer les tables
    try {
      // Vérifier si la table videos existe
      const { data: tables, error: tablesError } = await supabaseAdmin
        .rpc('get_tables')

      if (tablesError) {
        // Méthode alternative si la fonction RPC n'existe pas
        const { data: tableInfo, error: tableInfoError } = await supabaseAdmin
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'videos')

        if (tableInfoError) {
          throw new Error(`Erreur lors de la vérification des tables: ${tableInfoError.message}`)
        }

        const videosTableExists = tableInfo && tableInfo.length > 0
        
        if (!videosTableExists) {
          // Créer la table videos
          await createVideosTable(supabaseAdmin)
        } else {
          // Vérifier et mettre à jour la structure de la table si nécessaire
          await updateVideosTable(supabaseAdmin)
        }
      } else {
        const videosTableExists = tables && tables.some(table => table.name === 'videos')
        
        if (!videosTableExists) {
          // Créer la table videos
          await createVideosTable(supabaseAdmin)
        } else {
          // Vérifier et mettre à jour la structure de la table si nécessaire
          await updateVideosTable(supabaseAdmin)
        }
      }

      results.tables = { success: true, message: 'Tables configurées avec succès' }
    } catch (tablesError) {
      console.error('Erreur lors de la configuration des tables:', tablesError)
      results.tables = { success: false, message: tablesError.message }
    }

    // 3. Configurer les politiques RLS
    try {
      await setupRLSPolicies(supabaseAdmin)
      results.policies = { success: true, message: 'Politiques RLS configurées avec succès' }
    } catch (policiesError) {
      console.error('Erreur lors de la configuration des politiques RLS:', policiesError)
      results.policies = { success: false, message: policiesError.message }
    }

    return results
  } catch (error) {
    console.error('Erreur générale lors de la configuration de la base de données:', error)
    throw error
  }
}

// Fonction pour créer la table videos
async function createVideosTable(supabaseAdmin) {
  // Créer la table videos
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS public.videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT,
      public_url TEXT,
      status TEXT NOT NULL CHECK (status IN ('processing', 'published', 'draft', 'failed')),
      error TEXT,
      transcription TEXT,
      analysis JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
    );
  `
  
  const { error: createTableError } = await supabaseAdmin.rpc('exec', { query: createTableQuery })
  
  if (createTableError) {
    throw new Error(`Erreur lors de la création de la table videos: ${createTableError.message}`)
  }
  
  // Activer RLS sur la table
  const enableRLSQuery = `
    ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
  `
  
  const { error: enableRLSError } = await supabaseAdmin.rpc('exec', { query: enableRLSQuery })
  
  if (enableRLSError) {
    throw new Error(`Erreur lors de l'activation de RLS: ${enableRLSError.message}`)
  }
  
  // Créer un index sur user_id pour améliorer les performances
  const createIndexQuery = `
    CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos (user_id);
  `
  
  const { error: createIndexError } = await supabaseAdmin.rpc('exec', { query: createIndexQuery })
  
  if (createIndexError) {
    throw new Error(`Erreur lors de la création de l'index: ${createIndexError.message}`)
  }
}

// Fonction pour mettre à jour la table videos si nécessaire
async function updateVideosTable(supabaseAdmin) {
  // Vérifier si la colonne id a une valeur par défaut
  const checkIdDefaultQuery = `
    SELECT column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'videos'
      AND column_name = 'id';
  `
  
  const { data: idColumnInfo, error: idColumnError } = await supabaseAdmin.rpc('exec', { query: checkIdDefaultQuery })
  
  if (idColumnError) {
    throw new Error(`Erreur lors de la vérification de la colonne id: ${idColumnError.message}`)
  }
  
  // Si la colonne id n'a pas de valeur par défaut, ajouter gen_random_uuid()
  if (idColumnInfo && idColumnInfo.length > 0 && !idColumnInfo[0].column_default) {
    const updateIdColumnQuery = `
      ALTER TABLE public.videos
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
    `
    
    const { error: updateIdError } = await supabaseAdmin.rpc('exec', { query: updateIdColumnQuery })
    
    if (updateIdError) {
      throw new Error(`Erreur lors de la mise à jour de la colonne id: ${updateIdError.message}`)
    }
  }
  
  // Vérifier si la colonne public_url existe
  const checkPublicUrlQuery = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'videos'
      AND column_name = 'public_url';
  `
  
  const { data: publicUrlColumnInfo, error: publicUrlColumnError } = await supabaseAdmin.rpc('exec', { query: checkPublicUrlQuery })
  
  if (publicUrlColumnError) {
    throw new Error(`Erreur lors de la vérification de la colonne public_url: ${publicUrlColumnError.message}`)
  }
  
  // Si la colonne public_url n'existe pas, l'ajouter
  if (!publicUrlColumnInfo || publicUrlColumnInfo.length === 0) {
    const addPublicUrlColumnQuery = `
      ALTER TABLE public.videos
      ADD COLUMN public_url TEXT;
    `
    
    const { error: addPublicUrlError } = await supabaseAdmin.rpc('exec', { query: addPublicUrlColumnQuery })
    
    if (addPublicUrlError) {
      throw new Error(`Erreur lors de l'ajout de la colonne public_url: ${addPublicUrlError.message}`)
    }
  }
  
  // Vérifier la contrainte sur la colonne status
  const checkStatusConstraintQuery = `
    SELECT pg_get_constraintdef(con.oid) as constraint_def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'videos'
      AND con.conname LIKE '%status%';
  `
  
  const { data: statusConstraintInfo, error: statusConstraintError } = await supabaseAdmin.rpc('exec', { query: checkStatusConstraintQuery })
  
  if (statusConstraintError) {
    throw new Error(`Erreur lors de la vérification de la contrainte status: ${statusConstraintError.message}`)
  }
  
  // Si la contrainte status n'existe pas ou n'est pas correcte, la mettre à jour
  const correctConstraint = "CHECK (status = ANY (ARRAY['processing'::text, 'published'::text, 'draft'::text, 'failed'::text]))"
  
  if (!statusConstraintInfo || statusConstraintInfo.length === 0 || !statusConstraintInfo[0].constraint_def.includes(correctConstraint)) {
    // Supprimer l'ancienne contrainte si elle existe
    const dropConstraintQuery = `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
          WHERE nsp.nspname = 'public'
            AND rel.relname = 'videos'
            AND con.conname LIKE '%status%'
        ) THEN
          EXECUTE (
            SELECT 'ALTER TABLE public.videos DROP CONSTRAINT ' || conname
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'public'
              AND rel.relname = 'videos'
              AND con.conname LIKE '%status%'
            LIMIT 1
          );
        END IF;
      END $$;
    `
    
    const { error: dropConstraintError } = await supabaseAdmin.rpc('exec', { query: dropConstraintQuery })
    
    if (dropConstraintError) {
      throw new Error(`Erreur lors de la suppression de l'ancienne contrainte: ${dropConstraintError.message}`)
    }
    
    // Ajouter la nouvelle contrainte
    const addConstraintQuery = `
      ALTER TABLE public.videos
      ADD CONSTRAINT videos_status_check
      CHECK (status IN ('processing', 'published', 'draft', 'failed'));
    `
    
    const { error: addConstraintError } = await supabaseAdmin.rpc('exec', { query: addConstraintQuery })
    
    if (addConstraintError) {
      throw new Error(`Erreur lors de l'ajout de la nouvelle contrainte: ${addConstraintError.message}`)
    }
  }
}

// Fonction pour configurer les politiques RLS
async function setupRLSPolicies(supabaseAdmin) {
  // Politique pour SELECT (lecture)
  const selectPolicyQuery = `
    CREATE POLICY IF NOT EXISTS "Utilisateurs peuvent voir leurs propres vidéos"
    ON public.videos
    FOR SELECT
    TO authenticated
    USING ((user_id = auth.uid()));
  `
  
  const { error: selectPolicyError } = await supabaseAdmin.rpc('exec', { query: selectPolicyQuery })
  
  if (selectPolicyError) {
    throw new Error(`Erreur lors de la création de la politique SELECT: ${selectPolicyError.message}`)
  }
  
  // Politique pour INSERT (création)
  const insertPolicyQuery = `
    CREATE POLICY IF NOT EXISTS "Utilisateurs peuvent créer leurs propres vidéos"
    ON public.videos
    FOR INSERT
    TO authenticated
    WITH CHECK ((user_id = auth.uid()));
  `
  
  const { error: insertPolicyError } = await supabaseAdmin.rpc('exec', { query: insertPolicyQuery })
  
  if (insertPolicyError) {
    throw new Error(`Erreur lors de la création de la politique INSERT: ${insertPolicyError.message}`)
  }
  
  // Politique pour UPDATE (mise à jour)
  const updatePolicyQuery = `
    CREATE POLICY IF NOT EXISTS "Utilisateurs peuvent mettre à jour leurs propres vidéos"
    ON public.videos
    FOR UPDATE
    TO authenticated
    USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));
  `
  
  const { error: updatePolicyError } = await supabaseAdmin.rpc('exec', { query: updatePolicyQuery })
  
  if (updatePolicyError) {
    throw new Error(`Erreur lors de la création de la politique UPDATE: ${updatePolicyError.message}`)
  }
  
  // Politique pour DELETE (suppression)
  const deletePolicyQuery = `
    CREATE POLICY IF NOT EXISTS "Utilisateurs peuvent supprimer leurs propres vidéos"
    ON public.videos
    FOR DELETE
    TO authenticated
    USING ((user_id = auth.uid()));
  `
  
  const { error: deletePolicyError } = await supabaseAdmin.rpc('exec', { query: deletePolicyQuery })
  
  if (deletePolicyError) {
    throw new Error(`Erreur lors de la création de la politique DELETE: ${deletePolicyError.message}`)
  }
}
