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

  try {
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

    // Insertion directe dans la base de données
    const { data, error } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title: title,
        description: description,
        storage_path: fileName, // Assurez-vous que cette valeur est définie
        url: publicUrl, // Assurez-vous que cette valeur est définie
        status: 'processing',
        file_path: fileName, // Pour compatibilité avec le code existant
        original_file_name: videoFile.name,
        file_size: videoFile.size,
        format: fileExt,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur d\'insertion:', error);
      
      // Essayons une insertion minimale avec seulement les champs obligatoires
      const { data: minimalData, error: minimalError } = await supabase
        .from('videos')
        .insert({
          title: title,
          url: publicUrl,
          storage_path: fileName
        })
        .select()
        .single();
        
      if (minimalError) {
        return new Response(JSON.stringify({ 
          error: 'Échec de l\'enregistrement: ' + minimalError.message,
          details: {
            title: title,
            url: publicUrl,
            storage_path: fileName
          }
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Vidéo uploadée avec succès (insertion minimale)',
        video: {
          id: minimalData.id,
          title: minimalData.title,
          url: minimalData.url,
          status: minimalData.status || 'processing'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Vidéo uploadée avec succès',
      video: {
        id: data.id,
        title: data.title,
        url: data.url,
        status: data.status
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Erreur inattendue:', error);
    return new Response(JSON.stringify({ error: 'Erreur serveur: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
