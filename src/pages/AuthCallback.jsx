import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erreur lors de la récupération de la session:', error);
          navigate('/login?error=auth_callback_error');
          return;
        }

        if (data?.session) {
          // Utilisateur connecté avec succès
          navigate('/dashboard'); // ou la page principale de votre app
        } else {
          // Pas de session, rediriger vers login
          navigate('/login');
        }
      } catch (error) {
        console.error('Erreur dans le callback d\'authentification:', error);
        navigate('/login?error=callback_error');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Finalisation de la connexion...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
