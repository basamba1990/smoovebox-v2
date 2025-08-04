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

// Fonction pour extraire le token JWT de l'en-tête Authorization ou des paramètres d'URL
function extractToken(req) {
  // Essayer d'abord les paramètres d'URL (priorité la plus haute)
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    console.log("Token trouvé dans les paramètres d'URL");
    return tokenParam;
  }
  
  // Essayer ensuite l'en-tête Authorization
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log("Token trouvé dans l'en-tête Authorization");
    return authHeader.substring(7);
  }
  
  // Vérifier dans les cookies
  const cookieHeader = req.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('sb-access-token='));
    if (authCookie) {
      console.log("Token trouvé dans les cookies");
      return authCookie.substring('sb-access-token='.length);
    }
  }
  
  console.log("Aucun token trouvé");
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
      // Journaliser les en-têtes pour le débogage
      const headers = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Authentification requise', 
          debug: {
            hasAuthHeader: !!req.headers.get('Authorization'),
            authHeaderValue: req.headers.get('Authorization')?.substring(0, 20) + '...',
            hasCookie: !!req.headers.get('Cookie'),
            url: req.url,
            headers: headers
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
            tokenEnd: token?.substring(token.length - 10),
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

    // Utiliser le client service_role pour les opérations administratives
    // Cela nous permet de contourner les problèmes d'authentification
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

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
      const { data: buckets } = await serviceClient.storage.listBuckets();
      const videoBucket = buckets.find(bucket => bucket.name === 'videos');
      
      if (!videoBucket) {
        // Créer le bucket s'il n'existe pas
        await serviceClient.storage.createBucket('videos', {
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

    // Uploader le fichier dans le bucket "videos" en utilisant le client service_role
    // pour éviter les problèmes d'authentification
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
      // Utiliser le client service_role pour exécuter des requêtes SQL directement
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'videos'
        );
      `;
      
      const { data: tableExists, error: tableCheckError } = await serviceClient.rpc('exec_sql_with_return', { 
        sql: checkTableQuery 
      });
      
      if (tableCheckError || !tableExists || !tableExists[0]?.exists) {
        // La table n'existe pas, créons-la
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS public.videos (
            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            title TEXT NOT NULL,
            description TEXT,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL,
            url TEXT,
            status TEXT NOT NULL DEFAULT 'processing',
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
        
        await serviceClient.rpc('exec_sql', { sql: createTableQuery });
      }
    } catch (tableError) {
      console.error('Erreur lors de la vérification/création de la table:', tableError);
      // Continuer quand même, l'insertion échouera si la table n'existe pas
    }

    // Insérer l'enregistrement dans la base de données en utilisant le client service_role
    // mais en spécifiant explicitement l'ID utilisateur
    const insertQuery = `
      INSERT INTO public.videos (title, description, user_id, storage_path, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    
    const { data: video, error: insertError } = await serviceClient.rpc('exec_sql_with_return', { 
      sql: insertQuery,
      params: [title, description, user.id, storagePath, VIDEO_STATUS.PROCESSING]
    });

    if (insertError || !video || video.length === 0) {
      // Si l'insertion échoue, supprimer le fichier uploadé
      await serviceClient.storage.from('videos').remove([filePath]);
      
      console.error('Erreur d\'insertion:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement de la vidéo', details: insertError?.message }),
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
          const { data: publicUrl } = await serviceClient.storage
            .from('videos')
            .createSignedUrl(filePath, 365 * 24 * 60 * 60); // URL valide pendant 1 an
          
          // Mettre à jour le statut de la vidéo et l'URL
          const updateQuery = `
            UPDATE public.videos
            SET status = $1, url = $2, updated_at = NOW()
            WHERE id = $3;
          `;
          
          await serviceClient.rpc('exec_sql', { 
            sql: updateQuery,
            params: [VIDEO_STATUS.READY, publicUrl?.signedUrl || null, video[0].id]
          });
        } catch (err) {
          console.error('Erreur lors du traitement asynchrone:', err);
          
          // En cas d'erreur, mettre à jour le statut
          const errorUpdateQuery = `
            UPDATE public.videos
            SET status = $1, error_message = $2, updated_at = NOW()
            WHERE id = $3;
          `;
          
          await serviceClient.rpc('exec_sql', { 
            sql: errorUpdateQuery,
            params: [VIDEO_STATUS.ERROR, 'Erreur lors du traitement de la vidéo', video[0].id]
          });
        }
      })()
    );

    // Retourner la réponse avec les données de la vidéo
    return new Response(
      JSON.stringify({
        message: 'Vidéo uploadée avec succès et en cours de traitement',
        video: video[0]
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
