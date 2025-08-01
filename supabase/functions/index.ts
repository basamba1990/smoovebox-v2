import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { v4 as uuidv4 } from 'npm:uuid@9.0.1';
// Configuration des limites
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FORMATS = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo'
];
Deno.serve(async (req)=>{
  // Vérification de l'authentification
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({
      error: 'Non autorisé'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  // Initialisation du client Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  // Vérification de l'utilisateur
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({
      error: 'Utilisateur non authentifié'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  try {
    // Traitement de la requête multipart/form-data
    const formData = await req.formData();
    const videoFile = formData.get('video');
    const title = formData.get('title')?.toString() || '';
    const description = formData.get('description')?.toString() || '';
    // Validation du fichier
    if (!videoFile || !(videoFile instanceof File)) {
      return new Response(JSON.stringify({
        error: 'Fichier vidéo requis'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Validation du format
    if (!ALLOWED_FORMATS.includes(videoFile.type)) {
      return new Response(JSON.stringify({
        error: 'Format de fichier non supporté'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Validation de la taille
    if (videoFile.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({
        error: 'Fichier trop volumineux (max 100MB)'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Génération d'un nom de fichier unique
    const fileExt = videoFile.name.split('.').pop();
    const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
    // Upload du fichier vers Storage
    const { data: uploadData, error: uploadError } = await supabase.storage.from('videos').upload(fileName, videoFile, {
      cacheControl: '3600',
      upsert: false
    });
    if (uploadError) {
      console.error('Erreur d\'upload:', uploadError);
      return new Response(JSON.stringify({
        error: 'Échec de l\'upload: ' + uploadError.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Récupération de l'URL publique
    const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);
    // Récupération du profil utilisateur
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
    if (profileError || !profileData) {
      return new Response(JSON.stringify({
        error: 'Profil utilisateur non trouvé'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Création de l'entrée dans la table videos
    const { data: videoData, error: videoError } = await supabase.from('videos').insert([
      {
        profile_id: profileData.id,
        title: title,
        description: description,
        file_path: fileName,
        status: 'processing'
      }
    ]).select().single();
    if (videoError) {
      console.error('Erreur d\'insertion en base:', videoError);
      return new Response(JSON.stringify({
        error: 'Échec de l\'enregistrement en base de données'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Lancement du traitement en arrière-plan (à implémenter)
    EdgeRuntime.waitUntil(processVideoAsync(supabaseUrl, supabaseKey, videoData.id, fileName));
    return new Response(JSON.stringify({
      success: true,
      message: 'Vidéo uploadée avec succès',
      video: {
        id: videoData.id,
        title: videoData.title,
        url: publicUrl,
        status: videoData.status
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Erreur inattendue:', error);
    return new Response(JSON.stringify({
      error: 'Erreur serveur: ' + error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
// Fonction de traitement asynchrone (à implémenter avec un service externe)
async function processVideoAsync(supabaseUrl, supabaseKey, videoId, filePath) {
  try {
    // Ici, vous pourriez appeler un service externe comme FFmpeg ou une API de traitement vidéo
    // Pour l'instant, on simule un traitement
    await new Promise((resolve)=>setTimeout(resolve, 5000));
    // Mise à jour du statut après traitement
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });
    await supabase.from('videos').update({
      status: 'published'
    }).eq('id', videoId);
    console.log(`Vidéo ${videoId} traitée avec succès`);
  } catch (error) {
    console.error(`Erreur lors du traitement de la vidéo ${videoId}:`, error);
    // Mise à jour du statut en cas d'échec
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });
    await supabase.from('videos').update({
      status: 'failed'
    }).eq('id', videoId);
  }
}
