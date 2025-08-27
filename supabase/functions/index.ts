// Edge Function pour la création sécurisée de profils utilisateur
// Fichier: supabase/functions/create-user-profile/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CreateProfileRequest {
  full_name?: string;
  avatar_url?: string;
  preferences?: Record<string, any>;
}

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Méthode non autorisée' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialiser le client Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Récupérer le token d'authentification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token d\'authentification requis' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Vérifier l'utilisateur authentifié
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Erreur d\'authentification:', authError);
      return new Response(
        JSON.stringify({ error: 'Utilisateur non authentifié' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parser les données de la requête
    const requestData: CreateProfileRequest = await req.json();

    // Vérifier si le profil existe déjà
    const { data: existingProfile, error: checkError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Erreur lors de la vérification du profil:', checkError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la vérification du profil' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Si le profil existe déjà, le mettre à jour
    if (existingProfile) {
      const { data: updatedProfile, error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          full_name: requestData.full_name || user.user_metadata?.full_name || user.email,
          avatar_url: requestData.avatar_url || user.user_metadata?.avatar_url,
          preferences: requestData.preferences || {},
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Erreur lors de la mise à jour du profil:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erreur lors de la mise à jour du profil' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Logger l'activité
      await supabaseClient
        .from('user_activities')
        .insert({
          user_id: user.id,
          activity_type: 'profile_updated',
          activity_data: {
            updated_fields: Object.keys(requestData),
            timestamp: new Date().toISOString()
          }
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          profile: updatedProfile,
          message: 'Profil mis à jour avec succès'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Créer un nouveau profil
    const { data: newProfile, error: createError } = await supabaseClient
      .from('profiles')
      .insert({
        user_id: user.id,
        email: user.email,
        full_name: requestData.full_name || user.user_metadata?.full_name || user.email,
        avatar_url: requestData.avatar_url || user.user_metadata?.avatar_url,
        preferences: requestData.preferences || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Erreur lors de la création du profil:', createError);
      return new Response(
        JSON.stringify({ error: 'Erreur lors de la création du profil' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Logger l'activité de création
    await supabaseClient
      .from('user_activities')
      .insert({
        user_id: user.id,
        activity_type: 'profile_created',
        activity_data: {
          creation_method: 'edge_function',
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: newProfile,
        message: 'Profil créé avec succès'
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur dans create-user-profile:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

