// supabase/functions/send-email/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { Resend } from 'npm:resend@3.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);

Deno.serve(async (req) => {
  console.log('Fonction send-email appelée:', req.method, req.url);

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
    const { user_id, video_id, video_url } = await req.json();
    console.log('Payload reçu:', { user_id, video_id, video_url });

    if (!user_id || !video_id || !video_url) {
      throw new Error('Paramètres manquants: user_id, video_id, video_url requis');
    }

    // Récupérer l'email depuis profiles
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user_id)
      .single();

    if (profErr) {
      console.error('Erreur récupération profil:', profErr);
      throw profErr;
    }
    if (!profile?.email) {
      console.error('Email introuvable pour user_id:', user_id);
      throw new Error('Email introuvable pour cet utilisateur');
    }

    console.log('Envoi email à:', profile.email);
    const { error: emailError } = await resend.emails.send({
      from: 'SpotBulle <no-reply@yourdomain.com>',
      to: profile.email,
      subject: 'Votre vidéo SpotBulle',
      html: `<p>Regardez votre vidéo : <a href="${video_url}">${video_url}</a></p>`,
    });

    if (emailError) {
      console.error('Erreur envoi email:', emailError);
      throw emailError;
    }

    console.log('Email envoyé avec succès à:', profile.email);
    return new Response(JSON.stringify({ success: true, video_id }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
