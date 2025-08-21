// src/pages/VideoManagement.jsx
import { useState, useEffect } from 'react';
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
  const [transcribingVideoId, setTranscribingVideoId] = useState(null);
  
  const fetchVideos = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Récupération des vidéos pour user_id:", user.id);
      
      // Requête améliorée avec plus d'informations
      const { data, error } = await supabase
        .from("videos")
        .select(`
          *,
          transcriptions (
            id,
            status,
            confidence_score,
            processed_at,
            error_message
          )
        `)
        .eq("user_id", user.id)
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
        if ((video.transcription || (video.transcriptions && video.transcriptions.length > 0)) && 
            !video.analysis && 
            (normalizedStatus === "completed" || normalizedStatus === "published")) {
          normalizedStatus = "transcribed";
          statusLabel = "Transcrite";
        }
        
        // Si la vidéo a une analyse
        if (video.analysis && (normalizedStatus === "completed" || normalizedStatus === "published")) {
          normalizedStatus = "analyzed";
          statusLabel = "Analysée";
        }
        
        return {
          ...video,
          normalizedStatus,
          statusLabel
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
  };
  
  // Normaliser les statuts pour l'affichage
  const normalizeStatus = (status) => {
    if (!status) return 'draft';
    
    const statusLower = status.toLowerCase();
    
    if (['completed', 'analyzed', 'published'].includes(statusLower)) {
      return 'published';
    } else if (['processing', 'transcribing', 'analyzing'].includes(statusLower)) {
      return 'processing';
    } else if (['failed', 'error'].includes(statusLower)) {
      return 'failed';
    } else if (['pending', 'draft', 'ready'].includes(statusLower)) {
      return 'draft';
    }
    
    return statusLower;
  };
  
  // CORRECTION: Vérifier si une vidéo a une transcription en utilisant les champs de la vue
  const hasTranscription = (video) => {
    return !!(video.transcription_text && video.transcription_text.length > 0);
  };
  
  // CORRECTION: Vérifier si une vidéo a une analyse en utilisant les champs de la vue
  const hasAnalysis = (video) => {
    return !!(video.analysis_summary && Object.keys(video.analysis_summary).length > 0);
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
  }, [user]);

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
      setTranscribingVideoId(video.id);
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
        v.id === video.id ? { ...v, status: 'failed', error: err.message } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'failed', error: err.message });
      }
    } finally {
      setTranscribingVideoId(null);
    }
  };

  // CORRECTION: Fonction pour lancer l'analyse IA d'une vidéo
  const analyzeVideo = async (video) => {
    if (!video) return;
    
    try {
      setTranscribingVideoId(video.id); // Réutiliser le même état pour l'analyse
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
        v.id === video.id ? { ...v, status: 'failed', error: err.message } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'failed', error: err.message });
      }
    } finally {
      setTranscribingVideoId(null);
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
                        {video.hasTranscription && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Transcrit
                          </span>
                        )}
                        {video.hasAnalysis && (
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
                        disabled={transcribingVideoId === selectedVideo.id}
                      >
                        {transcribingVideoId === selectedVideo.id 
                          ? 'Transcription en cours...' 
                          : (selectedVideo.hasTranscription ? 'Retranscrire' : 'Transcrire')}
                      </button>
                      
                      {/* CORRECTION: Bouton pour l'analyse IA */}
                      {selectedVideo.hasTranscription && (
                        <button 
                          onClick={() => analyzeVideo(selectedVideo)}
                          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                          disabled={transcribingVideoId === selectedVideo.id}
                        >
                          {transcribingVideoId === selectedVideo.id 
                            ? 'Analyse en cours...' 
                            : (selectedVideo.hasAnalysis ? 'Reanalyser' : 'Analyser avec IA')}
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
                
                {/* Messages d'état */}
                {selectedVideo.status === 'failed' && selectedVideo.error_message && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                    <p className="text-red-700">
                      <strong>Erreur de traitement :</strong> {selectedVideo.error_message}
                    </p>
                  </div>
                )}
                
                {selectedVideo.status === 'processing' && (
                  <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                    <p className="text-yellow-700">
                      La vidéo est en cours de traitement. Les résultats seront disponibles sous peu.
                    </p>
                  </div>
                )}
                
                {selectedVideo.status === 'draft' && !selectedVideo.hasTranscription && (
                  <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <p className="text-blue-700">
                      La vidéo est prête pour la transcription. Cliquez sur "Transcrire" pour commencer.
                    </p>
                  </div>
                )}
                
                {/* CORRECTION: Résultats - Afficher indépendamment du statut si les données existent */}
                {selectedVideo.hasTranscription && (
                  <TranscriptionViewer 
                    transcription={selectedVideo.transcription_text}
                    analysis={selectedVideo.analysis_summary}
                  />
                )}
                
                {selectedVideo.hasAnalysis && (
                  <VideoAnalysisResults 
                    analysis={selectedVideo.analysis_summary}
                    keywords={selectedVideo.analysis_keywords}
                    sentiment={selectedVideo.analysis_sentiment}
                  />
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                Sélectionnez une vidéo dans la liste pour voir ses détails
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoManagement;


// Fonction helper pour transformer le statut en libellé lisible
const getStatusLabel = (status) => {
  // Normaliser le statut pour la comparaison
  const normalizedStatus = status?.toLowerCase();
  
  const statusMap = {
    'pending': 'En attente',
    'uploaded': 'Uploadée',
    'processing': 'En traitement',
    'completed': 'Terminé',
    'transcribed': 'Transcrite',
    'analyzed': 'Analysée',
    'published': 'Publiée',
    'analyzing': 'Analyse en cours',
    'failed': 'Échec'
  };
  
  return statusMap[normalizedStatus] || status || 'Inconnu';
};
