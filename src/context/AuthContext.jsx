// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, checkSupabaseConnection, retryOperation } from '../lib/supabase.js';

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
  const [connectionStatus, setConnectionStatus] = useState('checking');

  // Utiliser useCallback pour éviter les recréations inutiles de cette fonction
  const fetchUserProfile = useCallback(async (userId) => {
    if (!userId) {
      console.error('fetchUserProfile appelé sans userId');
      return;
    }

    try {
      console.log('Récupération du profil pour userId:', userId);
      
      const { data, error } = await retryOperation(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
      }, 3); // Essayer 3 fois maximum

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'PGRST301') {
          console.warn('Table profiles non trouvée ou profil inexistant:', error.message);
          
          // Tenter de créer un profil par défaut
          try {
            const userDetails = await supabase.auth.getUser();
            const userData = userDetails?.data?.user;
            
            const defaultProfile = {
              id: userId,
              user_id: userId,
              email: userData?.email || user?.email || 'utilisateur@example.com',
              username: (userData?.email || user?.email || 'utilisateur').split('@')[0],
              full_name: userData?.user_metadata?.full_name || user?.user_metadata?.full_name || 'Utilisateur'
            };
            
            // Essayer d'insérer le profil dans la base de données
            const { data: insertedProfile, error: insertError } = await supabase
              .from('profiles')
              .insert(defaultProfile)
              .select()
              .single();
              
            if (insertError) {
              console.warn('Impossible de créer le profil:', insertError);
              setProfile(defaultProfile); // Utiliser le profil par défaut en mémoire
            } else {
              console.log('Profil créé avec succès:', insertedProfile);
              setProfile(insertedProfile);
            }
            return;
          } catch (createErr) {
            console.error('Erreur lors de la création du profil:', createErr);
            // Continuer avec un profil par défaut en mémoire
          }
          
          // Créer un profil par défaut sans bloquer l'application
          const defaultProfile = {
            id: userId,
            user_id: userId,
            email: user?.email || 'utilisateur@example.com',
            username: (user?.email || 'utilisateur').split('@')[0],
            full_name: user?.user_metadata?.full_name || 'Utilisateur'
          };
          setProfile(defaultProfile);
          return;
        }
        throw error;
      }

      if (data) {
        console.log('Profil récupéré avec succès');
        setProfile(data);
      } else {
        console.warn('Aucun profil trouvé mais pas d\'erreur');
        // Créer un profil minimal
        const fallbackProfile = {
          id: userId,
          user_id: userId,
          email: user?.email || 'utilisateur@example.com',
          username: (user?.email || 'utilisateur').split('@')[0],
          full_name: user?.user_metadata?.full_name || 'Utilisateur'
        };
        setProfile(fallbackProfile);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du profil:', err);
      // Ne pas bloquer l'application, créer un profil minimal
      const fallbackProfile = {
        id: userId,
        user_id: userId,
        email: user?.email || 'utilisateur@example.com',
        username: (user?.email || 'utilisateur').split('@')[0],
        full_name: user?.user_metadata?.full_name || 'Utilisateur'
      };
      setProfile(fallbackProfile);
    }
  }, [user]);

  // Vérifier la connexion Supabase au démarrage
  useEffect(() => {
    const verifyConnection = async () => {
      try {
        const connectionResult = await checkSupabaseConnection();
        if (connectionResult.connected) {
          setConnectionStatus('connected');
          if (connectionResult.error) {
            console.warn('Connexion avec avertissements:', connectionResult.error);
          }
        } else {
          setConnectionStatus('error');
          setError(connectionResult.error || 'Erreur de connexion à Supabase');
        }
      } catch (err) {
        console.error('Erreur lors de la vérification de connexion:', err);
        setConnectionStatus('error');
        setError(`Erreur de vérification de connexion: ${err.message}`);
      }
    };

    verifyConnection();
  }, []);

  // Gérer la session utilisateur
  useEffect(() => {
    let mounted = true;
    let authSubscription = null;

    const getSession = async () => {
      // Attendre que la vérification de connexion soit terminée
      if (connectionStatus === 'checking') {
        return;
      }

      if (connectionStatus === 'error') {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { session }, error } = await retryOperation(async () => {
          return await supabase.auth.getSession();
        }, 3); // Essayer 3 fois maximum
        
        if (error) {
          console.error('Erreur de session:', error.message);
          if (mounted) {
            setError(`Erreur de session: ${error.message}`);
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
          setError(`Erreur de récupération de session: ${error.message}`);
          setLoading(false);
        }
      }
    };

    // Configurer l'écouteur d'événements d'authentification
    const setupAuthListener = () => {
      try {
        const { data } = supabase.auth.onAuthStateChange(
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
              setError(`Erreur de changement d'état: ${error.message}`);
              setLoading(false);
            }
          }
        );
        
        return data.subscription;
      } catch (error) {
        console.error('Erreur lors de la configuration de l\'écouteur d\'authentification:', error);
        return null;
      }
    };

    getSession();
    authSubscription = setupAuthListener();

    return () => {
      mounted = false;
      if (authSubscription) {
        try {
          authSubscription.unsubscribe();
        } catch (error) {
          console.error('Erreur lors de la désinscription de l\'écouteur d\'authentification:', error);
        }
      }
    };
  }, [connectionStatus, fetchUserProfile]);

  const signUp = async (email, password, firstName, lastName) => {
    if (!email || !password) {
      const errorMsg = 'Email et mot de passe requis pour l\'inscription';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Tentative d\'inscription pour:', email);
      
      const { data, error } = await retryOperation(async () => {
        return await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName || '',
              last_name: lastName || '',
              full_name: `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0]
            },
          },
        });
      }, 2); // Essayer 2 fois maximum

      if (error) {
        console.error('Erreur d\'inscription Supabase:', error);
        
        // Gestion spécifique des erreurs d'inscription
        let errorMessage = error.message;
        if (error.message.includes('User already registered')) {
          errorMessage = 'Un compte existe déjà avec cette adresse email. Essayez de vous connecter.';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Adresse email invalide.';
        }
        
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      if (data?.user) {
        console.log('Utilisateur créé avec succès:', data.user.id);
        // Attendre un peu pour que les triggers de base de données s'exécutent
        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchUserProfile(data.user.id);
        return data;
      } else {
        const errorMsg = 'Inscription réussie mais aucune donnée utilisateur reçue';
        console.warn(errorMsg);
        return { user: null, session: null, message: errorMsg };
      }
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      if (!error.message.includes('Un compte existe déjà')) {
        setError(`Erreur d'inscription: ${error.message}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    if (!email || !password) {
      const errorMsg = 'Email et mot de passe requis pour la connexion';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Tentative de connexion pour:', email);
      
      const { data, error } = await retryOperation(async () => {
        return await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }, 2); // Essayer 2 fois maximum

      if (error) {
        console.error('Erreur de connexion Supabase:', error);
        
        // Gestion spécifique des erreurs courantes
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Veuillez confirmer votre email avant de vous connecter.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.';
        } else if (error.message.includes('User not found')) {
          errorMessage = 'Aucun compte trouvé avec cette adresse email. Créez un compte d\'abord.';
        }
        
        setError(errorMessage);
        throw new Error(errorMessage);
      }
      
      if (!data?.user) {
        const errorMsg = 'Aucune donnée utilisateur reçue lors de la connexion';
        console.error(errorMsg);
        setError(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('Connexion réussie pour l\'utilisateur:', data.user.id);
      
      // Attendre un peu pour que onAuthStateChange se déclenche
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return data;
    } catch (error) {
      console.error('Erreur dans signIn:', error);
      if (!error.message.includes('Email ou mot de passe incorrect')) {
        setError(`Erreur de connexion: ${error.message}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Tentative de déconnexion');
      
      const { error } = await retryOperation(async () => {
        return await supabase.auth.signOut();
      }, 2); // Essayer 2 fois maximum
      
      if (error) {
        console.error('Erreur de déconnexion:', error);
        throw error;
      }
      
      // Réinitialiser l'état même si onAuthStateChange devrait le faire
      setProfile(null);
      setUser(null);
      console.log('Déconnexion réussie');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      setError(`Erreur de déconnexion: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour mettre à jour le profil utilisateur
  const updateProfile = async (profileData) => {
    if (!user?.id) {
      const errorMsg = 'Utilisateur non connecté';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await retryOperation(async () => {
        return await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user.id)
          .select()
          .single();
      }, 2);
      
      if (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        throw error;
      }
      
      if (data) {
        console.log('Profil mis à jour avec succès');
        setProfile(data);
        return data;
      } else {
        throw new Error('Aucune donnée retournée lors de la mise à jour du profil');
      }
    } catch (error) {
      console.error('Erreur dans updateProfile:', error);
      setError(`Erreur de mise à jour du profil: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour réinitialiser le mot de passe
  const resetPassword = async (email) => {
    if (!email) {
      const errorMsg = 'Email requis pour la réinitialisation du mot de passe';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await retryOperation(async () => {
        return await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }, 2);
      
      if (error) {
        console.error('Erreur lors de la réinitialisation du mot de passe:', error);
        throw error;
      }
      
      console.log('Email de réinitialisation envoyé avec succès');
      return { success: true };
    } catch (error) {
      console.error('Erreur dans resetPassword:', error);
      setError(`Erreur de réinitialisation du mot de passe: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour mettre à jour le mot de passe
  const updatePassword = async (newPassword) => {
    if (!newPassword) {
      const errorMsg = 'Nouveau mot de passe requis';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await retryOperation(async () => {
        return await supabase.auth.updateUser({
          password: newPassword
        });
      }, 2);
      
      if (error) {
        console.error('Erreur lors de la mise à jour du mot de passe:', error);
        throw error;
      }
      
      console.log('Mot de passe mis à jour avec succès');
      return { success: true };
    } catch (error) {
      console.error('Erreur dans updatePassword:', error);
      setError(`Erreur de mise à jour du mot de passe: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour rafraîchir manuellement le profil
  const refreshProfile = async () => {
    if (!user?.id) {
      console.warn('Tentative de rafraîchissement du profil sans utilisateur connecté');
      return;
    }
    
    try {
      await fetchUserProfile(user.id);
      return profile;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du profil:', error);
      throw error;
    }
  };

  const value = {
    user,
    profile,
    loading,
    error,
    connectionStatus,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
