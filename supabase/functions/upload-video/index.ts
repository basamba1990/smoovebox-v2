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

// Headers CORS pour toutes les réponses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    });
  }

  // Vérification de l'authentification
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({
      error: 'Non autorisé'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
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
        'Content-Type': 'application/json',
        ...corsHeaders
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
          'Content-Type': 'application/json',
          ...corsHeaders
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
          'Content-Type': 'application/json',
          ...corsHeaders
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
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Génération d'un nom de fichier unique
    const fileExt = videoFile.name.split('.').pop();
    const fileName = `${user.id}/${uuidv4()}.${fileExt}`;
    
    // Définir explicitement le chemin de stockage
    const storagePath = fileName;

    // Upload du fichier vers Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, videoFile, {
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
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Récupération de l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    // Création de l'entrée dans la table videos avec les deux champs
    // Utiliser une requête SQL directe pour s'assurer que tous les champs sont correctement définis
    const { data: insertData, error: insertError } = await supabase.rpc(
      'insert_video',
      {
        p_user_id: user.id,
        p_title: title,
        p_description: description,
        p_file_path: fileName,
        p_storage_path: storagePath,
        p_public_url: publicUrl,
        p_status: 'processing'
      }
    );

    if (insertError) {
      console.error('Erreur d\'insertion via RPC:', insertError);
      
      // Tentative d'insertion directe si la fonction RPC échoue
      const { data: directInsertData, error: directInsertError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          title: title,
          description: description,
          file_path: fileName,
          storage_path: storagePath,
          public_url: publicUrl,
          status: 'processing'
        })
        .select()
        .single();

      if (directInsertError) {
        console.error('Erreur d\'insertion directe:', directInsertError);
        
        // Dernière tentative sans public_url
        const { data: finalInsertData, error: finalInsertError } = await supabase
          .from('videos')
          .insert({
            user_id: user.id,
            title: title,
            description: description,
            file_path: fileName,
            storage_path: storagePath,
            status: 'processing'
          })
          .select()
          .single();

        if (finalInsertError) {
          console.error('Erreur d\'insertion finale:', finalInsertError);
          return new Response(JSON.stringify({
            error: 'Échec de l\'enregistrement en base de données: ' + finalInsertError.message,
            details: {
              user_id: user.id,
              storage_path: storagePath,
              file_path: fileName
            }
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        insertData = finalInsertData;
      } else {
        insertData = directInsertData;
      }
    }

    // Vérifier si insertData est défini
    if (!insertData) {
      return new Response(JSON.stringify({
        error: 'Échec de l\'enregistrement: aucune donnée retournée',
        details: {
          user_id: user.id,
          storage_path: storagePath,
          file_path: fileName
        }
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Vidéo uploadée avec succès',
      video: {
        id: insertData.id,
        title: insertData.title,
        url: publicUrl,
        status: insertData.status
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Erreur inattendue:', error);
    return new Response(JSON.stringify({
      error: 'Erreur serveur: ' + error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// Fonction de traitement asynchrone (à implémenter avec un service externe)
async function processVideoAsync(supabaseUrl, supabaseKey, videoId, filePath) {
  try {
    // Ici, vous pourriez appeler un service externe comme FFmpeg ou une API de traitement vidéo
    // Pour l'instant, on simule un traitement
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Mise à jour du statut après traitement
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });

    await supabase
      .from('videos')
      .update({ status: 'published' })
      .eq('id', videoId);

    console.log(`Vidéo ${videoId} traitée avec succès`);
  } catch (error) {
    console.error(`Erreur lors du traitement de la vidéo ${videoId}:`, error);
    
    // Mise à jour du statut en cas d'échec
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });

    await supabase
      .from('videos')
      .update({ status: 'failed' })
      .eq('id', videoId);
  }
}
