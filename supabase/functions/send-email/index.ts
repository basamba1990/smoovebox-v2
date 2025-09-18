// supabase/functions/send-email/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.43.4';
import { Resend } from 'npm:resend@3.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const resendApiKey = Deno.env.get('RESEND_API_KEY');

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
    if (!supabaseUrl || !serviceKey || !resendApiKey) {
      console.error('Variables d\'environnement manquantes:', { supabaseUrl, serviceKey, resendApiKey });
      throw new Error('Configuration incomplète: Variables d\'environnement manquantes');
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const resend = new Resend(resendApiKey);

    const { user_id, video_id, video_url } = await req.json();
    console.log('Payload reçu:', { user_id, video_id, video_url });

    if (!user_id || !video_id || !video_url) {
      console.error('Paramètres manquants:', { user_id, video_id, video_url });
      throw new Error('Paramètres manquants: user_id, video_id, video_url requis');
    }

    // Vérifier que la vidéo existe et appartient à l'utilisateur
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('id, user_id, title')
      .eq('id', video_id)
      .eq('user_id', user_id)
      .single();

    if (videoError || !video) {
      console.error('Erreur récupération vidéo:', videoError?.message);
      throw new Error('Vidéo non trouvée ou non associée à l\'utilisateur');
    }

    // Récupérer l'email depuis profiles
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('email, username')
      .eq('user_id', user_id)
      .single();

    if (profErr || !profile?.email) {
      console.error('Erreur récupération profil:', profErr?.message, { user_id });
      throw new Error('Email introuvable pour cet utilisateur');
    }

    // Envoyer l'email
    console.log('Envoi email à:', profile.email);
    const { data, error: emailError } = await resend.emails.send({
      from: 'SpotBulle <no-reply@spotbulle.com>', // Remplacer par votre domaine configuré dans Resend
      to: profile.email,
      subject: 'Votre vidéo SpotBulle',
      html: `
        <p>Bonjour ${profile.username || 'Utilisateur'},</p>
        <p>Vous avez reçu une nouvelle demande de connexion.</p>
        <p>Regardez la vidéo associée : <a href="${video_url}">${video.title || 'Vidéo SpotBulle'}</a></p>
        <p>Merci d'utiliser SpotBulle !</p>
      `,
    });

    if (emailError) {
      console.error('Erreur envoi email:', emailError);
      throw new Error(`Erreur envoi email: ${emailError.message}`);
    }

    console.log('Email envoyé avec succès à:', profile.email, { email_id: data?.id });
    return new Response(
      JSON.stringify({ success: true, video_id, email_id: data?.id }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', details: error.message }),
      { status: 500, headers: corsHeaders },
    );
  }
});
