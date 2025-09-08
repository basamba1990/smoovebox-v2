// Edge Function pour gérer l'upload de vidéos
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { v4 as uuidv4 } from 'npm:uuid@9.0.1';

// Constantes pour les statuts de vidéo
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
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

// Extraire le token JWT de l'en-tête Authorization
function extractToken(req) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
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
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    // Extraire le token d'authentification de l'en-tête
    const token = extractToken(req);

    if (!token) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification requise',
          details: 'Token manquant dans l\'en-tête Authorization'
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Initialiser les variables d'environnement avec les nouveaux noms
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Configuration incomplète',
          details: 'Variables d\'environnement manquantes'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Initialiser le client Supabase avec le token de l'utilisateur
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    // Vérifier l'authentification
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentification échouée', 
          details: userError?.message || 'Utilisateur non trouvé'
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const user = userData.user;

    // Initialiser le client service_role pour les opérations privilégiées
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parser le formulaire multipart
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Le contenu doit être de type multipart/form-data' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Générer un nom de fichier unique
    const fileExt = videoFile.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Vérifier si le bucket "videos" existe, sinon le créer
    try {
      const { data: buckets } = await serviceClient.storage.listBuckets();
      const videoBucket = buckets.find(bucket => bucket.name === 'videos');
      
      if (!videoBucket) {
        // Créer le bucket s'il n'existe pas
        const { error: createBucketError } = await serviceClient.storage.createBucket('videos', {
          public: false,
          fileSizeLimit: 104857600, // 100MB en octets
        });

        if (createBucketError) {
          console.error('Erreur lors de la création du bucket:', createBucketError);
          throw createBucketError;
        }
      }
    } catch (bucketError) {
      console.error('Erreur lors de la vérification/création du bucket:', bucketError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur de stockage', 
          details: 'Impossible de créer ou accéder au bucket de stockage'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Convertir le fichier en ArrayBuffer pour l'upload
    const fileArrayBuffer = await videoFile.arrayBuffer();

    // Uploader le fichier dans le bucket "videos"
    const { data: uploadData, error: uploadError } = await serviceClient.storage
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
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Construire le chemin de stockage
    const storagePath = `videos/${filePath}`;

    // Vérifier si la table "videos" existe, sinon la créer
    try {
      // Exécuter une requête SQL directement
      const { data, error } = await serviceClient.from('videos').select('id').limit(1);
      
      if (error && error.code === '42P01') { // Relation n'existe pas
        // Créer la table
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS public.videos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT NOT NULL,
            description TEXT,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL,
            url TEXT,
            status TEXT NOT NULL DEFAULT 'uploaded',
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Activer Row Level Security
          ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

          -- Créer une politique pour permettre aux utilisateurs de voir leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent voir leurs propres vidéos"
            ON public.videos FOR SELECT
            USING (auth.uid() = user_id);

          -- Créer une politique pour permettre aux utilisateurs d'insérer leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent insérer leurs propres vidéos"
            ON public.videos FOR INSERT
            WITH CHECK (auth.uid() = user_id);

          -- Créer une politique pour permettre aux utilisateurs de mettre à jour leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent mettre à jour leurs propres vidéos"
            ON public.videos FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);

          -- Créer une politique pour permettre aux utilisateurs de supprimer leurs propres vidéos
          CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres vidéos"
            ON public.videos FOR DELETE
            USING (auth.uid() = user_id);
                    
          -- Créer un index sur user_id pour améliorer les performances
          CREATE INDEX IF NOT EXISTS videos_user_id_idx ON public.videos(user_id);
        `;
        
        const { error: execError } = await serviceClient.rpc('exec_sql', { sql: createTableSQL });
        if (execError) {
          console.error('Erreur lors de la création de la table:', execError);
          // Continuer même si la création de table échoue
        }
      }
    } catch (tableError) {
      console.error('Erreur lors de la vérification de la table:', tableError);
    }

    // Insérer l'enregistrement dans la base de données
    const { data: video, error: insertError } = await serviceClient
      .from('videos')
      .insert({
        title,
        description,
        user_id: user.id,
        storage_path: storagePath,
        status: VIDEO_STATUS.UPLOADED
      })
      .select()
      .single();

    if (insertError) {
      // Si l'insertion échoue, supprimer le fichier uploadé
      await serviceClient.storage.from('videos').remove([filePath]);
      
      console.error('Erreur d\'insertion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement de la vidéo', details: insertError.message }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Générer une URL signée pour la vidéo
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from('videos')
      .createSignedUrl(filePath, 3600); // URL valide pendant 1 heure

    if (signedUrlError) {
      console.error('Erreur lors de la génération de l\'URL signée:', signedUrlError);
      await serviceClient.from('videos').update({
        status: VIDEO_STATUS.FAILED,
        error_message: 'Erreur lors de la génération de l\'URL de la vidéo'
      }).eq('id', video.id);
      
      return new Response(
        JSON.stringify({ 
          error: 'Erreur de traitement', 
          details: 'Impossible de générer l\'URL de la vidéo'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const videoUrl = signedUrlData.signedUrl;

    // Mettre à jour la vidéo avec l'URL signée
    const { error: updateError } = await serviceClient
      .from('videos')
      .update({
        url: videoUrl,
        status: VIDEO_STATUS.PROCESSING,
        updated_at: new Date().toISOString()
      })
      .eq('id', video.id);

    if (updateError) {
      console.error('Erreur lors de la mise à jour de la vidéo:', updateError);
      await serviceClient.from('videos').update({
        status: VIDEO_STATUS.FAILED,
        error_message: 'Erreur lors de la mise à jour de la vidéo'
      }).eq('id', video.id);
      
      return new Response(
        JSON.stringify({ 
          error: 'Erreur de traitement', 
          details: 'Impossible de mettre à jour la vidéo'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Déclencher la transcription de la vidéo de manière asynchrone
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          // Appeler la fonction de transcription avec les bons en-têtes d'authentification
          const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey  // Ajout de l'en-tête apikey essentiel
            },
            body: JSON.stringify({ 
              videoId: video.id,
              // Nous pourrions passer l'URL signée pour éviter de la regénérer, mais transcribe-video la regénère de toute façon
              videoUrl: videoUrl
            })
          });

          if (!transcribeResponse.ok) {
            const errorText = await transcribeResponse.text();
            console.error('Erreur lors du déclenchement de la transcription:', errorText);
            
            // Mettre à jour le statut en cas d'erreur
            await serviceClient
              .from('videos')
              .update({
                status: VIDEO_STATUS.FAILED,
                error_message: `Échec du déclenchement de la transcription: ${errorText}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', video.id);
          } else {
            console.log('Transcription déclenchée avec succès pour la vidéo:', video.id);
          }
        } catch (err) {
          console.error('Erreur lors du traitement asynchrone:', err);
          
          // En cas d'erreur, mettre à jour le statut
          await serviceClient
            .from('videos')
            .update({
              status: VIDEO_STATUS.FAILED,
              error_message: 'Erreur lors du traitement de la vidéo',
              updated_at: new Date().toISOString()
            })
            .eq('id', video.id);
        }
      })()
    );

    // Retourner la réponse avec les données de la vidéo
    return new Response(
      JSON.stringify({
        message: 'Vidéo uploadée avec succès et en cours de traitement',
        video: {
          id: video.id,
          title: video.title,
          status: VIDEO_STATUS.PROCESSING,
          url: videoUrl
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (err) {
    console.error('Erreur non gérée:', err);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
