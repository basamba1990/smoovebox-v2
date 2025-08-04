// Edge Function pour gérer l'upload de vidéos avec gestion flexible des chemins de stockage
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { v4 as uuidv4 } from 'npm:uuid@9.0.1';

// Constantes pour les statuts de vidéo
const VIDEO_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  ERROR: 'error'
};

// En-têtes CORS pour permettre les requêtes cross-origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Gérer les requêtes OPTIONS pour CORS
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: new Headers(corsHeaders)
  });
}

// Fonction pour extraire le token JWT de l'en-tête Authorization
function extractToken(req) {
  // Essayer d'abord l'en-tête Authorization standard
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Si pas d'en-tête Authorization, vérifier dans les cookies
  const cookieHeader = req.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('sb-access-token='));
    if (authCookie) {
      return authCookie.substring('sb-access-token='.length);
    }
  }
  
  // Vérifier dans les paramètres de requête
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (token) {
    return token;
  }
  
  // Vérifier dans le corps de la requête si c'est du JSON
  // Note: Cela ne fonctionnera pas pour les requêtes multipart/form-data
  // car nous ne pouvons pas lire le corps deux fois
  
  return null;
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }
  
  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { 
        status: 405, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }

  try {
    // Récupérer le token d'authentification
    const token = extractToken(req);
    
    if (!token) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification requise', 
          debug: {
            hasAuthHeader: !!req.headers.get('Authorization'),
            authHeaderValue: req.headers.get('Authorization')?.substring(0, 20) + '...',
            hasCookie: !!req.headers.get('Cookie'),
          }
        }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Initialiser le client Supabase avec le token récupéré
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Utilisateur non authentifié', 
          details: authError?.message,
          debug: {
            tokenLength: token?.length,
            tokenStart: token?.substring(0, 10) + '...',
          }
        }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Parser le formulaire multipart manuellement
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Le contenu doit être de type multipart/form-data' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Utiliser FormData API native de Deno
    const formData = await req.formData();
    
    // Extraire les données du formulaire
    const videoFile = formData.get('video');
    const title = formData.get('title')?.toString() || 'Sans titre';
    const description = formData.get('description')?.toString() || '';
    
    if (!videoFile || !(videoFile instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'Aucun fichier vidéo fourni' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Vérifier le type de fichier
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!validTypes.includes(videoFile.type)) {
      return new Response(
        JSON.stringify({ error: 'Format de fichier non supporté. Veuillez utiliser MP4, MOV, AVI ou WebM.' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }
    
    // Vérifier la taille du fichier (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024; // 100MB
    if (videoFile.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Le fichier est trop volumineux. La taille maximale est de 100MB.' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Générer un nom de fichier unique
    const fileExt = videoFile.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Vérifier si le bucket "videos" existe, sinon le créer
    try {
      const { data: buckets } = await supabaseClient.storage.listBuckets();
      const videoBucket = buckets.find(bucket => bucket.name === 'videos');
      
      if (!videoBucket) {
        // Créer le bucket s'il n'existe pas
        await supabaseClient.storage.createBucket('videos', {
          public: false,
          fileSizeLimit: 104857600, // 100MB en octets
        });
      }
    } catch (bucketError) {
      console.error('Erreur lors de la vérification/création du bucket:', bucketError);
      // Continuer même si la vérification échoue, l'upload échouera si le bucket n'existe pas
    }

    // Convertir le fichier en ArrayBuffer pour l'upload
    const fileArrayBuffer = await videoFile.arrayBuffer();

    // Uploader le fichier dans le bucket "videos"
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('videos')
      .upload(filePath, fileArrayBuffer, {
        contentType: videoFile.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Erreur d\'upload:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'upload de la vidéo', details: uploadError.message }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Construire le chemin de stockage
    const storagePath = `videos/${filePath}`;

    // Vérifier si la table "videos" existe, sinon la créer
    try {
      // Vérifier si la table existe
      const { error: tableCheckError } = await supabaseClient.rpc('check_table_exists', { table_name: 'videos' });
      
      if (tableCheckError) {
        // La table n'existe probablement pas, essayons de la créer
        const { error: createTableError } = await supabaseClient.rpc('create_videos_table');
        
        if (createTableError) {
          console.error('Erreur lors de la création de la table videos:', createTableError);
          // Continuer quand même, l'insertion échouera si la table n'existe pas
        }
      }
    } catch (tableError) {
      console.error('Erreur lors de la vérification/création de la table:', tableError);
      // Continuer quand même, l'insertion échouera si la table n'existe pas
    }

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
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          } 
        }
      );
    }

    // Déclencher le traitement asynchrone de la vidéo
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // Simuler un délai de traitement
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Générer une URL publique pour la vidéo
          const { data: publicUrl } = await supabaseClient.storage
            .from('videos')
            .createSignedUrl(filePath, 365 * 24 * 60 * 60); // URL valide pendant 1 an
          
          // Mettre à jour le statut de la vidéo et l'URL
          await supabaseClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.READY,
              url: publicUrl?.signedUrl || null,
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
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );

  } catch (err) {
    console.error('Erreur non gérée:', err);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: err.message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
});
