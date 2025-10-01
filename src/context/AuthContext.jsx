// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, refreshSession } from '../lib/supabase.js';

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
  const [connectionStatus, setConnectionStatus] = useState('connected');

  // Fonction pour créer un profil utilisateur
  const createUserProfile = async (userId, userData) => {
    try {
      console.log('Création d\'un nouveau profil pour:', userId);
      
      const profileData = {
        id: userId,
        username: userData.email?.split('@')[0] || `user_${userId.slice(0, 8)}`,
        email: userData.email,
        full_name: userData.user_metadata?.full_name || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData);

      if (profileError) {
        console.error('Erreur création profil:', profileError);
        // Ne pas jeter d'erreur si le profil existe déjà
        if (profileError.code !== '23505') {
          throw profileError;
        }
      }

      return profileData;
    } catch (error) {
      console.error('Erreur création profil utilisateur:', error);
      throw error;
    }
  };

  // Récupérer ou créer le profil utilisateur
  const fetchUserProfile = async (userId, userData = null) => {
    if (!userId) return null;

    try {
      // Essayer de récupérer le profil existant
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Utiliser maybeSingle() pour éviter les 406

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Erreur récupération profil:', profileError);
      }

      // Si le profil n'existe pas et qu'on a des données utilisateur, le créer
      if (!profile && userData) {
        return await createUserProfile(userId, userData);
      }

      return profile;
    } catch (error) {
      console.error('Erreur récupération profil:', error);
      return null;
    }
  };

  // Mettre à jour le profil utilisateur
  const updateUserProfile = async (updates) => {
    try {
      if (!user?.id) throw new Error('Utilisateur non connecté');

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      return data;
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      throw error;
    }
  };

  // Initialisation et gestion des changements d'état d'authentification
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Vérifier et rafraîchir la session
        const hasValidSession = await refreshSession();
        
        if (!mounted) return;

        if (hasValidSession) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            setUser(session.user);
            const userProfile = await fetchUserProfile(session.user.id, session.user);
            setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error('Erreur initialisation auth:', error);
        if (mounted) {
          setError(error.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Changement état auth:', event);

        if (session?.user) {
          setUser(session.user);
          const userProfile = await fetchUserProfile(session.user.id, session.user);
          setProfile(userProfile);
          setError(null);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Inscription
  const signUp = async (email, password, firstName, lastName) => {
    setLoading(true);
    setError(null);
    
    try {
      const fullName = `${firstName} ${lastName}`.trim();
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: fullName
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Créer le profil utilisateur
        await createUserProfile(data.user.id, {
          email: data.user.email,
          user_metadata: data.user.user_metadata
        });
      }

      return data;
    } catch (error) {
      console.error('Erreur inscription:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Connexion
  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Erreur connexion:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion
  const signOut = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setProfile(null);
      setUser(null);
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Valeurs du contexte
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    connectionStatus,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
    refreshSession: () => refreshSession(),
  }), [
    user, profile, loading, error, connectionStatus
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
