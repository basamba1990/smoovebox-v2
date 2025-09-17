import { serve } from 'https://deno.land/std@0.223.0/http/server.ts';
import { Resend } from 'https://esm.sh/resend@3.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const { user_id, video_id, video_url } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single();

    if (userError) throw userError;

    const { error: emailError } = await resend.emails.send({
      from: 'SpotBulle <no-reply@spotbulle.com>',
      to: user.email,
      subject: 'Votre vidéo SpotBulle est prête!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Votre vidéo SpotBulle est prête!</h2>
          <p>Merci d'avoir utilisé SpotBulle. Votre vidéo a été traitée avec succès.</p>
          <p>Vous pouvez accéder à votre vidéo en cliquant sur le lien ci-dessous :</p>
          <p><a href="${video_url}" style="color: #2563eb; text-decoration: underline;">${video_url}</a></p>
          <p>À bientôt sur SpotBulle!</p>
        </div>
      `,
    });

    if (emailError) throw emailError;

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erreur envoi e-mail:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
