// transcribe-video: Fonction Edge pour la transcription vidéo
// Version corrigée avec support des requêtes GET et client WhatsApp

import { createClient } from "npm:@supabase/supabase-js@2.39.8";

// Configuration Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// En-têtes CORS pour permettre les requêtes de différentes origines
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Gestion des requêtes OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Détection de l'agent utilisateur pour identifier WhatsApp
    const userAgent = req.headers.get('user-agent') || '';
    const isWhatsApp = userAgent.includes('WhatsApp');
    
    // Pour WhatsApp ou requêtes GET, utiliser la clé service_role
    // Cela permet de contourner l'authentification standard
    const supabase = createClient(
      supabaseUrl,
      isWhatsApp || req.method === 'GET' ? supabaseServiceRole : supabaseAnonKey,
      { 
        auth: { persistSession: false },
        global: { headers: { 'Content-Type': 'application/json' } }
      }
    );

    // Récupération de l'URL vidéo selon la méthode de requête
    let videoUrl = '';
    
    if (req.method === 'GET') {
      // Pour les requêtes GET (comme WhatsApp)
      const url = new URL(req.url);
      videoUrl = url.searchParams.get('videoUrl') || '';
    } else {
      // Pour les requêtes POST
      try {
        const body = await req.json();
        videoUrl = body.videoUrl || '';
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            error: 'Format de requête invalide',
            message: 'Le corps de la requête doit être au format JSON valide avec une propriété videoUrl'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Validation de l'URL vidéo
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'URL vidéo manquante', 
          message: 'Veuillez fournir une URL de vidéo à transcrire via le paramètre videoUrl' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Vérification du format de l'URL
    try {
      new URL(videoUrl); // Valide que c'est une URL bien formée
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'URL invalide', 
          message: 'L\'URL de la vidéo fournie n\'est pas valide' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Logique de transcription
    console.log(`Transcription demandée pour: ${videoUrl}`);
    
    // Enregistrement de la demande de transcription dans la base de données
    const { data: transcriptionData, error: dbError } = await supabase
      .from('transcriptions')
      .insert([
        { 
          video_url: videoUrl,
          status: 'processing',
          requested_by: isWhatsApp ? 'whatsapp' : 'web',
          created_at: new Date().toISOString()
        }
      ])
      .select();
    
    if (dbError) {
      console.error('Erreur base de données:', dbError);
      throw new Error('Erreur lors de l\'enregistrement de la transcription');
    }

    // Lancer le processus de transcription en arrière-plan
    const transcriptionPromise = startTranscriptionProcess(videoUrl, transcriptionData[0].id, supabase);
    EdgeRuntime.waitUntil(transcriptionPromise);

    // Réponse immédiate pendant que la transcription se poursuit en arrière-plan
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Transcription lancée avec succès',
        transcription_id: transcriptionData[0].id,
        video_url: videoUrl,
        estimated_completion_time: '60-120 secondes'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Erreur:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erreur serveur',
        message: error.message || 'Une erreur est survenue lors de la transcription',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Fonction pour gérer le processus de transcription en arrière-plan
async function startTranscriptionProcess(videoUrl, transcriptionId, supabase) {
  try {
    // Simulation du processus de transcription
    // Remplacez cette partie par votre logique réelle d'appel à un service de transcription
    console.log(`Démarrage de la transcription #${transcriptionId} pour ${videoUrl}`);
    
    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Exemple de résultat de transcription
    const transcriptionResult = {
      text: "Ceci est un exemple de transcription. Remplacez avec votre service réel de transcription.",
      duration: 60,
      language: "fr"
    };
    
    // Mise à jour de la base de données avec les résultats
    const { error } = await supabase
      .from('transcriptions')
      .update({ 
        status: 'completed',
        result: transcriptionResult,
        completed_at: new Date().toISOString()
      })
      .eq('id', transcriptionId);
    
    if (error) {
      console.error('Erreur lors de la mise à jour de la transcription:', error);
      throw error;
    }
    
    console.log(`Transcription #${transcriptionId} terminée avec succès`);
    
  } catch (error) {
    console.error(`Erreur lors du processus de transcription #${transcriptionId}:`, error);
    
    // Mise à jour du statut en cas d'erreur
    try {
      await supabase
        .from('transcriptions')
        .update({ 
          status: 'failed',
          error_message: error.message || 'Erreur inconnue lors de la transcription',
          completed_at: new Date().toISOString()
        })
        .eq('id', transcriptionId);
    } catch (dbError) {
      console.error('Erreur lors de la mise à jour du statut d\'échec:', dbError);
    }
  }
}
