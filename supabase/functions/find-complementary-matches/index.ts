// supabase/functions/find-complementary-matches/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.28.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  console.log('🔍 Fonction find-complementary-matches appelée');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Méthode non autorisée' }),
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const { user_id, limit = 10 } = await req.json();
    
    console.log('📥 Recherche matches complémentaires pour:', user_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id est requis' }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      throw new Error('Variables d\'environnement manquantes');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // 1. Récupérer le profil complet de l'utilisateur
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        questionnaire_responses!inner(
          dominant_color,
          preferred_activities,
          work_preferences,
          current_talent,
          improvement_areas,
          dream_description,
          five_year_vision,
          inspiration_person,
          spotbulle_needs
        ),
        videos(
          id,
          title,
          analysis,
          tone_analysis,
          tags,
          transcription_text
        )
      `)
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('❌ Erreur profil utilisateur:', profileError);
      throw profileError;
    }

    // 2. Récupérer les autres profils avec leurs données
    const { data: otherProfiles, error: othersError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        avatar_url,
        bio,
        passions,
        age_group,
        created_at,
        questionnaire_responses!inner(
          dominant_color,
          preferred_activities,
          work_preferences,
          current_talent,
          improvement_areas,
          dream_description,
          five_year_vision,
          inspiration_person,
          spotbulle_needs
        ),
        videos(
          id,
          title,
          analysis,
          tone_analysis,
          tags,
          transcription_text
        )
      `)
      .neq('id', user_id)
      .limit(50); // Récupérer plus de profils pour l'analyse IA

    if (othersError) {
      console.error('❌ Erreur autres profils:', othersError);
      throw othersError;
    }

    console.log(`📊 Analyse de ${otherProfiles.length} profils potentiels`);

    // 3. Préparer les données pour l'analyse IA
    const userData = prepareUserDataForAI(userProfile);
    const potentialMatches = [];

    // 4. Analyser chaque profil avec l'IA pour trouver les complémentarités
    for (const profile of otherProfiles.slice(0, 20)) { // Limiter pour éviter trop d'appels API
      try {
        const matchAnalysis = await analyzeComplementarity(openai, userData, profile);
        
        if (matchAnalysis.score >= 7.0) { // Seuil minimum pour un bon match
          potentialMatches.push({
            profile: {
              id: profile.id,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              bio: profile.bio,
              passions: profile.passions,
              age_group: profile.age_group,
              dominant_color: profile.questionnaire_responses?.[0]?.dominant_color
            },
            match_analysis: matchAnalysis,
            compatibility_score: matchAnalysis.score,
            reasons: matchAnalysis.complementary_reasons,
            suggested_connection: matchAnalysis.suggested_connection_type
          });
        }
      } catch (error) {
        console.error(`❌ Erreur analyse profil ${profile.id}:`, error);
        continue;
      }
    }

    // 5. Trier par score de compatibilité
    potentialMatches.sort((a, b) => b.compatibility_score - a.compatibility_score);

    // 6. Sauvegarder les résultats dans la base de données
    await saveMatchResults(supabase, user_id, potentialMatches);

    console.log(`🎯 ${potentialMatches.length} matches complémentaires trouvés`);

    return new Response(
      JSON.stringify({
        success: true,
        matches: potentialMatches.slice(0, limit),
        total_analyzed: otherProfiles.length,
        user_profile_summary: {
          dominant_color: userProfile.questionnaire_responses?.[0]?.dominant_color,
          passions: userProfile.passions,
          talents: userProfile.questionnaire_responses?.[0]?.current_talent
        }
      }),
      { status: 200, headers: corsHeaders },
    );

  } catch (error) {
    console.error('💥 Erreur générale:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur lors de la recherche de matches',
        details: error.message 
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});

// Préparer les données utilisateur pour l'IA
function prepareUserDataForAI(userProfile) {
  const questionnaire = userProfile.questionnaire_responses?.[0];
  
  return {
    // Données de base
    personal_info: {
      name: userProfile.full_name,
      age_group: userProfile.age_group,
      passions: userProfile.passions || [],
      bio: userProfile.bio
    },
    
    // Profil psychologique (4 couleurs)
    psychological_profile: {
      dominant_color: questionnaire?.dominant_color,
      personality_traits: getPersonalityTraits(questionnaire?.dominant_color)
    },
    
    // Compétences et talents
    skills_talents: {
      current_talent: questionnaire?.current_talent,
      improvement_areas: questionnaire?.improvement_areas,
      preferred_activities: questionnaire?.preferred_activities || [],
      work_preferences: questionnaire?.work_preferences || []
    },
    
    // Aspirations
    aspirations: {
      dream_description: questionnaire?.dream_description,
      five_year_vision: questionnaire?.five_year_vision,
      inspiration_person: questionnaire?.inspiration_person,
      spotbulle_needs: questionnaire?.spotbulle_needs || []
    },
    
    // Contenu vidéo analysé
    video_insights: {
      total_videos: userProfile.videos?.length || 0,
      common_topics: extractCommonTopics(userProfile.videos),
      communication_style: analyzeCommunicationStyle(userProfile.videos),
      expertise_areas: extractExpertiseAreas(userProfile.videos)
    }
  };
}

