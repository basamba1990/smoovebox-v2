import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'

// Harmonisation des statuts avec les autres fonctions
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed',
  DRAFT: 'draft',
  READY: 'ready'
} as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("Fonction analyze-video-performance appelée")
    
    // Initialiser les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      console.error("Variables d'environnement manquantes")
      return new Response(
        JSON.stringify({ 
          error: "Configuration incomplète", 
          details: "Variables d'environnement manquantes" 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    // Créer un client Supabase avec la clé de service
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    // RÉCUPÉRER ET VALIDER LES DONNÉES DE LA REQUÊTE
    let videoId: string | null = null
    
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url)
        videoId = url.searchParams.get('videoId')
      } else {
        const requestData = await req.json()
        videoId = requestData.videoId
      }
    } catch (error) {
      console.error("Erreur lors de l'analyse de la requête", error)
      return new Response(
        JSON.stringify({ 
          error: "Format de requête invalide", 
          details: error.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'videoId est requis' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Récupérer les données de la vidéo
    const { data: video, error: videoError } = await serviceClient
      .from('videos')
      .select('*, transcriptions(*)')
      .eq('id', videoId)
      .single()
    
    if (videoError) {
      console.error(`Erreur lors de la récupération de la vidéo ${videoId}`, videoError)
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la récupération de la vidéo', 
          details: videoError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    
    if (!video) {
      return new Response(
        JSON.stringify({ error: 'Vidéo non trouvée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }
    
    // Vérifier qu'il y a une transcription disponible
    let transcriptionText = ''
    
    // Chercher la transcription dans différents endroits possibles
    if (video.transcription_text) {
      transcriptionText = video.transcription_text
    } else if (video.transcription_data && typeof video.transcription_data === 'object') {
      if (video.transcription_data.text) {
        transcriptionText = video.transcription_data.text
      } else if (Array.isArray(video.transcription_data.segments)) {
        transcriptionText = video.transcription_data.segments
          .map((segment: any) => segment.text)
          .join(' ')
      }
    } else if (video.transcriptions && video.transcriptions.length > 0) {
      const latestTranscription = video.transcriptions.reduce((latest: any, current: any) => {
        return !latest || new Date(current.created_at) > new Date(latest.created_at) ? current : latest
      }, null)
      
      if (latestTranscription) {
        transcriptionText = latestTranscription.full_text || latestTranscription.transcription_text || ''
      }
    }
    
    if (!transcriptionText) {
      return new Response(
        JSON.stringify({ 
          error: 'Aucune transcription disponible pour cette vidéo', 
          details: 'Veuillez d\'abord transcriber la vidéo avant de l\'analyser' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    // Mettre à jour le statut pour indiquer que l'analyse est en cours
    await serviceClient
      .from('videos')
      .update({
        status: VIDEO_STATUS.ANALYZING,
        updated_at: new Date().toISOString()
      })
      .eq('id', videoId)
    
    // Préparer la réponse immédiate pour ne pas bloquer le client
    const responsePromise = new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Analyse de performance démarrée',
        videoId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
    
    // Effectuer l'analyse en arrière-plan
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`Début de l'analyse avancée pour la vidéo ${videoId}`)
        
        const openai = new OpenAI({ apiKey: openaiApiKey })
        
        // Première analyse: évaluation des performances oratoires
        const performanceResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Tu es un expert en communication orale et en pitch. Analyse cette transcription et évalue les performances oratoires selon ces critères:

              1. Expressivité (note de 1 à 10)
              2. Rythme et débit (note de 1 à 10)
              3. Clarté du message (note de 1 à 10)
              4. Structure et organisation (note de 1 à 10)
              5. Pouvoir de persuasion (note de 1 à 10)
              6. Niveau de confiance perçu (note de 1 à 10)
              
              Pour chaque critère, donne une note et une explication concise.
              
              Ajoute aussi:
              - Un score global (moyenne pondérée des critères)
              - 3-4 points forts spécifiques
              - 3-4 suggestions d'amélioration concrètes
              - 5-7 bullet points résumant les messages clés du pitch
              
              Réponds au format JSON strict avec cette structure:
              {
                "scores": {
                  "expressivite": { "note": number, "commentaire": "string" },
                  "rythme": { "note": number, "commentaire": "string" },
                  "clarte": { "note": number, "commentaire": "string" },
                  "structure": { "note": number, "commentaire": "string" },
                  "persuasion": { "note": number, "commentaire": "string" },
                  "confiance": { "note": number, "commentaire": "string" },
                  "global": number
                },
                "points_forts": ["string", "string", ...],
                "suggestions": ["string", "string", ...],
                "messages_cles": ["string", "string", ...]
              }`
            },
            {
              role: "user",
              content: transcriptionText.substring(0, 8000) // Limiter la taille
            }
          ],
          max_tokens: 1000,
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
        
        const performanceAnalysis = JSON.parse(performanceResponse.choices[0].message.content || '{}')
        console.log("Analyse de performance terminée")
        
        // Deuxième analyse: extraction d'insights pour personnalisation
        const insightsResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Tu es un expert en analyse de discours et en personnalisation de contenu. 
              Analyse cette transcription pour extraire des informations permettant de personnaliser l'expérience utilisateur:

              1. Identifie les sujets principaux abordés (tags)
              2. Détermine le niveau d'expertise de l'orateur (débutant, intermédiaire, expert)
              3. Identifie le style de communication (formel, conversationnel, technique, narratif, etc.)
              4. Extrais des mots-clés pertinents pour la recherche
              5. Détermine la tonalité émotionnelle dominante (positif, négatif, neutre, enthousiaste, etc.)
              6. Identifie des sujets connexes qui pourraient intéresser l'utilisateur
              
              Réponds au format JSON strict avec cette structure:
              {
                "sujets": ["string", "string", ...],
                "niveau_expertise": "string",
                "style_communication": "string",
                "mots_cles": ["string", "string", ...],
                "tonalite": "string",
                "sujets_connexes": ["string", "string", ...]
              }`
            },
            {
              role: "user",
              content: transcriptionText.substring(0, 8000)
            }
          ],
          response_format: { type: "json_object" }
        })
        
        const insightsAnalysis = JSON.parse(insightsResponse.choices[0].message.content || '{}')
        console.log("Analyse des insights terminée")
        
        // Troisième analyse: profil d'audience cible
        const audienceResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Tu es un expert en marketing et en ciblage d'audience. 
              Analyse cette transcription pour déterminer l'audience cible idéale pour ce contenu:

              1. Identifie les profils démographiques qui seraient intéressés (âge, profession, niveau d'éducation, etc.)
              2. Détermine les motivations probables de l'audience (pourquoi ce contenu les intéresserait)
              3. Identifie les besoins ou problèmes que ce contenu cherche à résoudre
              4. Suggère 3-5 types de contenu similaires qui pourraient intéresser la même audience
              
              Réponds au format JSON strict avec cette structure:
              {
                "audience_cible": {
                  "profils": ["string", "string", ...],
                  "motivations": ["string", "string", ...],
                  "besoins": ["string", "string", ...]
                },
                "contenu_similaire": ["string", "string", ...]
              }`
            },
            {
              role: "user",
              content: transcriptionText.substring(0, 8000)
            }
          ],
          response_format: { type: "json_object" }
        })
        
        const audienceAnalysis = JSON.parse(audienceResponse.choices[0].message.content || '{}')
        console.log("Analyse de l'audience terminée")
        
        // Combiner toutes les analyses
        const combinedAnalysis = {
          performance: performanceAnalysis,
          insights: insightsAnalysis,
          audience: audienceAnalysis,
          timestamp: new Date().toISOString()
        }
        
        // Mettre à jour la vidéo avec l'analyse complète
        const { error: updateError } = await serviceClient
          .from('videos')
          .update({
            analysis: combinedAnalysis,
            performance_score: performanceAnalysis.scores?.global,
            tags: insightsAnalysis.sujets,
            keywords: insightsAnalysis.mots_cles,
            status: VIDEO_STATUS.ANALYZED,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
          
        if (updateError) {
          console.error(`Erreur lors de la mise à jour de l'analyse dans la table videos:`, updateError)
          throw updateError
        }
        
        // Créer ou mettre à jour l'entrée dans la table video_analytics si elle existe
        try {
          await serviceClient
            .from('video_analytics')
            .upsert({
              video_id: videoId,
              performance_analysis: performanceAnalysis,
              content_insights: insightsAnalysis,
              audience_analysis: audienceAnalysis,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'video_id'
            })
            
          console.log(`Analyse enregistrée dans la table video_analytics`)
        } catch (analyticsError) {
          console.log("La table video_analytics n'existe pas ou a une structure incompatible", analyticsError)
          // On continue sans erreur fatale car l'analyse est déjà stockée dans la table videos
        }
        
        // Enregistrer les suggestions d'amélioration dans une table dédiée si elle existe
        try {
          // Supprimer d'abord les anciennes suggestions pour cette vidéo
          await serviceClient
            .from('improvement_suggestions')
            .delete()
            .eq('video_id', videoId)
            
          // Insérer les nouvelles suggestions
          const suggestions = performanceAnalysis.suggestions?.map((suggestion: string) => ({
            video_id: videoId,
            suggestion: suggestion,
            category: 'performance',
            created_at: new Date().toISOString()
          })) || []
          
          if (suggestions.length > 0) {
            await serviceClient
              .from('improvement_suggestions')
              .insert(suggestions)
              
            console.log(`${suggestions.length} suggestions d'amélioration enregistrées`)
          }
        } catch (suggestionsError) {
          console.log("La table improvement_suggestions n'existe pas ou a une structure incompatible", suggestionsError)
        }
        
        console.log(`Analyse avancée terminée pour la vidéo ${videoId}`)
        
      } catch (error) {
        console.error("Erreur lors de l'analyse avancée", error)
        
        // Mettre à jour le statut pour indiquer l'échec
        await serviceClient
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Erreur d'analyse: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId)
      }
    })())
    
    // Retourner la réponse immédiate
    return responsePromise

  } catch (error) {
    console.error("Erreur non gérée", error)
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
