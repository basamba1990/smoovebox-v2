// src/contexts/AuthContext.jsx
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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Erreur récupération profil:', profileError);
      }

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
    let isInitializing = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (session?.user) {
          console.log('[Auth] Session found in storage:', session.user.id);
          setUser(session.user);
          const userProfile = await fetchUserProfile(session.user.id, session.user);
          setProfile(userProfile);
          
          refreshSession().catch(err => {
            console.warn('[Auth] Background session refresh failed:', err);
          });
        } else {
          console.log('[Auth] No session found in storage');
          const hasValidSession = await refreshSession();
          
          if (hasValidSession) {
            const { data: { session: refreshedSession } } = await supabase.auth.getSession();
            if (refreshedSession?.user) {
              console.log('[Auth] Session restored after refresh:', refreshedSession.user.id);
              setUser(refreshedSession.user);
              const userProfile = await fetchUserProfile(refreshedSession.user.id, refreshedSession.user);
              setProfile(userProfile);
            }
          }
        }
      } catch (error) {
        console.error('[Auth] Erreur initialisation auth:', error);
        if (mounted) {
          setError(error.message);
        }
      } finally {
        if (mounted) {
          isInitializing = false;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (isInitializing && event !== 'SIGNED_OUT') {
          console.log('[Auth] onAuthStateChange ignored during initialization:', event);
          return;
        }

        console.log('[Auth] onAuthStateChange:', event, session?.user?.id);

        if (session?.user) {
          setUser(session.user);
          const userProfile = await fetchUserProfile(session.user.id, session.user);
          setProfile(userProfile);
          setError(null);
        } else {
          setUser(null);
          setProfile(null);
        }
        
        if (!isInitializing) {
          setLoading(false);
        }
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
        await createUserProfile(data.user.id, {
          email: data.user.email,
          user_metadata: data.user.user_metadata
        });
        
        console.log('[Auth] signUp: Setting user state immediately:', data.user.id);
        setUser(data.user);
        const userProfile = await fetchUserProfile(data.user.id, data.user);
        setProfile(userProfile);
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

      if (data.user) {
        console.log('[Auth] signIn: Setting user state immediately:', data.user.id);
        setUser(data.user);
        const userProfile = await fetchUserProfile(data.user.id, data.user);
        setProfile(userProfile);
      }

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
  }), [user, profile, loading, error, connectionStatus]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
