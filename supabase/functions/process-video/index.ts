// Edge Function pour traiter les vidéos et mettre à jour leur statut
import { createClient } from 'jsr:@supabase/supabase-js@^2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  let video_id;
  try {
    // Récupérer les données de la requête
    const { video_id: id } = await req.json();
    video_id = id;
    
    if (!video_id) {
      return new Response(
        JSON.stringify({ error: 'ID de vidéo requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Extraire le token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé: Token manquant' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const token = authHeader.split(' ')[1];

    // Initialiser le client Supabase avec le token d'authentification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    // Client admin pour les opérations privilégiées
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Récupérer les informations de la vidéo
    const { data: video, error: videoError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', video_id)
      .single();

    if (videoError) {
      console.error('Erreur lors de la récupération de la vidéo:', videoError);
      return new Response(
        JSON.stringify({ error: `Vidéo non trouvée: ${videoError.message}` }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Vérifier si la vidéo est déjà traitée
    if (video.status === 'published') {
      return new Response(
        JSON.stringify({ message: 'La vidéo est déjà traitée', video }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Simuler un traitement asynchrone
    const processVideo = async () => {
      try {
        // Mettre à jour le statut en "processing"
        await adminSupabase
          .from('videos')
          .update({ status: 'processing' })
          .eq('id', video_id);

        console.log(`Vidéo ${video_id} - Début du traitement`);

        // Simuler un délai de traitement (5-10 secondes)
        await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));

        // Générer des métadonnées fictives pour la vidéo
        const metadata = {
          duration: Math.floor(30 + Math.random() * 300), // 30s à 5min
          resolution: '1920x1080',
          format: 'mp4',
          processed_at: new Date().toISOString()
        };

        // Simuler la transcription
        console.log(`Vidéo ${video_id} - Début de la transcription`);
        
        // Générer une transcription fictive
        const transcription = generateFakeTranscription();

        // Mettre à jour le statut en "published" avec les métadonnées et la transcription
        await adminSupabase
          .from('videos')
          .update({
            status: 'published',
            metadata,
            transcription,
            views: 0,
            engagement_score: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', video_id);

        console.log(`Vidéo ${video_id} traitée avec succès`);
      } catch (error) {
        console.error(`Erreur lors du traitement de la vidéo ${video_id}:`, error);
        
        // En cas d'erreur, mettre à jour le statut
        await adminSupabase
          .from('videos')
          .update({
            status: 'failed',
            error_message: error.message || 'Erreur inconnue',
            updated_at: new Date().toISOString()
          })
          .eq('id', video_id);
      }
    };

    // Démarrer le traitement en arrière-plan
    EdgeRuntime.waitUntil(processVideo());

    // Répondre immédiatement que le traitement a commencé
    return new Response(
      JSON.stringify({
        message: 'Traitement de la vidéo démarré',
        video_id,
        status: 'processing'
      }),
      { status: 202, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Erreur non gérée:', error);
    
    // Mettre à jour le statut en cas d'erreur si l'ID est disponible
    if (video_id) {
      try {
        const errorSupabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await errorSupabase
          .from('videos')
          .update({
            status: 'failed',
            error_message: error.message || 'Erreur inconnue',
            updated_at: new Date().toISOString()
          })
          .eq('id', video_id);
      } catch (updateError) {
        console.error('Erreur lors de la mise à jour du statut:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: `Erreur interne: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

// Fonction pour générer une transcription fictive
function generateFakeTranscription() {
  const phrases = [
    "Bonjour et bienvenue dans cette vidéo.",
    "Aujourd'hui, nous allons parler d'un sujet important.",
    "Comme vous pouvez le voir, il y a plusieurs aspects à considérer.",
    "Premièrement, il faut comprendre les bases du concept.",
    "Ensuite, nous examinerons les applications pratiques.",
    "Il est essentiel de noter que ces techniques sont en constante évolution.",
    "Pour conclure, j'espère que cette vidéo vous a été utile.",
    "N'oubliez pas de vous abonner pour plus de contenu similaire.",
    "Merci d'avoir regardé et à bientôt pour une nouvelle vidéo."
  ];
  
  // Mélanger et sélectionner aléatoirement des phrases
  const shuffled = [...phrases].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.floor(Math.random() * phrases.length) + 3);
  
  return selected.join(" ");
}
