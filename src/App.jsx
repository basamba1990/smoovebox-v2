// src/App.jsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';

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
      } finally {
        setLoading(false);
      }
    };
    checkConnection();
  }, [supabase]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          loading ? (
            <div style={{ padding: '2rem', background: '#000', color: '#fff' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Chargement...</h1>
            </div>
          ) : user ? (
            <div style={{ padding: '2rem', background: '#000', color: '#fff' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Bienvenue, {user.email}</h1>
              <button
                style={{ background: '#3b82f6', color: '#fff', padding: '0.5rem 1rem', marginRight: '1rem' }}
                onClick={() => navigate('/record-video')}
              >
                Enregistrer une vidéo
              </button>
              <button
                style={{ background: '#ef4444', color: '#fff', padding: '0.5rem 1rem' }}
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/login');
                }}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <div style={{ padding: '2rem', background: '#000', color: '#fff' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Bienvenue sur SpotBulle</h1>
              <button
                style={{ background: '#3b82f6', color: '#fff', padding: '0.5rem 1rem', marginRight: '1rem' }}
                onClick={() => navigate('/login')}
              >
                Se connecter
              </button>
              <button
                style={{ background: '#22c55e', color: '#fff', padding: '0.5rem 1rem' }}
                onClick={() => navigate('/register')}
              >
                S'inscrire
              </button>
            </div>
          )
        }
      />
    </Routes>
  );
};

export default App;
