// Edge Function pour traiter une vidéo après son upload
import { createClient } from 'jsr:@supabase/supabase-js@^2';
import { corsHeaders } from '../_shared/cors.ts';

// Constantes pour les statuts de vidéo
const VIDEO_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: new Headers(corsHeaders)
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

    // Récupérer les données de la requête
    const { videoId } = await req.json();
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'ID de vidéo requis' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Récupérer les informations de la vidéo
    const { data: video, error: fetchError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (fetchError || !video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée', details: fetchError?.message }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    // Vérifier que l'utilisateur est bien le propriétaire de la vidéo
    if (video.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Vous n\'êtes pas autorisé à traiter cette vidéo' }),
        { 
          status: 403, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Traitement asynchrone de la vidéo
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // Mettre à jour le statut pour indiquer que le traitement a commencé
          await supabaseClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.PROCESSING
            })
            .eq('id', videoId);
          
          // Simuler un délai de traitement
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Ici, vous pourriez effectuer des opérations comme :
          // - Générer une miniature
          // - Extraire des métadonnées (durée, résolution)
          // - Transcoder la vidéo
          // - Générer des sous-titres
          
          // Mettre à jour le statut de la vidéo une fois le traitement terminé
          await supabaseClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.READY,
              // Vous pourriez également mettre à jour d'autres champs comme duration, thumbnail_url, etc.
            })
            .eq('id', videoId);
        } catch (err) {
          console.error('Erreur lors du traitement asynchrone:', err);
          
          // En cas d'erreur, mettre à jour le statut
          await supabaseClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.ERROR,
              error_message: 'Erreur lors du traitement de la vidéo'
            })
            .eq('id', videoId);
        }
      })()
    );

    // Retourner une réponse immédiate
    return new Response(
      JSON.stringify({
        message: 'Traitement de la vidéo démarré',
        videoId
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
