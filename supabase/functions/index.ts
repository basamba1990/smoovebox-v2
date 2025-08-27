// Edge Function pour l'upload sécurisé de vidéos
// Fichier: supabase/functions/secure-video-upload/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface VideoUploadRequest {
  title: string;
  description?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  duration_seconds?: number;
}

interface VideoValidationResult {
  isValid: boolean;
  errors: string[];
}

// Configuration des limites
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_DURATION = 30 * 60; // 30 minutes
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

function validateVideoUpload(data: VideoUploadRequest): VideoValidationResult {
  const errors: string[] = [];

  // Validation du titre
  if (!data.title || data.title.trim().length === 0) {
    errors.push('Le titre est requis');
  } else if (data.title.length > 200) {
    errors.push('Le titre ne peut pas dépasser 200 caractères');
  }

  // Validation de la description
  if (data.description && data.description.length > 1000) {
    errors.push('La description ne peut pas dépasser 1000 caractères');
  }

  // Validation du fichier
  if (!data.file_name || data.file_name.trim().length === 0) {
    errors.push('Le nom du fichier est requis');
  }

  if (!data.file_size || data.file_size <= 0) {
    errors.push('La taille du fichier est invalide');
  } else if (data.file_size > MAX_FILE_SIZE) {
    errors.push(`La taille du fichier ne peut pas dépasser ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  if (!data.file_type || !ALLOWED_TYPES.includes(data.file_type)) {
    errors.push(`Type de fichier non supporté. Types autorisés: ${ALLOWED_TYPES.join(', ')}`);
  }

  // Validation de la durée
  if (data.duration_seconds && data.duration_seconds > MAX_DURATION) {
    errors.push(`La durée ne peut pas dépasser ${MAX_DURATION / 60} minutes`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

function generateSecureFileName(originalName: string, userId: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop() || 'mp4';
  return `${userId}/${timestamp}_${randomString}.${extension}`;
}

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialiser le client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer le token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification requis' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Vérifier l'utilisateur authentifié
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Erreur d\'authentification:', authError);
      return new Response(
        JSON.stringify({ error: 'Utilisateur non authentifié' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parser les données de la requête
    const uploadData: VideoUploadRequest = await req.json();

    // Valider les données
    const validation = validateVideoUpload(uploadData);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ 
          error: 'Données invalides', 
          details: validation.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Vérifier les quotas utilisateur (exemple: max 10 vidéos par jour)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: todayUploads, error: countError } = await supabaseClient
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString());

    if (countError) {
      console.error('Erreur lors de la vérification des quotas:', countError);
    } else if (todayUploads && todayUploads >= 10) {
      return new Response(
        JSON.stringify({ 
          error: 'Quota dépassé', 
          details: 'Vous avez atteint la limite de 10 vidéos par jour' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Générer un nom de fichier sécurisé
    const secureFileName = generateSecureFileName(uploadData.file_name, user.id);

    // Créer l'entrée vidéo dans la base de données
    const { data: videoRecord, error: createError } = await supabaseClient
      .from('videos')
      .insert({
        user_id: user.id,
        title: uploadData.title.trim(),
        description: uploadData.description?.trim() || null,
        file_name: uploadData.file_name,
        file_path: secureFileName,
        file_size: uploadData.file_size,
        file_type: uploadData.file_type,
        duration_seconds: uploadData.duration_seconds || null,
        status: 'uploading',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Erreur lors de la création de l\'enregistrement vidéo:', createError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création de l\'enregistrement vidéo' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Générer une URL de upload signée
    const { data: uploadUrl, error: urlError } = await supabaseClient.storage
      .from('videos')
      .createSignedUploadUrl(secureFileName, {
        upsert: false
      });

    if (urlError) {
      console.error('Erreur lors de la génération de l\'URL de upload:', urlError);
      
      // Nettoyer l'enregistrement créé en cas d'erreur
      await supabaseClient
        .from('videos')
        .delete()
        .eq('id', videoRecord.id);

      return new Response(
        JSON.stringify({ error: 'Erreur lors de la génération de l\'URL de upload' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Logger l'activité
    await supabaseClient
      .from('user_activities')
      .insert({
        user_id: user.id,
        activity_type: 'video_upload_initiated',
        activity_data: {
          video_id: videoRecord.id,
          file_name: uploadData.file_name,
          file_size: uploadData.file_size,
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        video_id: videoRecord.id,
        upload_url: uploadUrl.signedUrl,
        upload_token: uploadUrl.token,
        file_path: secureFileName,
        message: 'URL de upload générée avec succès'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur dans secure-video-upload:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