// Analyser la complémentarité entre deux profils
async function analyzeComplementarity(openai, userData, otherProfile) {
  const otherProfileData = prepareUserDataForAI(otherProfile);
  
  const prompt = `
Tu es un expert en psychologie sociale et en développement personnel. Analyse la COMPLÉMENTARITÉ entre ces deux profils pour créer des connexions significatives.

PROFIL PRINCIPAL (Utilisateur):
${JSON.stringify(userData, null, 2)}

PROFIL POTENTIEL (Match):
${JSON.stringify(otherProfileData, null, 2)}

ANALYSE REQUISE:
1. COMPLÉMENTARITÉ DES PERSONNALITÉS (4 couleurs)
2. COMPLÉMENTARITÉ DES COMPÉTENCES (ce que l'un peut apprendre de l'autre)
3. ASPIRATIONS COMMUNES OU COMPLÉMENTAIRES
4. SYNERGIE POTENTIELLE (comment ils pourraient s'enrichir mutuellement)

Réponds UNIQUEMENT en JSON avec ce format:
{
  "score": 8.5,
  "complementary_reasons": [
    "Raison 1 de complémentarité",
    "Raison 2 de synergie",
    "Raison 3 d'enrichissement mutuel"
  ],
  "suggested_connection_type": "mentorat/collaboration/amitié/partenariat",
  "mutual_benefits": {
    "user_benefits": ["Bénéfice 1", "Bénéfice 2"],
    "other_benefits": ["Bénéfice 1", "Bénéfice 2"]
  },
  "recommendation_strength": "forte/moyenne/faible",
  "potential_collaboration": "Description d'une collaboration possible"
}

Score sur 10, où 10 = complémentarité parfaite.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "Tu es un expert en matching de profils complémentaires. Réponds UNIQUEMENT en JSON valide."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const analysis = JSON.parse(completion.choices[0].message.content);
  return analysis;
}

// Sauvegarder les résultats des matches
async function saveMatchResults(supabase, userId, matches) {
  for (const match of matches.slice(0, 10)) { // Sauvegarder les 10 meilleurs
    const { error } = await supabase
      .from('complementary_matches')
      .upsert({
        user_id: userId,
        matched_user_id: match.profile.id,
        compatibility_score: match.compatibility_score,
        analysis_data: match.match_analysis,
        reasons: match.reasons,
        suggested_connection_type: match.suggested_connection,
        last_calculated: new Date().toISOString()
      }, {
        onConflict: 'user_id,matched_user_id'
      });

    if (error) {
      console.error('❌ Erreur sauvegarde match:', error);
    }
  }
}

// Helper functions
function getPersonalityTraits(dominantColor) {
  const traits = {
    red: ['leader', 'décideur', 'action', 'résultats'],
    blue: ['analytique', 'organisé', 'précis', 'méthodique'],
    green: ['empathique', 'coopératif', 'soutien', 'communicatif'],
    yellow: ['créatif', 'enthousiaste', 'innovant', 'énergique']
  };
  return traits[dominantColor] || [];
}

function extractCommonTopics(videos) {
  if (!videos || videos.length === 0) return [];
  
  const topics = new Set();
  videos.forEach(video => {
    if (video.analysis?.key_topics) {
      video.analysis.key_topics.forEach(topic => topics.add(topic));
    }
    if (video.tags) {
      video.tags.forEach(tag => topics.add(tag));
    }
  });
  return Array.from(topics).slice(0, 5);
}

function analyzeCommunicationStyle(videos) {
  if (!videos || videos.length === 0) return 'neutre';
  
  const styles = videos.map(v => v.tone_analysis?.emotion || v.analysis?.tone_analysis?.emotion).filter(Boolean);
  
  if (styles.length === 0) return 'neutre';
  
  const styleCount = styles.reduce((acc, style) => {
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, {});
  
  return Object.keys(styleCount).reduce((a, b) => styleCount[a] > styleCount[b] ? a : b);
}

function extractExpertiseAreas(videos) {
  if (!videos || videos.length === 0) return [];
  
  const expertise = new Set();
  videos.forEach(video => {
    if (video.analysis?.key_topics) {
      video.analysis.key_topics.forEach(topic => {
        if (topic.length > 3) { // Filtrer les topics trop courts
          expertise.add(topic);
        }
      });
    }
  });
  return Array.from(expertise).slice(0, 3);
}
