// src/pages/VideoManagement.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import VideoUploader from '../components/VideoUploader';
import VideoList from '../components/VideoList';
import '../styles/videoComponents.css';

const VideoManagement = () => {
  const [activeTab, setActiveTab] = useState('list'); // 'list' ou 'upload'
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();

  // Vérifier si l'utilisateur est connecté
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Vérifier l'état de l'authentification
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(data.user);
        } else {
          // Rediriger vers la page de connexion si non connecté
          navigate('/login', { state: { returnTo: '/videos' } });
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Écouter les changements d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          navigate('/login', { state: { returnTo: '/videos' } });
        }
      }
    );

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [navigate]);

  // Gérer le téléchargement terminé
  const handleUploadComplete = (video) => {
    // Passer à l'onglet liste et rafraîchir
    setActiveTab('list');
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="video-management-page">
      <div className="page-header">
        <h1>Gestion des vidéos</h1>
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Mes vidéos
          </button>
          <button 
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Télécharger une vidéo
          </button>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'upload' ? (
          <VideoUploader onUploadComplete={handleUploadComplete} />
        ) : (
          <VideoList key={refreshTrigger} />
        )}
      </div>
    </div>
  );
};

export default VideoManagement;
