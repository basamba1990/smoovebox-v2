// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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
  const [connectionStatus, setConnectionStatus] = useState('connected');

  const createUserProfile = async (userId, userData) => {
    try {
      console.log('Création profil pour userId:', userId, 'Données:', userData);
      const newProfile = {
        user_id: userId,
        email: userData?.email,
        username: userData?.email?.split('@')[0] || `user_${Date.now().toString(36)}`,
        full_name: userData?.user_metadata?.full_name || 
                  `${userData?.user_metadata?.first_name || ''} ${userData?.user_metadata?.last_name || ''}`.trim() || 
                  'Utilisateur',
        avatar_url: userData?.user_metadata?.avatar_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();
      if (error) {
        console.error('Erreur création profil:', error);
        return newProfile;
      }
      console.log('Profil créé:', data);
      return data;
    } catch (err) {
      console.error('Exception création profil:', err);
      return {
        user_id: userId,
        email: userData?.email,
        username: userData?.email?.split('@')[0] || 'utilisateur',
        full_name: 'Utilisateur'
      };
    }
  };

  const fetchUserProfile = async (userId, userData) => {
    if (!userId) {
      console.warn('fetchUserProfile: userId manquant');
      return null;
    }
    try {
      console.log('Récupération profil pour userId:', userId);
      const { error: tableCheckError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
        .maybeSingle();
      if (tableCheckError && (tableCheckError.code === 'PGRST116' || tableCheckError.code === '42P01')) {
        console.warn('Table profiles non trouvée:', tableCheckError.message);
        return {
          user_id: userId,
          email: userData?.email,
          username: userData?.email?.split('@')[0] || 'utilisateur',
          full_name: userData?.user_metadata?.full_name || 'Utilisateur'
        };
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if ((error && error.code === 'PGRST116') || !data) {
        console.log('Profil non trouvé, création...');
        return await createUserProfile(userId, userData);
      }
      if (error) {
        console.error('Erreur récupération profil:', error);
        throw error;
      }
      console.log('Profil récupéré:', data);
      return data;
    } catch (err) {
      console.error('Exception récupération profil:', err);
      return {
        user_id: userId,
        email: userData?.email,
        username: userData?.email?.split('@')[0] || 'utilisateur',
        full_name: userData?.user_metadata?.full_name || 'Utilisateur'
      };
    }
  };

  const updateUserProfile = async (updates) => {
    try {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let authTimeout = null;

    const getSession = async () => {
      try {
        console.log('AuthContext: Début récupération session');
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => {
            authTimeout = setTimeout(() => reject(new Error('Timeout session Supabase')), 15000);
          })
        ]);
        if (authTimeout) clearTimeout(authTimeout);
        const { data: { session }, error } = sessionResult;
        if (error) {
          console.error('AuthContext: Erreur session:', error.message, 'Code:', error.code);
          if (mounted) {
            setError(`Erreur de connexion: ${error.message}`);
            setUser(null);
            setProfile(null);
            setConnectionStatus('error');
          }
          return;
        }
        if (mounted) {
          if (session?.user) {
            console.log('AuthContext: Utilisateur trouvé:', session.user.id, session.user.email);
            setUser(session.user);
            const profileData = await fetchUserProfile(session.user.id, session.user);
            setProfile(profileData);
            setConnectionStatus('connected');
            setError(null);
          } else {
            console.log('AuthContext: Aucune session trouvée');
            setUser(null);
            setProfile(null);
            setConnectionStatus('disconnected');
            setError(null);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('AuthContext: Exception session:', error.message);
        if (mounted) {
          setError(error.message);
          setLoading(false);
          setConnectionStatus(error.message.includes('Timeout') ? 'timeout' : 'error');
          setUser(null);
          setProfile(null);
        }
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('AuthContext: Événement auth:', event, 'Session:', session?.user?.id);
      try {
        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchUserProfile(session.user.id, session.user);
          setProfile(profileData);
          setConnectionStatus('connected');
          setError(null);
        } else {
          setUser(null);
          setProfile(null);
          setConnectionStatus('disconnected');
          setError(null);
        }
        setLoading(false);
      } catch (error) {
        console.error('AuthContext: Erreur changement état auth:', error);
        setError(error.message);
        setLoading(false);
        setConnectionStatus('error');
      }
    });

    return () => {
      mounted = false;
      if (authTimeout) clearTimeout(authTimeout);
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
        options: { data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() } }
      });
      if (error) throw error;
      if (data?.user) {
        console.log('Utilisateur créé:', data.user.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const profileData = await fetchUserProfile(data.user.id, data.user);
        setProfile(profileData);
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

  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Erreur connexion:', error);
        throw error;
      }
      console.log('Connexion réussie:', data.user.id);
      return data;
    } catch (error) {
      console.error('Erreur signIn:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithProvider = async (provider) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erreur connexion ${provider}:`, error);
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
      console.error('Erreur déconnexion:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erreur réinitialisation mot de passe:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Erreur mise à jour mot de passe:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role) => {
    if (!user) return false;
    const roles = user.app_metadata?.roles || [];
    if (Array.isArray(roles) && roles.includes(role)) return true;
    if (user.app_metadata?.role === role) return true;
    return false;
  };

  const isAdmin = () => hasRole('admin');

  const handleAuthError = useCallback((error) => {
    console.error('Erreur auth:', error);
    setError(error.message || 'Erreur d\'authentification');
    if (error.message?.includes('Invalid token') || error.message?.includes('JWT expired')) {
      setUser(null);
      setProfile(null);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    connectionStatus,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    resetPassword,
    updatePassword,
    updateUserProfile,
    hasRole,
    isAdmin,
    handleAuthError
  }), [user, profile, loading, error, connectionStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
