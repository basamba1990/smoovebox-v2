// Edge Function pour gérer l'upload de vidéos avec gestion flexible des chemins de stockage
import { createClient } from 'jsr:@supabase/supabase-js@^2';
import { multiParser } from 'jsr:@supabase/multiparser@^0.1.5';
import { v4 as uuidv4 } from 'jsr:uuid@^9.0.1';

// Constantes pour les statuts de vidéo
const VIDEO_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
};

Deno.serve(async (req) => {
  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Initialiser le client Supabase avec le token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
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
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parser le formulaire multipart
    const formData = await multiParser(req);
    
    // Extraire les données du formulaire
    const videoFile = formData.files.video;
    const title = formData.fields.title || 'Sans titre';
    const description = formData.fields.description || '';
    
    if (!videoFile) {
      return new Response(
        JSON.stringify({ error: 'Aucun fichier vidéo fourni' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Générer un nom de fichier unique
    const fileExt = videoFile.filename.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Uploader le fichier dans le bucket "videos"
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('videos')
      .upload(filePath, videoFile.content, {
        contentType: videoFile.contentType,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Erreur d\'upload:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'upload de la vidéo', details: uploadError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Construire le chemin de stockage
    const storagePath = `videos/${filePath}`;

    // Insérer l'enregistrement dans la base de données
    const { data: video, error: insertError } = await supabaseClient
      .from('videos')
      .insert({
        title,
        description,
        user_id: user.id,
        storage_path: storagePath,
        status: VIDEO_STATUS.PROCESSING,
        // Laisser url à NULL pour le moment
      })
      .select()
      .single();

    if (insertError) {
      // Si l'insertion échoue, supprimer le fichier uploadé
      await supabaseClient.storage.from('videos').remove([filePath]);
      
      console.error('Erreur d\'insertion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement de la vidéo', details: insertError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Déclencher le traitement asynchrone de la vidéo (simulation)
    // Dans une implémentation réelle, vous pourriez appeler une autre fonction Edge ou un webhook
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // Simuler un délai de traitement
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Mettre à jour le statut de la vidéo
          await supabaseClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.READY,
              // Vous pourriez également mettre à jour d'autres champs comme duration, thumbnail_url, etc.
            })
            .eq('id', video.id);
        } catch (err) {
          console.error('Erreur lors du traitement asynchrone:', err);
          
          // En cas d'erreur, mettre à jour le statut
          await supabaseClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.ERROR,
              error_message: 'Erreur lors du traitement de la vidéo'
            })
            .eq('id', video.id);
        }
      })()
    );

    // Retourner la réponse avec les données de la vidéo
    return new Response(
      JSON.stringify({
        message: 'Vidéo uploadée avec succès et en cours de traitement',
        video
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Erreur non gérée:', err);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
