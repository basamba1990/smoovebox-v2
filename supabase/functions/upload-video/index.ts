// supabase/functions/upload-video/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { v4 as uuidv4 } from 'npm:uuid@9.0.1';

const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  FAILED: 'failed'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // ⚠️ en prod : mettre ton domaine
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function extractToken(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // 🔑 Auth
    const token = extractToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentification requise' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Client user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non trouvé' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    const user = userData.user;

    // Client service (bypass RLS pour Storage et DB)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 📦 Lire multipart form
    const formData = await req.formData();
    const videoFile = formData.get('video');
    const title = formData.get('title')?.toString() || 'Sans titre';
    const description = formData.get('description')?.toString() || '';

    if (!(videoFile instanceof File)) {
      return new Response(JSON.stringify({ error: 'Fichier vidéo manquant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ✅ Vérifications
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(videoFile.type)) {
      return new Response(JSON.stringify({ error: 'Format non supporté (mp4, mov, avi, webm)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    if (videoFile.size > 100 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Fichier trop volumineux (>100MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Nom unique
    const ext = videoFile.name.split('.').pop();
    const filePath = `${user.id}/${uuidv4()}.${ext}`;

    // 🔼 Upload avec service role (ignore RLS)
    const { error: uploadError } = await serviceClient.storage
      .from('videos')
      .upload(filePath, await videoFile.arrayBuffer(), {
        contentType: videoFile.type,
        cacheControl: '3600',
        upsert: false
      });
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Échec upload', details: uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Chemin dans Storage
    const storagePath = `videos/${filePath}`;

    // DB → enregistrement vidéo
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
      await serviceClient.storage.from('videos').remove([filePath]);
      return new Response(JSON.stringify({ error: 'Erreur DB', details: insertError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // URL signée (1h)
    const { data: signed, error: signedError } = await serviceClient
      .storage.from('videos')
      .createSignedUrl(filePath, 3600);

    if (signedError) {
      return new Response(JSON.stringify({ error: 'Erreur URL signée' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      message: 'Vidéo uploadée avec succès',
      video: {
        id: video.id,
        title: video.title,
        status: VIDEO_STATUS.UPLOADED,
        url: signed.signedUrl
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Erreur serveur', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
