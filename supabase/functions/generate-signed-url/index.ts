// supabase/functions/generate-signed-url/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.43.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  console.log('Fonction generate-signed-url appelée:', req.method, req.url);

  if (req.method === 'OPTIONS') {
    console.info('Préflight OPTIONS reçu');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.warn('Méthode non autorisée:', req.method);
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { storage_path, expires_in } = await req.json();
    console.log('Payload reçu:', { storage_path, expires_in });

    if (!storage_path) {
      throw new Error('Paramètre storage_path requis');
    }

    const expiresIn = expires_in && Number.isInteger(expires_in) ? expires_in : 365 * 24 * 60 * 60; // Par défaut: 1 an

    const { data, error } = await supabase
      .storage
      .from('videos')
      .createSignedUrl(storage_path, expiresIn);

    if (error) {
      console.error('Erreur création URL signée:', error);
      throw error;
    }

    console.log('URL signée générée:', data.signedUrl);
    return new Response(JSON.stringify({ signed_url: data.signedUrl }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Erreur génération URL signée:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
