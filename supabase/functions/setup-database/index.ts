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

// Fonction pour extraire le token JWT de l'en-tête Authorization
function extractToken(req) {
  // Essayer d'abord l'en-tête Authorization standard
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Si pas d'en-tête Authorization, vérifier dans les cookies
  const cookieHeader = req.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('sb-access-token='));
    if (authCookie) {
      return authCookie.substring('sb-access-token='.length);
    }
  }
  
  // Vérifier dans les paramètres de requête
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (token) {
    return token;
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
    // Récupérer le token d'authentification
    const token = extractToken(req);
    
    if (!token) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification requise', 
          debug: {
            hasAuthHeader: !!req.headers.get('Authorization'),
            authHeaderValue: req.headers.get('Authorization')?.substring(0, 20) + '...',
            hasCookie: !!req.headers.get('Cookie'),
          }
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

    // Initialiser le client Supabase avec le token récupéré
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Utilisateur non authentifié', 
          details: authError?.message,
          debug: {
            tokenLength: token?.length,
            tokenStart: token?.substring(0, 10) + '...',
          }
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

    // Utiliser le client service_role pour les opérations administratives
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Créer les fonctions RPC nécessaires
    const createCheckTableExistsFunction = `
      CREATE OR REPLACE FUNCTION check_table_exists(table_name TEXT)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        table_exists BOOLEAN;
      BEGIN
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) INTO table_exists;
        
        RETURN table_exists;
      END;
      $$;
    `;

    const createVideosTableFunction = `
      CREATE OR REPLACE FUNCTION create_videos_table()
      RETURNS VOID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- Créer la table videos si elle n'existe pas
        CREATE TABLE IF NOT EXISTS videos (
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
        ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

        -- Créer une politique pour permettre aux utilisateurs de voir leurs propres vidéos
        CREATE POLICY "Les utilisateurs peuvent voir leurs propres vidéos"
          ON videos FOR SELECT
          USING (auth.uid() = user_id);

        -- Créer une politique pour permettre aux utilisateurs d'insérer leurs propres vidéos
        CREATE POLICY "Les utilisateurs peuvent insérer leurs propres vidéos"
          ON videos FOR INSERT
          WITH CHECK (auth.uid() = user_id);

        -- Créer une politique pour permettre aux utilisateurs de mettre à jour leurs propres vidéos
        CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres vidéos"
          ON videos FOR UPDATE
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);

        -- Créer une politique pour permettre aux utilisateurs de supprimer leurs propres vidéos
        CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres vidéos"
          ON videos FOR DELETE
          USING (auth.uid() = user_id);
          
        -- Créer un index sur user_id pour améliorer les performances
        CREATE INDEX IF NOT EXISTS videos_user_id_idx ON videos(user_id);
        
        -- Créer un trigger pour mettre à jour le champ updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
        CREATE TRIGGER update_videos_updated_at
        BEFORE UPDATE ON videos
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      END;
      $$;
    `;

    // Exécuter les requêtes SQL pour créer les fonctions
    await serviceClient.rpc('exec_sql', { sql: createCheckTableExistsFunction });
    await serviceClient.rpc('exec_sql', { sql: createVideosTableFunction });

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
    const { data: tableExists } = await serviceClient.rpc('check_table_exists', { table_name: 'videos' });
    
    if (!tableExists) {
      await serviceClient.rpc('create_videos_table');
    }

    // Créer la fonction exec_sql si elle n'existe pas déjà
    const createExecSqlFunction = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `;

    try {
      await serviceClient.rpc('exec_sql', { sql: createExecSqlFunction });
    } catch (error) {
      // La fonction existe probablement déjà, ignorons l'erreur
      console.log('Note: La fonction exec_sql existe peut-être déjà');
    }

    return new Response(
      JSON.stringify({
        message: 'Configuration de la base de données réussie',
        details: {
          functionsCreated: ['check_table_exists', 'create_videos_table', 'exec_sql'],
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
      JSON.stringify({ error: 'Erreur serveur', details: err.message }),
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
