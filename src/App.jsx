// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Button } from './components/ui/button-enhanced.jsx';
import { toast } from 'sonner';
import LoadingScreen from './components/LoadingScreen.jsx';

const App = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setConnectionStatus('connected');
      } catch (err) {
        console.error('Erreur connexion Supabase:', err);
        setConnectionStatus('disconnected');
        toast.error('Erreur de connexion à Supabase.');
      } finally {
        setLoading(false);
      }
    };
    checkConnection();
  }, [supabase]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <div className="p-8 min-h-screen bg-black text-white">
              <h1 className="text-3xl font-bold mb-6">Bienvenue, {user.email}</h1>
              <Button onClick={() => navigate('/record-video')} className="bg-blue-500">
                Enregistrer une vidéo
              </Button>
              <Button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/login');
                }}
                className="ml-4 bg-red-500"
              >
                Déconnexion
              </Button>
            </div>
          ) : (
            <div className="p-8 min-h-screen bg-black text-white">
              <h1 className="text-3xl font-bold mb-6">Bienvenue sur SpotBulle</h1>
              <Button onClick={() => navigate('/login')} className="bg-blue-500">
                Se connecter
              </Button>
              <Button onClick={() => navigate('/register')} className="ml-4 bg-green-500">
                S'inscrire
              </Button>
            </div>
          )
        }
      />
    </Routes>
  );
};

export default App;
