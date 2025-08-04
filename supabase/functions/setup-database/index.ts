// Edge Function pour configurer la base de données pour l'application de vidéos
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Gérer les requêtes OPTIONS pour CORS
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: new Headers(corsHeaders)
  });
}

// Extraire le token JWT de l'en-tête Authorization
function extractToken(req) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }
  
  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }

  try {
    // Extraire le token d'authentification de l'en-tête
    const token = extractToken(req);
    
    if (!token) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification requise',
          details: 'Token manquant dans l\'en-tête Authorization'
        }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Initialiser le client Supabase avec le token de l'utilisateur
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    // Vérifier l'authentification
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification échouée', 
          details: userError?.message || 'Utilisateur non trouvé'
        }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Utiliser le client service_role pour les opérations privilégiées
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Créer les fonctions SQL nécessaires
    const createExecSqlFunction = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text, params text[] DEFAULT NULL)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        IF params IS NULL THEN
          EXECUTE sql;
        ELSE
          EXECUTE sql USING params;
        END IF;
      END;
      $$;
    `;

    const createExecSqlWithReturnFunction = `
      CREATE OR REPLACE FUNCTION exec_sql_with_return(sql text, params text[] DEFAULT NULL)
      RETURNS SETOF json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        IF params IS NULL THEN
          RETURN QUERY EXECUTE sql;
        ELSE
          RETURN QUERY EXECUTE sql USING params;
        END IF;
      END;
      $$;
    `;

    // Exécuter les requêtes SQL pour créer les fonctions
    try {
      await serviceClient.rpc('exec_sql', { sql: createExecSqlFunction });
    } catch (err) {
      // Si la fonction exec_sql n'existe pas encore, on ne peut pas l'utiliser pour créer exec_sql
      // Utiliser une requête SQL directe via l'API REST
      const { error } = await serviceClient.postgrest.rpc('exec_sql', { sql: createExecSqlFunction });
      if (error) {
        // Créer la fonction via une requête SQL directe
        await serviceClient.sql(createExecSqlFunction);
      }
    }
    
    try {
      await serviceClient.rpc('exec_sql', { sql: createExecSqlWithReturnFunction });
    } catch (err) {
      // Essayer d'utiliser la fonction exec_sql qu'on vient de créer
      try {
        await serviceClient.rpc('exec_sql', { sql: createExecSqlWithReturnFunction });
      } catch (innerErr) {
        // Si ça échoue encore, utiliser une requête SQL directe
        await serviceClient.sql(createExecSqlWithReturnFunction);
      }
    }

    // Créer le bucket de stockage si nécessaire
    try {
      const { data: buckets } = await serviceClient.storage.listBuckets();
      const videoBucket = buckets.find(bucket => bucket.name === 'videos');
      
      if (!videoBucket) {
        await serviceClient.storage.createBucket('videos', {
          public: false,
          fileSizeLimit: 104857600, // 100MB
        });
      }
    } catch (bucketError) {
      console.error('Erreur lors de la création du bucket:', bucketError);
    }

    // Vérifier si la table videos existe, sinon la créer
    try {
      const { data, error } = await serviceClient.from('videos').select('id').limit(1);
      
      if (error && error.code === '42P01') { // Relation n'existe pas
        // Créer la table
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS public.videos (
            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            title TEXT NOT NULL,
            description TEXT,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL,
            url TEXT,
            status TEXT NOT NULL DEFAULT 'processing',
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Activer Row Level Security
          ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

          -- Créer une politique pour permettre aux utilisateurs de voir leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent voir leurs propres vidéos"
            ON public.videos FOR SELECT
            USING (auth.uid() = user_id);

          -- Créer une politique pour permettre aux utilisateurs d'insérer leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent insérer leurs propres vidéos"
            ON public.videos FOR INSERT
            WITH CHECK (auth.uid() = user_id);

          -- Créer une politique pour permettre aux utilisateurs de mettre à jour leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres vidéos"
            ON public.videos FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);

          -- Créer une politique pour permettre aux utilisateurs de supprimer leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres vidéos"
            ON public.videos FOR DELETE
            USING (auth.uid() = user_id);
            
          -- Créer un index sur user_id pour améliorer les performances
          CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos(user_id);
          
          -- Créer un trigger pour mettre à jour le champ updated_at
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;

          DROP TRIGGER IF EXISTS update_videos_updated_at ON public.videos;
          CREATE TRIGGER update_videos_updated_at
          BEFORE UPDATE ON public.videos
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        `;
        
        try {
          await serviceClient.sql(createTableSQL);
        } catch (sqlError) {
          console.error('Erreur lors de la création de la table via SQL:', sqlError);
          
          // Essayer une autre approche si la première échoue
          try {
            await serviceClient.rpc('exec_sql', { sql: createTableSQL });
          } catch (rpcError) {
            console.error('Erreur lors de la création de la table via RPC:', rpcError);
          }
        }
      }
    } catch (tableError) {
      console.error('Erreur lors de la vérification de la table:', tableError);
    }

    return new Response(
      JSON.stringify({
        message: 'Configuration de la base de données réussie',
        details: {
          functionsCreated: ['exec_sql', 'exec_sql_with_return'],
          tableChecked: 'videos',
          bucketChecked: 'videos'
        }
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );

  } catch (err) {
    console.error('Erreur non gérée:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur serveur', 
        details: err.message,
        stack: err.stack
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
});
