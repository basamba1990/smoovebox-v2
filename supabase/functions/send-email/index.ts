import { serve } from 'https://deno.land/std@0.223.0/http/server.ts';
import { Resend } from 'https://esm.sh/resend@3.5.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  try {
    const { user_id, video_id, video_url } = await req.json();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', user_id)
      .single();

    if (userError) throw userError;

    const { error: emailError } = await resend.emails.send({
      from: 'SpotBulle <no-reply@yourdomain.com>',
      to: user.email,
      subject: 'Votre vidéo SpotBulle',
      html: `<p>Regardez votre vidéo : <a href="${video_url}">${video_url}</a></p>`,
    });

    if (emailError) throw emailError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur envoi e-mail:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
