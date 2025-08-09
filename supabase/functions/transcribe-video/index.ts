// Fonction Edge pour la transcription vidéo avec support pour WhatsApp
// Cette version permet les requêtes GET et supporte les clients WhatsApp

import { createClient } from "npm:@supabase/supabase-js@2.39.8";

// Création du client Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Gérer les requêtes CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Détection du client WhatsApp
    const userAgent = req.headers.get('user-agent') || '';
    const isWhatsApp = userAgent.includes('WhatsApp');
    
    // Pour les requêtes WhatsApp ou GET, utiliser le service_role pour l'authentification
    const supabase = createClient(
      supabaseUrl,
      isWhatsApp || req.method === 'GET' ? supabaseServiceRole : supabaseAnonKey,
      { auth: { persistSession: false } }
    );

    // Récupération des paramètres (depuis URL pour GET, depuis body pour POST)
    let videoUrl = '';
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      videoUrl = url.searchParams.get('videoUrl') || '';
    } else {
      // Pour les requêtes POST
      try {
        const body = await req.json();
        videoUrl = body.videoUrl || '';
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Format de requête invalide' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validation de l'URL vidéo
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ 
          error: 'URL vidéo manquante', 
          message: 'Veuillez fournir une URL de vidéo à transcrire' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Logique de transcription vidéo
    // Remplacez cette partie par votre logique réelle de transcription
    console.log(`Transcription demandée pour la vidéo: ${videoUrl}`);
    
    // Exemple de transcription simulée
    const transcriptionResult = {
      status: 'success',
      message: 'Transcription en cours',
      videoUrl: videoUrl,
      estimatedCompletionTime: '60 seconds'
    };

    // Enregistrement de la transcription dans la base de données
    // Décommentez et adaptez selon votre schéma de base de données
    /*
    const { data, error } = await supabase
      .from('transcriptions')
      .insert([
        { 
          video_url: videoUrl,
          status: 'processing',
          created_at: new Date().toISOString()
        }
      ])
      .select();
    
    if (error) throw error;
    */

    return new Response(
      JSON.stringify(transcriptionResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Erreur:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Une erreur est survenue lors de la transcription',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
