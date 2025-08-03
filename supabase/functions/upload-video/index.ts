import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { v4 as uuidv4 } from 'npm:uuid@9.0.1';

// Headers CORS pour toutes les réponses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Vérification de l'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Initialisation du client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Vérification de l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non authentifié' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Traitement de la requête multipart/form-data
    const formData = await req.formData();
    const videoFile = formData.get('video');
    const title = formData.get('title')?.toString() || 'Sans titre';
    const description = formData.get('description')?.toString() || '';

    // Validation du fichier
    if (!videoFile || !(videoFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Fichier vidéo requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Génération d'un nom de fichier unique
    const fileExt = videoFile.name.split('.').pop();
    const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
    
    // Upload du fichier vers Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, videoFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: 'Échec de l\'upload: ' + uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Récupération de l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    // Insertion dans la base de données avec une approche directe
    // Utilisation d'un objet minimal avec les champs requis
    const videoData = {
      user_id: user.id,
      title: title,
      description: description || null,
      storage_path: fileName, // Champ obligatoire
      url: publicUrl, // Champ obligatoire
      status: 'processing'
    };
    
    // Insertion directe dans la base de données
    const { data, error } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .single();

    if (error) {
      // Si l'insertion échoue, essayer avec la fonction RPC
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('insert_video_safe', {
          p_user_id: user.id,
          p_title: title,
          p_description: description || null,
          p_storage_path: fileName,
          p_url: publicUrl
        });
        
        if (rpcError) {
          throw rpcError;
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Vidéo uploadée avec succès (via RPC)',
          video: rpcData
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (rpcError) {
        // Si la fonction RPC échoue également, retourner l'erreur originale
        return new Response(JSON.stringify({ 
          error: 'Échec de l\'enregistrement: ' + error.message,
          details: error.details
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Vidéo uploadée avec succès',
      video: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Erreur serveur: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
