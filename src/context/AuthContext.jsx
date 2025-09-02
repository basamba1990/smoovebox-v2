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

  // Fonction pour créer un profil utilisateur dans la base de données
  const createUserProfile = async (userId, userData) => {
    try {
      console.log('Création d\'un nouveau profil pour:', userId);
      
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
        console.error('Erreur lors de la création du profil:', error);
        // Retourner un profil minimal même en cas d'erreur
        return newProfile;
      }
      
      console.log('Profil créé avec succès:', data);
      return data;
    } catch (err) {
      console.error('Exception lors de la création du profil:', err);
      // Retourner un profil minimal en cas d'exception
      return {
        user_id: userId,
        email: userData?.email,
        username: userData?.email?.split('@')[0] || 'utilisateur',
        full_name: 'Utilisateur'
      };
    }
  };

  // Récupérer ou créer le profil utilisateur
  const fetchUserProfile = async (userId, userData) => {
    if (!userId) return null;
    
    try {
      console.log('Récupération du profil pour userId:', userId);
      
      // Vérifier d'abord si la table profiles existe
      const { error: tableCheckError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
        .maybeSingle();
      
      // Si la table n'existe pas, retourner un profil minimal
      if (tableCheckError && (tableCheckError.code === 'PGRST116' || tableCheckError.code === '42P01')) {
        console.warn('Table profiles non trouvée:', tableCheckError.message);
        return {
          user_id: userId,
          email: userData?.email,
          username: userData?.email?.split('@')[0] || 'utilisateur',
          full_name: userData?.user_metadata?.full_name || 'Utilisateur'
        };
      }
      
      // Récupérer le profil existant
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Si le profil n'existe pas, le créer
      if ((error && error.code === 'PGRST116') || !data) {
        console.log('Profil non trouvé, création d\'un nouveau profil');
        return await createUserProfile(userId, userData);
      }
      
      if (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        throw error;
      }

      console.log('Profil récupéré avec succès:', data);
      return data;
    } catch (err) {
      console.error('Exception lors de la récupération du profil:', err);
      // Ne pas bloquer l'application, créer un profil minimal
      return {
        user_id: userId,
        email: userData?.email,
        username: userData?.email?.split('@')[0] || 'utilisateur',
        full_name: userData?.user_metadata?.full_name || 'Utilisateur'
      };
    }
  };

  // Mettre à jour le profil utilisateur
  const updateUserProfile = async (updates) => {
    try {
      if (!user?.id) throw new Error('Utilisateur non connecté');
      
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Initialisation et gestion des changements d'état d'authentification
  useEffect(() => {
    let mounted = true;
    let authTimeout = null;

    const getSession = async () => {
      try {
        // Ajouter un timeout pour éviter de bloquer indéfiniment
        const timeoutPromise = new Promise((_, reject) => {
          authTimeout = setTimeout(() => {
            reject(new Error("Timeout lors de la récupération de la session Supabase."));
          }, 15000); // Augmenter le timeout à 15 secondes pour les connexions lentes
        });
        
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);
        
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        
        const { data: { session }, error } = sessionResult;
        
        if (error) {
          console.error(`AuthContext: Erreur de session Supabase: ${error.message} (Code: ${error.code || 'N/A'})`);
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
            console.log('AuthContext: Session utilisateur trouvée:', session.user.id);
            setUser(session.user);
            const profileData = await fetchUserProfile(session.user.id, session.user);
            setProfile(profileData);
            setConnectionStatus('connected');
            setError(null); // Réinitialiser l'erreur en cas de succès
          } else {
            console.log('AuthContext: Aucune session utilisateur trouvée.');
            setUser(null);
            setProfile(null);
            setConnectionStatus('disconnected');
            setError(null); // Réinitialiser l'erreur si pas de session
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('AuthContext: Exception lors de la récupération de la session:', error);
        if (mounted) {
          setError(error.message);
          setLoading(false);
          setConnectionStatus(error.message.includes('Timeout') ? 'timeout' : 'error');
          setUser(null); // S'assurer que l'utilisateur est null en cas d'erreur critique
          setProfile(null);
        }
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('AuthContext: Événement d\'authentification:', event, session?.user?.id);
        
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
          console.error('AuthContext: Erreur lors du changement d\'état d\'authentification:', error);
          setError(error.message);
          setLoading(false);
          setConnectionStatus('error');
        }
      }
    );

    return () => {
      mounted = false;
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  // Inscription d'un nouvel utilisateur
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
            full_name: `${firstName} ${lastName}`.trim()
          },
        },
      });

      if (error) throw error;
      
      if (data?.user) {
        console.log('Utilisateur créé avec succès:', data.user.id);
        
        // Attendre un peu pour que la création de l'utilisateur soit propagée
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Créer le profil utilisateur
        const profileData = await fetchUserProfile(data.user.id, data.user);
        setProfile(profileData);
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

  // Connexion d'un utilisateur existant
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
      
      // La session est gérée par onAuthStateChange
      return data;
    } catch (error) {
      console.error('Erreur dans signIn:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Connexion avec un fournisseur OAuth
  const signInWithProvider = async (provider) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error(`Erreur lors de la connexion avec ${provider}:`, error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion de l'utilisateur
  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
      setUser(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Réinitialisation du mot de passe
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
      console.error('Erreur lors de la réinitialisation du mot de passe:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Mise à jour du mot de passe
  const updatePassword = async (newPassword) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du mot de passe:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Vérifier si l'utilisateur a un rôle spécifique
  const hasRole = (role) => {
    if (!user) return false;
    
    // Vérifier dans app_metadata.roles (tableau)
    const roles = user.app_metadata?.roles || [];
    if (Array.isArray(roles) && roles.includes(role)) {
      return true;
    }
    
    // Vérifier dans app_metadata.role (chaîne)
    if (user.app_metadata?.role === role) {
      return true;
    }
    
    return false;
  };

  // Vérifier si l'utilisateur est administrateur
  const isAdmin = () => {
    return hasRole('admin');
  };

  const handleAuthError = useCallback((error) => {
    console.error("Erreur d'authentification:", error);
    setError(error.message || "Erreur d'authentification");

    // Réinitialiser l'état en cas d'erreur critique
    if (error.message?.includes("Invalid token") || error.message?.includes("JWT expired")) {
      setUser(null);
      setProfile(null);
    }
  }, []);

  // Valeurs exposées par le contexte
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
  }), [
    user, profile, loading, error, connectionStatus,
    signUp, signIn, signInWithProvider, signOut,
    resetPassword, updatePassword, updateUserProfile, 
    hasRole, isAdmin, handleAuthError
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
