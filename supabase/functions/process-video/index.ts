// Edge Function pour traiter les vidéos après upload direct au Storage
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { v4 as uuidv4 } from 'npm:uuid@9.0.1';

// Constantes pour les statuts de vidéo
const VIDEO_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
};

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    // Récupérer les données de la requête
    const { title, description, storagePath, fileName, fileType, fileSize } = await req.json();
    
    // Vérifier les données requises
    if (!title || !storagePath) {
      return new Response(
        JSON.stringify({ error: 'Titre et chemin de stockage requis' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Initialiser le client Supabase avec le contexte de l'utilisateur authentifié
    // Cela fonctionne car l'Edge Function est appelée via supabase.functions.invoke()
    // qui transmet automatiquement le token d'authentification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification échouée', 
          details: authError?.message || 'Utilisateur non trouvé'
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

    // Initialiser le client service_role pour les opérations privilégiées
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Vérifier si la table "videos" existe, sinon la créer
    try {
      // Exécuter une requête SQL directement
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

    // Insérer l'enregistrement dans la base de données
    const { data: video, error: insertError } = await serviceClient
      .from('videos')
      .insert({
        title,
        description,
        user_id: user.id,
        storage_path: storagePath,
        status: VIDEO_STATUS.PROCESSING
      })
      .select()
      .single();

    if (insertError) {
      // Si l'insertion échoue, supprimer le fichier uploadé
      await serviceClient.storage.from('videos').remove([storagePath]);
      
      console.error('Erreur d\'insertion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement de la vidéo', details: insertError.message }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Déclencher le traitement asynchrone de la vidéo
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // Simuler un délai de traitement
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // CORRECTION: Utiliser createSignedUrl au lieu de générer une URL publique
          const { data: signedUrl, error: urlError } = await serviceClient.storage
            .from('videos')
            .createSignedUrl(storagePath, 365 * 24 * 60 * 60); // URL valide pendant 1 an
          
          if (urlError) {
            console.error('Erreur lors de la génération de l\'URL signée:', urlError);
            
            // En cas d'erreur, mettre à jour le statut
            await serviceClient
              .from('videos')
              .update({
                status: VIDEO_STATUS.ERROR,
                error_message: `Erreur lors de la génération de l'URL: ${urlError.message}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', video.id);
              
            return;
          }
          
          // Mettre à jour le statut de la vidéo et l'URL
          await serviceClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.READY,
              url: signedUrl?.signedUrl || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', video.id);
        } catch (err) {
          console.error('Erreur lors du traitement asynchrone:', err);
          
          // En cas d'erreur, mettre à jour le statut
          await serviceClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.ERROR,
              error_message: 'Erreur lors du traitement de la vidéo',
              updated_at: new Date().toISOString()
            })
            .eq('id', video.id);
        }
      })()
    );

    // Retourner la réponse avec les données de la vidéo
    return new Response(
      JSON.stringify({
        message: 'Vidéo uploadée avec succès et en cours de traitement',
        video
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
