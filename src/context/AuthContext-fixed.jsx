import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, checkSupabaseConnection, retryOperation } from '../lib/supabase-fixed.js';

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

  const fetchUserProfile = async (userId) => {
    try {
      console.log('Récupération du profil pour userId:', userId);
      
      const { data, error } = await retryOperation(async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
      });

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'PGRST301') {
          console.warn('Table profiles non trouvée ou profil inexistant:', error.message);
          // Créer un profil par défaut sans bloquer l'application
          const defaultProfile = {
            id: userId,
            user_id: userId,
            email: user?.email || 'utilisateur@example.com',
            username: user?.email?.split('@')[0] || 'utilisateur',
            full_name: user?.user_metadata?.full_name || 'Utilisateur'
          };
          setProfile(defaultProfile);
          return;
        }
        throw error;
      }

      setProfile(data);
    } catch (err) {
      console.error('Erreur lors de la récupération du profil:', err);
      // Ne pas bloquer l'application, créer un profil minimal
      const fallbackProfile = {
        id: userId,
        user_id: userId,
        email: user?.email || 'utilisateur@example.com',
        username: user?.email?.split('@')[0] || 'utilisateur',
        full_name: user?.user_metadata?.full_name || 'Utilisateur'
      };
      setProfile(fallbackProfile);
    }
  };

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
          setError(connectionResult.error);
        }
      } catch (err) {
        setConnectionStatus('error');
        setError(`Erreur de vérification de connexion: ${err.message}`);
      }
    };

    verifyConnection();
  }, []);

  useEffect(() => {
    let mounted = true;

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
        });
        
        if (error) {
          console.error('Erreur de session:', error.message);
          setError(`Erreur de session: ${error.message}`);
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
          setError(`Erreur de récupération de session: ${error.message}`);
          setLoading(false);
        }
      }
    };

    getSession();

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
          setError(`Erreur de changement d'état: ${error.message}`);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [connectionStatus]);

  const signUp = async (email, password, firstName, lastName) => {
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
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim()
            },
          },
        });
      });

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
      }
      
      return data;
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
    setLoading(true);
    setError(null);
    try {
      console.log('Tentative de connexion pour:', email);
      
      const { data, error } = await retryOperation(async () => {
        return await supabase.auth.signInWithPassword({
          email,
          password,
        });
      });

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
      });
      
      if (error) {
        console.error('Erreur de déconnexion:', error);
        throw error;
      }
      
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

  const value = {
    user,
    profile,
    loading,
    error,
    connectionStatus,
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

