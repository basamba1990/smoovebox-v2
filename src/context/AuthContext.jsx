import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Récupérer le profil utilisateur avec gestion d'erreur améliorée
  const fetchUserProfile = async (userId) => {
    try {
      console.log('Récupération du profil pour userId:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Si la table profiles n'existe pas ou l'utilisateur n'a pas de profil
        if (error.code === 'PGRST116' || error.code === 'PGRST301') {
          console.warn('Table profiles non trouvée ou profil inexistant:', error.message);
          
          // Tentative de création du profil si manquant
          try {
            const currentUser = await supabase.auth.getUser();
            const userData = currentUser?.data?.user;
            
            if (userData) {
              const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                  user_id: userId,
                  email: userData.email,
                  username: userData.email.split('@')[0],
                  full_name: userData.user_metadata?.full_name || 
                            `${userData.user_metadata?.first_name || ''} ${userData.user_metadata?.last_name || ''}`.trim()
                })
                .select()
                .single();
                
              if (createError) throw createError;
              console.log('Profil créé avec succès:', newProfile);
              setProfile(newProfile);
              return;
            }
          } catch (createError) {
            console.error('Erreur lors de la création du profil:', createError.message);
          }
        }
        throw error;
      }
      
      console.log('Profil récupéré avec succès:', data);
      setProfile(data);
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error.message);
      setProfile(null);
      // Ne pas bloquer l'application pour les erreurs de profil
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erreur de session:', error.message);
          setError(error.message);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        if (mounted) {
          if (session?.user) {
            console.log('Session utilisateur trouvée:', session.user.id);
            setUser(session.user);
            await fetchUserProfile(session.user.id);
          } else {
            console.log('Aucune session utilisateur trouvée');
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de la session:', error);
        if (mounted) {
          setError(error.message);
          setLoading(false);
        }
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('Événement d\'authentification:', event, session?.user?.id);
        
        try {
          if (session?.user) {
            setUser(session.user);
            await fetchUserProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
          setError(null);
        } catch (error) {
          console.error('Erreur lors du changement d\'état d\'authentification:', error);
          setError(error.message);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password, firstName, lastName) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) throw error;
      
      // Vérifier si l'inscription a réussi et si l'utilisateur est créé
      if (data?.user) {
        console.log('Utilisateur créé avec succès:', data.user.id);
        
        // Attendre un peu pour que les triggers de base de données s'exécutent
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Vérifier si le profil a été créé automatiquement
        await fetchUserProfile(data.user.id);
      }
      
      return data;
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Erreur de connexion:', error);
        throw error;
      }
      
      console.log('Connexion réussie:', data);
      
      // Vérifier explicitement si la session est établie
      if (data?.session) {
        // Forcer le rafraîchissement de la session
        await supabase.auth.refreshSession();
      }
      
      return data;
    } catch (error) {
      console.error('Erreur dans signIn:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
      setUser(null);
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

