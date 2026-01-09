// supabase/functions/lumi-hobby-recommend/index.ts
// Edge Function to generate hobby recommendations using GPT based on DISC profile + hobby answers

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session
    const { data: session, error: sessionError } = await supabaseClient
      .from('lumi_hobby_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get main DISC profile
    const { data: discProfile, error: discError } = await supabaseClient
      .from('lumi_profiles')
      .select('*')
      .eq('id', session.disc_profile_id)
      .single();

    if (discError || !discProfile) {
      return new Response(
        JSON.stringify({ error: 'DISC profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all hobby answers with questions
    const { data: answers, error: answersError } = await supabaseClient
      .from('lumi_hobby_answers')
      .select(`
        question_id,
        answer_value,
        answer_json,
        lumi_hobby_questions (
          id,
          question_text,
          order_index
        )
      `)
      .eq('session_id', session_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (answersError || !answers || answers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No answers found for this session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's age from profile_information
    let userAge: number | null = null;
    const { data: videos } = await supabaseClient
      .from('videos')
      .select('profile_information')
      .eq('user_id', user.id)
      .not('profile_information', 'is', null)
      .limit(1)
      .maybeSingle();

    if (videos?.profile_information) {
      const profileInfo = videos.profile_information as any;
      userAge = profileInfo.approx_age || profileInfo.age || profileInfo.age_years || null;
    }

    // Format answers for GPT prompt
    const formattedAnswers = answers.map((answer: any) => {
      const question = answer.lumi_hobby_questions;
      let answerText = '';
      
      if (answer.answer_json?.answers && Array.isArray(answer.answer_json.answers)) {
        answerText = answer.answer_json.answers.join(', ');
      } else if (answer.answer_value) {
        answerText = answer.answer_value;
      }

      return {
        question: question?.question_text || 'Question',
        answer: answerText
      };
    });

    // Build GPT prompt
    const discTraits = discProfile.traits;
    const dominantName = discTraits?.dominant?.name || 'Profil dominant';
    const secondaryName = discTraits?.secondary?.name || 'Profil secondaire';
    const dominantDesc = discTraits?.dominant?.description || '';
    const secondaryDesc = discTraits?.secondary?.description || '';
    const combinedDesc = discTraits?.combined_description || '';

    const systemPrompt = `Tu es un expert en orientation de loisirs et en analyse de profils DISC. 
Tu dois analyser le profil DISC d'un utilisateur, ses réponses à des questions sur un hobby spécifique, 
et déterminer:
1. Le score de compatibilité (0-100%) avec ce hobby
2. Le rôle/position idéal dans ce hobby
3. Une explication détaillée de pourquoi ce rôle lui convient
4. Des conseils de développement pour exceller dans ce rôle

Réponds UNIQUEMENT en JSON avec cette structure exacte:
{
  "fit_score": 85,
  "recommended_role": "Capitaine d'équipe",
  "description": "Explication détaillée...",
  "development_tips": "Conseils pour développer..."
}`;

    const userPrompt = `Profil DISC de l'utilisateur:
- Couleur dominante: ${discProfile.dominant_color} (${dominantName})
- Couleur secondaire: ${discProfile.secondary_color} (${secondaryName})
- Description combinée: ${combinedDesc}
- Traits dominants: ${discTraits?.dominant?.traits?.join(', ') || ''}
- Traits secondaires: ${discTraits?.secondary?.traits?.join(', ') || ''}
- Scores DISC: D=${discProfile.disc_scores?.D || 0}, I=${discProfile.disc_scores?.I || 0}, S=${discProfile.disc_scores?.S || 0}, C=${discProfile.disc_scores?.C || 0}
${userAge ? `- Âge: ${userAge} ans` : ''}
- Tranche d'âge: ${session.age_range || 'Non spécifiée'}

Hobby sélectionné: ${session.hobby_name}

Réponses aux questions sur ce hobby:
${formattedAnswers.map((qa: any, idx: number) => `${idx + 1}. ${qa.question}\n   Réponse: ${qa.answer}`).join('\n\n')}

Analyse ce profil et détermine:
1. Le score de compatibilité (0-100%) avec ${session.hobby_name}
2. Le rôle/position spécifique qui correspond le mieux à ce profil (ex: pour Football: Capitaine, Entraîneur, Défenseur latéral, Attaquant, Gardien, Supporter, etc.)
3. Une explication détaillée (3-4 phrases) expliquant pourquoi ce rôle convient parfaitement
4. Des conseils pratiques (3-4 points) pour développer ses compétences dans ce rôle

Réponds en français et sois précis et personnalisé.`;

    // Call GPT
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from GPT');
    }

    let gptResponse: any;
    try {
      gptResponse = JSON.parse(content);
    } catch (e) {
      throw new Error('Invalid JSON response from GPT');
    }

    // Save to lumi_hobby_profiles
    const hobbyProfile = {
      user_id: user.id,
      session_id: session_id,
      disc_profile_id: discProfile.id,
      hobby_name: session.hobby_name,
      age_range: session.age_range,
      dominant_color: discProfile.dominant_color,
      secondary_color: discProfile.secondary_color,
      fit_score: gptResponse.fit_score || null,
      recommended_role: gptResponse.recommended_role || null,
      description: gptResponse.description || null,
      development_tips: gptResponse.development_tips || null,
      gpt_response: gptResponse,
    };

    const { data: savedProfile, error: saveError } = await supabaseClient
      .from('lumi_hobby_profiles')
      .upsert(hobbyProfile, {
        onConflict: 'user_id,hobby_name',
      })
      .select()
      .single();

    if (saveError) {
      return new Response(
        JSON.stringify({ error: 'Failed to save hobby profile', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session status
    await supabaseClient
      .from('lumi_hobby_sessions')
      .update({ status: 'completed' })
      .eq('id', session_id);

    return new Response(
      JSON.stringify({
        success: true,
        profile: savedProfile,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

