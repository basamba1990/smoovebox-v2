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

  const fetchUserProfile = async (userId) => {
    try {
      console.log('Récupération du profil pour userId:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'PGRST301') {
          console.warn('Table profiles non trouvée ou profil inexistant:', error.message);
          // Créer un profil par défaut sans bloquer l'application
          setProfile({
            id: userId,
            user_id: userId,
            email: user?.email || 'utilisateur@example.com',
            username: user?.email?.split('@')[0] || 'utilisateur',
            full_name: user?.user_metadata?.full_name || 'Utilisateur'
          });
          return;
        }
        throw error;
      }

      setProfile(data);
    } catch (err) {
      console.error('Erreur lors de la récupération du profil:', err);
      // Ne pas bloquer l'application, créer un profil minimal
      setProfile({
        id: userId,
        user_id: userId,
        email: user?.email || 'utilisateur@example.com',
        username: user?.email?.split('@')[0] || 'utilisateur',
        full_name: user?.user_metadata?.full_name || 'Utilisateur'
      });
    }
  };
  useEffect(() => {
    let mounted = true;

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
      
      if (data?.user) {
        console.log('Utilisateur créé avec succès:', data.user.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
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
      
      // La session est gérée par onAuthStateChange, pas besoin de refreshSession ici
      
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


