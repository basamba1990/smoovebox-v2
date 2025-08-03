// Edge Function pour la transcription vidéo
import { createClient } from 'jsr:@supabase/supabase-js@^2';

// Configuration des headers CORS
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

  try {
    // Vérifier la méthode HTTP
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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

    // Créer un client Supabase avec le token de l'utilisateur pour respecter RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // Créer un client admin pour les opérations privilégiées
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Vérifier l'utilisateur
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé: Utilisateur non authentifié' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Récupérer les données de la requête
    const { video_id: videoId } = await req.json();
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'ID de vidéo manquant' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Vérifier que la vidéo existe et appartient à l'utilisateur
    const { data: video, error: videoError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée ou accès non autorisé' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Mettre à jour le statut de la vidéo
    const { error: updateError } = await supabaseAdmin
      .from('videos')
      .update({ status: 'processing' })
      .eq('id', videoId);

    if (updateError) {
      console.error('Erreur lors de la mise à jour du statut:', updateError);
    }

    // Démarrer la transcription en arrière-plan
    const transcriptionPromise = async () => {
      try {
        console.log(`Début de la transcription pour la vidéo ${videoId}`);
        
        // Simuler un délai de traitement (5-15 secondes)
        await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 10000));
        
        // Générer une transcription fictive
        const transcription = generateFakeTranscription();
        
        // Mettre à jour la vidéo avec la transcription
        const { error: transcriptionError } = await supabaseAdmin
          .from('videos')
          .update({
            transcription: transcription,
            status: 'published',
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);

        if (transcriptionError) {
          throw new Error(`Erreur lors de l'enregistrement de la transcription: ${transcriptionError.message}`);
        }

        console.log(`Transcription terminée avec succès pour la vidéo ${videoId}`);
      } catch (error) {
        console.error(`Erreur lors de la transcription de la vidéo ${videoId}:`, error);
        
        // Mettre à jour le statut en cas d'échec
        await supabaseAdmin
          .from('videos')
          .update({ 
            status: 'failed',
            error_message: `Erreur de transcription: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      }
    };
    
    // Utiliser EdgeRuntime.waitUntil pour permettre à la fonction de continuer en arrière-plan
    EdgeRuntime.waitUntil(transcriptionPromise());
    
    return new Response(
      JSON.stringify({ 
        message: 'Transcription démarrée avec succès',
        videoId: videoId
      }),
      { status: 202, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Erreur générale:', error);
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
