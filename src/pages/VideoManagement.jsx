// src/pages/VideoManagement.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import VideoPlayer from '../components/VideoPlayer';
import VideoAnalysisResults from '../components/VideoAnalysisResults';
import TranscriptionViewer from '../components/TranscriptionViewer';
import VideoProcessingStatus from '../components/VideoProcessingStatus';

const VideoManagement = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [processingVideoId, setProcessingVideoId] = useState(null); // Renommé pour être plus générique
  
  const fetchVideos = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Récupération des vidéos pour user_id:", user.id);
      
      // Requête améliorée avec plus d'informations
      // On sélectionne directement les champs nécessaires de la vue video_details
      const { data, error } = await supabase
        .from("video_details") // Utiliser la vue video_details
        .select(`
          video_id:id,
          title,
          description,
          url,
          public_url,
          storage_path,
          file_path,
          thumbnail_url,
          original_file_name,
          format,
          category,
          tags,
          status,
          views_count,
          likes_count,
          comments_count,
          transcription_attempts,
          transcription_data,
          transcript:transcription_full_text, // Renommé pour correspondre à l'ancien champ
          transcription_error,
          analysis:analysis_result, // Renommé pour correspondre à l'ancien champ
          ai_score,
          ai_result,
          processed_at,
          performance_score,
          error_message:video_error, // Renommé pour correspondre à l'ancien champ
          is_public,
          user_id:owner_id, // Renommé pour correspondre à l'ancien champ
          created_at,
          updated_at,
          transcription_text,
          segments,
          keywords,
          confidence_score,
          transcription_language,
          transcription_status,
          transcription_error:transcription_error, // Assurer la clarté
          transcription_processed_at,
          latest_reaction_type,
          engagement_predictions,
          gamification_level,
          gamification_achievements,
          improvement_suggestion,
          performance_analysis,
          content_insights,
          audience_analysis
        `)
        .eq("owner_id", user.id) // Utiliser owner_id pour filtrer par utilisateur
        .order("created_at", { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Normalisation des statuts pour un affichage cohérent
      const normalizedVideos = (data || []).map(video => {
        // Déterminer le statut réel basé sur les données disponibles
        let normalizedStatus = video.status || "pending";
        let statusLabel = getStatusLabel(normalizedStatus);
        
        // Si la vidéo a une transcription complétée mais pas d'analyse
        if (video.transcript && !video.analysis && (normalizedStatus === "completed" || normalizedStatus === "published" || normalizedStatus === "transcribed")) {
          normalizedStatus = "transcribed";
          statusLabel = "Transcrite";
        }
        
        // Si la vidéo a une analyse
        if (video.analysis && (normalizedStatus === "completed" || normalizedStatus === "published" || normalizedStatus === "analyzed")) {
          normalizedStatus = "analyzed";
          statusLabel = "Analysée";
        }
        
        return {
          ...video,
          id: video.video_id, // Assurer que l'ID est correctement mappé
          normalizedStatus,
          statusLabel,
          // Ajouter des drapeaux pour l'affichage dans la liste
          hasTranscription: !!video.transcript,
          hasAnalysis: !!video.analysis
        };
      });
      
      setVideos(normalizedVideos);
      console.log("Vidéos récupérées:", normalizedVideos.length || 0);
      
      // Mise à jour de la vidéo sélectionnée si nécessaire
      if (selectedVideo) {
        const updatedSelectedVideo = normalizedVideos.find(v => v.id === selectedVideo.id);
        if (updatedSelectedVideo) {
          setSelectedVideo(updatedSelectedVideo);
        }
      }
      
    } catch (error) {
      console.error("Erreur lors du chargement des vidéos:", error);
      setError(`Erreur de chargement: ${error.message}`);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [user, selectedVideo]); // Ajouter selectedVideo aux dépendances
  
  // Fonction utilitaire pour obtenir le label du statut
  const getStatusLabel = (status) => {
    switch (status) {
      case 'uploaded': return 'Uploadée';
      case 'processing': return 'En traitement';
      case 'transcribed': return 'Transcrite';
      case 'analyzing': return 'En analyse';
      case 'analyzed': return 'Analysée';
      case 'published': return 'Publiée';
      case 'failed': return 'Échec';
      case 'draft': return 'Brouillon';
      case 'ready': return 'Prête';
      default: return 'Inconnu';
    }
  };

  // Normaliser les statuts pour l'affichage (utilisé par VideoProcessingStatus)
  const normalizeStatusForDisplay = (status) => {
    if (!status) return 'draft';
    
    const statusLower = status.toLowerCase();
    
    if (['completed', 'analyzed', 'published'].includes(statusLower)) {
      return 'published';
    } else if (['processing', 'transcribing', 'analyzing'].includes(statusLower)) {
      return 'processing';
    } else if (['failed', 'error'].includes(statusLower)) {
      return 'failed';
    } else if (['pending', 'draft', 'ready', 'uploaded'].includes(statusLower)) { // Ajout de 'uploaded'
      return 'draft';
    }
    
    return statusLower;
  };
  
  // CORRECTION: Vérifier si une vidéo a une transcription en utilisant les champs de la vue
  const hasTranscription = (video) => {
    return !!(video.transcript && video.transcript.length > 0); // Utiliser 'transcript'
  };
  
  // CORRECTION: Vérifier si une vidéo a une analyse en utilisant les champs de la vue
  const hasAnalysis = (video) => {
    return !!(video.analysis && Object.keys(video.analysis).length > 0); // Utiliser 'analysis'
  };
  
  useEffect(() => {
    if (!user) return;

    fetchVideos();
    
    // CORRECTION: Configurer l'abonnement aux changements en temps réel sur la table videos
    // (la vue ne supporte pas les changements en temps réel, donc on écoute la table source)
    const channel = supabase
      .channel('videos_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'videos', // Écouter les changements sur la table videos
          filter: `user_id=eq.${user.id}` 
        }, 
        fetchVideos // Recharger les données depuis la vue
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchVideos]); // Ajouter fetchVideos aux dépendances

  // Obtenir l'URL publique d'une vidéo
  const getPublicUrl = (video) => {
    if (!video) return null;
    
    // CORRECTION: Utiliser public_url de la vue en priorité
    if (video.public_url) return video.public_url;
    
    // Utiliser storage_path en priorité, puis file_path
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0];
      
      // Supprimer le préfixe "videos/" si présent
      const cleanPath = path.replace(/^videos\//, '');
      
      return `https://${projectRef}.supabase.co/storage/v1/object/public/videos/${cleanPath}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  };
  
  // Lancer la transcription d'une vidéo
  const transcribeVideo = async (video) => {
    if (!video) return;
    
    try {
      setProcessingVideoId(video.id); // Utiliser le nouvel état
      toast.loading("Démarrage de la transcription...", { id: 'transcribe-toast' });
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      // Utiliser la nouvelle fonction Edge
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            videoId: video.id,
            videoUrl: video.public_url || getPublicUrl(video)
          })
        }
      );
      
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || "Erreur lors de la transcription");
      }
      
      toast.success("Transcription démarrée avec succès", { id: 'transcribe-toast' });
      
      // Actualiser après un délai pour laisser le temps au traitement
      setTimeout(fetchVideos, 3000);
      
    } catch (err) {
      console.error("Erreur lors de la transcription:", err);
      toast.error(`Erreur: ${err.message}`, { id: 'transcribe-toast' });
      
      // Mettre à jour localement le statut
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'failed', error_message: err.message } : v
      ); // Utiliser error_message
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'failed', error_message: err.message });
      }
    } finally {
      setProcessingVideoId(null);
    }
  };

  // CORRECTION: Fonction pour lancer l'analyse IA d'une vidéo
  const analyzeVideo = async (video) => {
    if (!video) return;
    
    try {
      setProcessingVideoId(video.id); // Réutiliser le même état pour l'analyse
      toast.loading("Démarrage de l'analyse IA...", { id: 'analyze-toast' });
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      // Appeler la fonction Edge pour l'analyse
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-transcription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            videoId: video.id
          })
        }
      );
      
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || "Erreur lors de l'analyse");
      }
      
      toast.success("Analyse IA démarrée avec succès", { id: 'analyze-toast' });
      
      // Actualiser après un délai pour laisser le temps au traitement
      setTimeout(fetchVideos, 3000);
      
    } catch (err) {
      console.error("Erreur lors de l'analyse:", err);
      toast.error(`Erreur: ${err.message}`, { id: 'analyze-toast' });
      
      // Mettre à jour localement le statut
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'failed', error_message: err.message } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'failed', error_message: err.message });
      }
    } finally {
      setProcessingVideoId(null);
    }
  };
  
  // Supprimer une vidéo (stockage + base de données)
  const deleteVideo = async (video) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) return;
    
    try {
      // Supprimer le fichier du stockage
      const path = video.storage_path || video.file_path;
      if (path) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([path.replace(/^videos\//, '')]);
        
        if (storageError) throw storageError;
      }
      
      // CORRECTION: Supprimer l'enregistrement en base depuis la table videos (pas la vue)
      const { error: dbError } = await supabase
        .from('videos') // Utiliser la table videos pour la suppression
        .delete()
        .eq('id', video.id);
      
      if (dbError) throw dbError;
      
      toast.success('Vidéo supprimée avec succès');
      fetchVideos();
      
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      toast.error(`Erreur: ${err.message}`);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mes Vidéos</h1>
        <div className="flex space-x-2">
          <button 
            onClick={fetchVideos}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Actualiser
          </button>
          <button 
            onClick={() => window.location.href = '/upload'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Uploader une vidéo
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Mes Vidéos</h2>
        <p className="text-gray-600">{videos.length} vidéo(s) disponible(s)</p>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium mb-2">Aucune vidéo disponible</h3>
          <p className="text-gray-600 mb-4">Commencez par uploader une vidéo pour l'analyser</p>
          <button 
            onClick={() => window.location.href = '/upload'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Uploader une vidéo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Colonne de gauche - Liste des vidéos */}
          <div className="md:col-span-1 bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-medium">Liste des vidéos</h3>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {videos.map((video) => (
                <div 
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    selectedVideo?.id === video.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium truncate max-w-[200px]">
                        {video.title || 'Sans titre'}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {new Date(video.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {hasTranscription(video) && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Transcrit
                          </span>
                        )}
                        {hasAnalysis(video) && (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                            Analysé
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded">
                      <VideoProcessingStatus videoId={video.id} initialStatus={video.status} />
                    </div>
                  </div>
                  {video.status === 'failed' && video.error_message && (
                    <p className="text-xs text-red-500 mt-1 truncate">
                      {video.error_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Colonne de droite - Détails de la vidéo */}
          <div className="md:col-span-2 bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="font-medium">Détails de la vidéo</h3>
            </div>
            
            {selectedVideo ? (
              <div className="p-4">
                <h2 className="text-xl font-bold mb-2">
                  {selectedVideo.title || 'Sans titre'}
                </h2>
                
                {/* Lecteur vidéo */}
                <VideoPlayer video={selectedVideo} />
                
                {/* Métadonnées */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Date d'upload</p>
                    <p>{new Date(selectedVideo.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Statut</p>
                    <div className="font-medium">
                      <VideoProcessingStatus videoId={selectedVideo.id} initialStatus={selectedVideo.status} />
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedVideo.status !== 'processing' && (
                    <>
                      <button 
                        onClick={() => transcribeVideo(selectedVideo)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        disabled={processingVideoId === selectedVideo.id || hasTranscription(selectedVideo)}
                      >
                        {processingVideoId === selectedVideo.id ? 'Transcription en cours...' : 'Transcrire la vidéo'}
                      </button>
                      {hasTranscription(selectedVideo) && !hasAnalysis(selectedVideo) && (
                        <button 
                          onClick={() => analyzeVideo(selectedVideo)}
                          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                          disabled={processingVideoId === selectedVideo.id}
                        >
                          {processingVideoId === selectedVideo.id ? 'Analyse en cours...' : 'Analyser la vidéo'}
                        </button>
                      )}
                    </>
                  )}
                  <button 
                    onClick={() => deleteVideo(selectedVideo)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Supprimer
                  </button>
                </div>
                
                {/* Affichage des résultats */}
                {hasTranscription(selectedVideo) && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Transcription</h3>
                    <TranscriptionViewer transcription={selectedVideo.transcript} />
                  </div>
                )}

                {hasAnalysis(selectedVideo) && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Analyse IA</h3>
                    <VideoAnalysisResults analysis={selectedVideo.analysis} />
                  </div>
                )}

                {!hasTranscription(selectedVideo) && !hasAnalysis(selectedVideo) && selectedVideo.status !== 'failed' && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                    <p>Aucune transcription ou analyse disponible pour cette vidéo. Lancez la transcription ou l'analyse ci-dessus.</p>
                  </div>
                )}

                {selectedVideo.status === 'failed' && selectedVideo.error_message && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <p>Erreur de traitement: {selectedVideo.error_message}</p>
                  </div>
                )}

              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                Sélectionnez une vidéo pour voir les détails.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoManagement;
