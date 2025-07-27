// src/components/VideoList.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserVideos, getVideoUrl, deleteVideo } from '../lib/videoProcessing';
import { getStatusLabel, isProcessingStatus, isCompletedStatus, isErrorStatus } from '../constants/videoStatus';

const VideoList = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoUrls, setVideoUrls] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const PAGE_SIZE = 10;

  // Récupérer l'utilisateur actuel
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
      }
    };

    fetchUser();

    // Écouter les changements d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setVideos([]);
        }
      }
    );

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Charger les vidéos quand l'utilisateur change
  useEffect(() => {
    if (user) {
      loadVideos();
    }
  }, [user, currentPage, statusFilter, refreshTrigger]);

  // Configurer un rafraîchissement périodique pour les vidéos en traitement
  useEffect(() => {
    const hasProcessingVideos = videos.some(video => isProcessingStatus(video.status));
    
    let intervalId = null;
    if (hasProcessingVideos) {
      intervalId = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 10000); // Rafraîchir toutes les 10 secondes
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [videos]);

  // Charger les vidéos
  const loadVideos = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Chargement des vidéos pour l\'utilisateur:', user.id);
      
      // Essayer d'abord une requête directe à la table videos
      const { data: directVideos, error: directError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (directError) {
        console.error('Erreur lors de la requête directe:', directError);
        throw new Error(`Erreur lors du chargement des vidéos: ${directError.message}`);
      }
      
      console.log('Vidéos trouvées:', directVideos);
      setVideos(directVideos || []);
      setTotalCount(directVideos?.length || 0);
      
      // Précharger les URLs pour les vidéos complétées
      const completedVideos = (directVideos || []).filter(v => isCompletedStatus(v.status));
      if (completedVideos.length > 0) {
        loadVideoUrls(completedVideos);
      }
      
    } catch (err) {
      console.error('Erreur lors du chargement des vidéos:', err);
      setError(err.message || 'Impossible de charger les vidéos');
    } finally {
      setLoading(false);
    }
  };

  // Charger les URLs des vidéos
  const loadVideoUrls = async (videosToLoad) => {
    const urls = { ...videoUrls };
    
    for (const video of videosToLoad) {
      if (!urls[video.id] && video.processed_file_path) {
        try {
          const { url } = await getVideoUrl(video.processed_file_path);
          if (url) {
            urls[video.id] = url;
          }
        } catch (err) {
          console.error(`Erreur lors du chargement de l'URL pour la vidéo ${video.id}:`, err);
        }
      }
    }
    
    setVideoUrls(urls);
  };

  // Gérer la sélection d'une vidéo
  const handleVideoSelect = async (video) => {
    if (selectedVideo?.id === video.id) {
      setSelectedVideo(null);
      return;
    }
    
    setSelectedVideo(video);
    
    // Charger l'URL si nécessaire
    if (isCompletedStatus(video.status) && !videoUrls[video.id]) {
      try {
        const { url } = await getVideoUrl(video.processed_file_path);
        if (url) {
          setVideoUrls(prev => ({
            ...prev,
            [video.id]: url
          }));
        }
      } catch (err) {
        console.error(`Erreur lors du chargement de l'URL pour la vidéo ${video.id}:`, err);
      }
    }
  };

  // Gérer la suppression d'une vidéo
  const handleDeleteVideo = async (videoId) => {
    if (!user || !videoId) return;
    
    try {
      const { success, error } = await deleteVideo(videoId, user.id);
      
      if (error) {
        throw new Error(`Erreur lors de la suppression: ${error.message}`);
      }
      
      if (success) {
        // Mettre à jour la liste des vidéos
        setVideos(prev => prev.filter(v => v.id !== videoId));
        
        // Nettoyer les états
        if (selectedVideo?.id === videoId) {
          setSelectedVideo(null);
        }
        
        setVideoUrls(prev => {
          const newUrls = { ...prev };
          delete newUrls[videoId];
          return newUrls;
        });
        
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de la vidéo:', err);
      alert(`Erreur: ${err.message}`);
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Rendu du composant
  return (
    <div className="video-list-container">
      <h2>Mes vidéos</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="filters">
        <div className="status-filter">
          <label>Filtrer par statut:</label>
          <select 
            value={statusFilter || ''} 
            onChange={(e) => setStatusFilter(e.target.value || null)}
          >
            <option value="">Tous</option>
            <option value="uploaded">Téléchargées</option>
            <option value="processing">En traitement</option>
            <option value="completed">Terminées</option>
            <option value="error">En erreur</option>
          </select>
        </div>
        
        <button 
          className="refresh-button"
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          disabled={loading}
        >
          Rafraîchir
        </button>
      </div>
      
      {loading ? (
        <div className="loading">Chargement des vidéos...</div>
      ) : videos.length === 0 ? (
        <div className="no-videos">
          {statusFilter 
            ? `Aucune vidéo avec le statut "${getStatusLabel(statusFilter)}"`
            : "Vous n'avez pas encore téléchargé de vidéos"}
        </div>
      ) : (
        <>
          <div className="video-grid">
            {videos.map(video => (
              <div 
                key={video.id} 
                className={`video-card ${selectedVideo?.id === video.id ? 'selected' : ''}`}
                onClick={() => handleVideoSelect(video)}
              >
                <div className="video-card-header">
                  <h3>{video.title}</h3>
                  <span className={`status-badge status-${video.status}`}>
                    {getStatusLabel(video.status)}
                  </span>
                </div>
                
                <div className="video-card-body">
                  {video.description && (
                    <p className="video-description">{video.description}</p>
                  )}
                  
                  <p className="video-date">
                    Téléchargée le {new Date(video.created_at).toLocaleDateString()}
                  </p>
                  
                  {isErrorStatus(video.status) && video.error_message && (
                    <p className="video-error">{video.error_message}</p>
                  )}
                </div>
                
                <div className="video-card-actions">
                  {isCompletedStatus(video.status) && (
                    <button 
                      className="view-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVideoSelect(video);
                      }}
                    >
                      Voir
                    </button>
                  )}
                  
                  <button 
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(video.id);
                    }}
                  >
                    Supprimer
                  </button>
                </div>
                
                {deleteConfirm === video.id && (
                  <div className="delete-confirm" onClick={e => e.stopPropagation()}>
                    <p>Êtes-vous sûr de vouloir supprimer cette vidéo ?</p>
                    <div className="delete-confirm-actions">
                      <button 
                        className="confirm-yes"
                        onClick={() => handleDeleteVideo(video.id)}
                      >
                        Oui
                      </button>
                      <button 
                        className="confirm-no"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Non
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Précédent
              </button>
              
              <span className="page-info">
                Page {currentPage} sur {totalPages}
              </span>
              
              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Lecteur vidéo pour la vidéo sélectionnée */}
      {selectedVideo && isCompletedStatus(selectedVideo.status) && videoUrls[selectedVideo.id] && (
        <div className="video-player-modal" onClick={() => setSelectedVideo(null)}>
          <div className="video-player-container" onClick={e => e.stopPropagation()}>
            <div className="video-player-header">
              <h3>{selectedVideo.title}</h3>
              <button 
                className="close-button"
                onClick={() => setSelectedVideo(null)}
              >
                ×
              </button>
            </div>
            
            <div className="video-player">
              <video 
                controls 
                autoPlay 
                src={videoUrls[selectedVideo.id]}
                width="100%"
              >
                Votre navigateur ne prend pas en charge la lecture vidéo.
              </video>
            </div>
            
            {selectedVideo.description && (
              <div className="video-player-description">
                <p>{selectedVideo.description}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoList;
