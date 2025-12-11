// supabase/functions/generate-immersive-video/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

// ✅ DONNÉES PERSONAS INTÉGRÉES (pour la logique Edge)
const PERSONAS_DATA = [
  {
    id: 'jeune_talent',
    name: 'Le·la Jeune Talent',
    role: 'Tu es un scénariste IA spécialisé dans les vidéos de transformation personnelle et professionnelle pour les jeunes talents. Ton ton est inspirant et encourageant.',
  },
  {
    id: 'adulte_reconversion',
    name: 'L’Adulte en reconversion',
    role: 'Tu es un scénariste IA spécialisé dans les vidéos de réinvention professionnelle. Ton ton est rassurant et met en avant la clarté des objectifs.',
  },
  {
    id: 'mentor_senior',
    name: 'Le Mentor Senior',
    role: 'Tu es un scénariste IA spécialisé dans les vidéos de transmission et d\'héritage. Ton ton est sage et met en avant l\'impact positif.',
  },
  {
    id: 'chef_entreprise',
    name: 'Le Chef d’entreprise / Entrepreneur',
    role: 'Tu es un scénariste IA spécialisé dans les vidéos de marque employeur et de leadership. Ton ton est professionnel et percutant.',
  },
  {
    id: 'collectivite',
    name: 'La Collectivité / Institution',
    role: 'Tu es un scénariste IA spécialisé dans les vidéos de valorisation territoriale et d\'impact social. Ton ton est institutionnel et positif.',
  },
  {
    id: 'sponsor',
    name: 'Le Sponsor / Banque / Entreprise tech',
    role: 'Tu es un scénariste IA spécialisé dans les vidéos visionnaires et de storytelling de marque. Ton ton est futuriste et ambitieux.',
  },
  {
    id: 'partenaire_educatif',
    name: 'Le Partenaire Éducatif',
    role: 'Tu es un scénariste IA spécialisé dans les vidéos pédagogiques et d\'orientation. Ton ton est didactique et constructif.',
  },
];

const DEFAULT_PERSONA = PERSONAS_DATA.find(p => p.id === 'jeune_talent') || PERSONAS_DATA[0];

const getPersonaData = (personaId: string) => {
  return PERSONAS_DATA.find(p => p.id === personaId) || DEFAULT_PERSONA;
};

const getModelConfig = (modelType: string) => {
  switch (modelType) {
    case 'test':
      return {
        model: 'gpt-3.5-turbo', // Modèle Test (T)
        description: 'Modèle Test (T) - Pour l\'expérimentation (plus rapide, moins cher).',
      };
    case 'master':
    default:
      return {
        model: modelConfig.model, // Modèle Maître (M)
        description: 'Modèle Maître (M) - Recommandé pour la production (plus précis, plus cher).',
      };
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { hybridizationId, userId, hybridizationData, personaId, modelType } = await req.json();

    if (!hybridizationId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Données manquantes' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer le script pour la vidéo
    const videoScript = await generateVideoScript(hybridizationData, personaId || DEFAULT_PERSONA.id, modelType || 'master');

    // Générer la vidéo avec RunwayML (exemple)
    const videoUrl = await generateVideoWithAI(videoScript);

    // Générer l'audio avec ElevenLabs (voix de SPOT)
    const audioUrl = await generateAudioWithAI(videoScript);

    // Combiner vidéo et audio
    const finalVideoUrl = await combineVideoAudio(videoUrl, audioUrl);

    // Sauvegarder la vidéo générée
    const { data: videoData, error: saveError } = await supabaseClient
      .from('immersive_videos')
      .insert({
        user_id: userId,
        hybridization_id: hybridizationId,
        script: videoScript,
        video_url: finalVideoUrl,
        generated_at: new Date().toISOString(),
        status: 'completed'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Erreur sauvegarde vidéo:', saveError);
    }

    return new Response(
      JSON.stringify({
        video_url: finalVideoUrl,
        script: videoScript,
        video_id: videoData?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur génération vidéo:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Générer le script pour la vidéo immersive
async function generateVideoScript(hybridization: any, personaId: string, modelType: string) {
  // ✅ LOGIQUE ESTELLE (PERSONA & MODÈLE M/T)
  const persona = getPersonaData(personaId);
  const modelConfig = getModelConfig(modelType);
  
  console.log(`🤖 Génération de script avec Persona: ${persona.name} et Modèle: ${modelConfig.model}`);
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY non configurée');
  }

  const prompt = `Génère un script de 20-30 secondes pour une vidéo immersive 
  qui montre le métier hybride: "${hybridization.hybrid_name}".
  
  Le script doit être aligné sur le rôle du Persona: ${persona.name}.

  Description: ${hybridization.description}
  
  Le script doit:
  1. Être inspirant et visuel
  2. Montrer l'hybridation en action
  3. Être narré par SPOT, l'IA coach
  4. Inclure des scènes visuelles spécifiques
  5. Se terminer par une question engageante
  
  Format: Narration + [description visuelle]
  
  Exemple:
  SPOT: "Imagine un monde où [description]"
  [Visuel: scène dynamique montrant l'hybridation]
  SPOT: "Tu pourrais être..."
  [Visuel: transition vers le futur]`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        {
          role: 'system',
          content: persona.role // Utilisation du rôle du Persona comme System Message
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API OpenAI: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Fonctions simulées pour la génération de média
async function generateVideoWithAI(script: string): Promise<string> {
  console.log(`Simuler la génération vidéo pour le script: ${script.substring(0, 50)}...`);
  // Logique d'appel à RunwayML ou Luma ici
  return 'https://storage.supabase.com/videos/immersive-video-12345.mp4';
}

async function generateAudioWithAI(script: string): Promise<string> {
  console.log(`Simuler la génération audio pour le script: ${script.substring(0, 50)}...`);
  // Logique d'appel à ElevenLabs ici
  return 'https://storage.supabase.com/audio/spot-voice-12345.mp3';
}

async function combineVideoAudio(videoUrl: string, audioUrl: string): Promise<string> {
  console.log(`Simuler la combinaison de ${videoUrl} et ${audioUrl}`);
  // Logique de combinaison (ex: FFmpeg via un autre service)
  return 'https://storage.supabase.com/videos/final-immersive-video-12345.mp4';
}
