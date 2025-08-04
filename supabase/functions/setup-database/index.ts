// Edge Function pour configurer la base de données
import { createClient } from 'jsr:@supabase/supabase-js@^2';

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
    // Initialiser le client Supabase avec le token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Utilisateur non authentifié', details: authError?.message }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Créer les fonctions SQL nécessaires
    const setupResults = {
      bucket: null,
      table: null,
      functions: null
    };

    // 1. Créer le bucket "videos" s'il n'existe pas
    try {
      const { data: buckets } = await supabaseClient.storage.listBuckets();
      const videoBucket = buckets.find(bucket => bucket.name === 'videos');
      
      if (!videoBucket) {
        // Créer le bucket s'il n'existe pas
        await supabaseClient.storage.createBucket('videos', {
          public: false,
          fileSizeLimit: 104857600, // 100MB en octets
        });
        setupResults.bucket = 'created';
      } else {
        setupResults.bucket = 'exists';
      }
    } catch (bucketError) {
      console.error('Erreur lors de la création du bucket:', bucketError);
      setupResults.bucket = `error: ${bucketError.message}`;
    }

    // 2. Créer les fonctions SQL nécessaires
    try {
      // Fonction pour vérifier si une table existe
      const { error: checkTableFnError } = await supabaseClient.rpc('create_check_table_exists_function');
      
      if (checkTableFnError) {
        // La fonction existe peut-être déjà, essayons de créer la fonction nous-mêmes
        const { error: createFnError } = await supabaseClient.from('_functions').insert({
          name: 'check_table_exists',
          code: `
          CREATE OR REPLACE FUNCTION check_table_exists(table_name text)
          RETURNS boolean
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
            table_exists boolean;
          BEGIN
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            ) INTO table_exists;
            
            RETURN table_exists;
          END;
          $$;
          `
        });
        
        if (createFnError) {
          console.error('Erreur lors de la création de la fonction check_table_exists:', createFnError);
        }
      }
      
      // Fonction pour créer la table videos
      const { error: createTableFnError } = await supabaseClient.rpc('create_videos_table_function');
      
      if (createTableFnError) {
        // La fonction existe peut-être déjà, essayons de créer la fonction nous-mêmes
        const { error: createFnError } = await supabaseClient.from('_functions').insert({
          name: 'create_videos_table',
          code: `
          CREATE OR REPLACE FUNCTION create_videos_table()
          RETURNS void
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            -- Créer la table si elle n'existe pas
            CREATE TABLE IF NOT EXISTS public.videos (
              id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
              created_at timestamp with time zone DEFAULT now() NOT NULL,
              updated_at timestamp with time zone DEFAULT now() NOT NULL,
              title text NOT NULL,
              description text,
              user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
              url text,
              storage_path text NOT NULL,
              status text DEFAULT 'processing' NOT NULL,
              error_message text,
              duration integer,
              thumbnail_url text
            );
            
            -- Ajouter les commentaires
            COMMENT ON TABLE public.videos IS 'Table pour stocker les vidéos uploadées par les utilisateurs';
            COMMENT ON COLUMN public.videos.id IS 'Identifiant unique de la vidéo';
            COMMENT ON COLUMN public.videos.created_at IS 'Date de création de l''enregistrement';
            COMMENT ON COLUMN public.videos.updated_at IS 'Date de dernière mise à jour de l''enregistrement';
            COMMENT ON COLUMN public.videos.title IS 'Titre de la vidéo';
            COMMENT ON COLUMN public.videos.description IS 'Description de la vidéo';
            COMMENT ON COLUMN public.videos.user_id IS 'Identifiant de l''utilisateur qui a uploadé la vidéo';
            COMMENT ON COLUMN public.videos.url IS 'URL publique de la vidéo';
            COMMENT ON COLUMN public.videos.storage_path IS 'Chemin de stockage de la vidéo dans le bucket';
            COMMENT ON COLUMN public.videos.status IS 'Statut de la vidéo (processing, ready, error)';
            COMMENT ON COLUMN public.videos.error_message IS 'Message d''erreur en cas de problème';
            COMMENT ON COLUMN public.videos.duration IS 'Durée de la vidéo en secondes';
            COMMENT ON COLUMN public.videos.thumbnail_url IS 'URL de la miniature de la vidéo';
            
            -- Créer les index
            CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos (user_id);
            CREATE INDEX IF NOT EXISTS videos_status_idx ON public.videos (status);
            
            -- Activer RLS
            ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
            
            -- Créer les politiques RLS
            DO $$
            BEGIN
              -- Politique pour permettre à l'utilisateur de voir ses propres vidéos
              IF NOT EXISTS (
                SELECT FROM pg_policies WHERE tablename = 'videos' AND policyname = 'Users can view their own videos'
              ) THEN
                CREATE POLICY "Users can view their own videos" ON public.videos
                  FOR SELECT USING (auth.uid() = user_id);
              END IF;
              
              -- Politique pour permettre à l'utilisateur d'insérer ses propres vidéos
              IF NOT EXISTS (
                SELECT FROM pg_policies WHERE tablename = 'videos' AND policyname = 'Users can insert their own videos'
              ) THEN
                CREATE POLICY "Users can insert their own videos" ON public.videos
                  FOR INSERT WITH CHECK (auth.uid() = user_id);
              END IF;
              
              -- Politique pour permettre à l'utilisateur de mettre à jour ses propres vidéos
              IF NOT EXISTS (
                SELECT FROM pg_policies WHERE tablename = 'videos' AND policyname = 'Users can update their own videos'
              ) THEN
                CREATE POLICY "Users can update their own videos" ON public.videos
                  FOR UPDATE USING (auth.uid() = user_id);
              END IF;
              
              -- Politique pour permettre à l'utilisateur de supprimer ses propres vidéos
              IF NOT EXISTS (
                SELECT FROM pg_policies WHERE tablename = 'videos' AND policyname = 'Users can delete their own videos'
              ) THEN
                CREATE POLICY "Users can delete their own videos" ON public.videos
                  FOR DELETE USING (auth.uid() = user_id);
              END IF;
            END
            $$;
            
            -- Créer un trigger pour mettre à jour updated_at
            DROP TRIGGER IF EXISTS set_updated_at ON public.videos;
            CREATE TRIGGER set_updated_at
              BEFORE UPDATE ON public.videos
              FOR EACH ROW
              EXECUTE FUNCTION public.set_updated_at();
          END;
          $$;
          `
        });
        
        if (createFnError) {
          console.error('Erreur lors de la création de la fonction create_videos_table:', createFnError);
        }
      }
      
      setupResults.functions = 'created';
    } catch (fnError) {
      console.error('Erreur lors de la création des fonctions:', fnError);
      setupResults.functions = `error: ${fnError.message}`;
    }

    // 3. Créer la table videos si elle n'existe pas
    try {
      // Vérifier si la table existe
      const { data: tableExists, error: tableCheckError } = await supabaseClient.rpc('check_table_exists', { table_name: 'videos' });
      
      if (tableCheckError || !tableExists) {
        // La table n'existe pas, essayons de la créer
        const { error: createTableError } = await supabaseClient.rpc('create_videos_table');
        
        if (createTableError) {
          console.error('Erreur lors de la création de la table videos:', createTableError);
          setupResults.table = `error: ${createTableError.message}`;
        } else {
          setupResults.table = 'created';
        }
      } else {
        setupResults.table = 'exists';
      }
    } catch (tableError) {
      console.error('Erreur lors de la vérification/création de la table:', tableError);
      setupResults.table = `error: ${tableError.message}`;
    }

    // Retourner les résultats
    return new Response(
      JSON.stringify({
        message: 'Configuration de la base de données terminée',
        results: setupResults
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
