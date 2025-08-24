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
  const [processingVideoId, setProcessingVideoId] = useState(null);
  
  const fetchVideos = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Récupération des vidéos pour user_id:", user.id);
      
      const { data, error } = await supabase
        .from("video_details")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          updated_at,
          transcription_text,
          analysis,
          video_error,
          transcription_error,
          user_id,
          storage_path,
          file_path,
          public_url,
          duration,
          performance_score,
          ai_score,
          ai_result
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Erreur Supabase:", error);
        throw error;
      }
      
      console.log("Videos data received:", data);
      
      const normalizedVideos = (data || []).map(video => {
        const hasTranscription = !!(video.transcription_text);
        const hasAnalysis = !!(video.analysis && Object.keys(video.analysis).length > 0);
        
        let normalizedStatus = video.status || "pending";
        let statusLabel = getStatusLabel(normalizedStatus);
        
        if (hasTranscription && !hasAnalysis) {
          normalizedStatus = "transcribed";
          statusLabel = "Transcrite";
        }
        
        if (hasAnalysis) {
          normalizedStatus = "analyzed";
          statusLabel = "Analysée";
        }
        
        return {
          ...video,
          normalizedStatus,
          statusLabel,
          hasTranscription,
          hasAnalysis,
          error_message: video.video_error || video.transcription_error || null
        };
      });
      
      setVideos(normalizedVideos);
      
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
  }, [user, selectedVideo]);
  
  const getStatusLabel = (status) => {
    const statusMap = {
      'uploaded': 'Uploadée',
      'processing': 'En traitement',
      'transcribed': 'Transcrite',
      'analyzing': 'En analyse',
      'analyzed': 'Analysée',
      'published': 'Publiée',
      'failed': 'Échec',
      'draft': 'Brouillon',
      'ready': 'Prête',
      'pending': 'En attente'
    };
    
    return statusMap[status] || 'Inconnu';
  };

  const getPublicUrl = (video) => {
    if (!video) return null;
    
    if (video.public_url) return video.public_url;
    
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0];
      
      const cleanPath = path.replace(/^videos\//, '');
      
      return `https://${projectRef}.supabase.co/storage/v1/object/public/videos/${cleanPath}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  };
  
  const transcribeVideo = async (video) => {
    if (!video) return;
    
    try {
      setProcessingVideoId(video.id);
      toast.loading("Démarrage de la transcription...", { id: 'transcribe-toast' });
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      const videoUrl = video.public_url || getPublicUrl(video);
      if (!videoUrl) {
        throw new Error("URL de la vidéo non disponible");
      }
      
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
            videoUrl: videoUrl
          })
        }
      );
      
      if (!response.ok) {
        let errorMessage = "Erreur lors de la transcription";
        try {
          const errorResult = await response.json();
          errorMessage = errorResult.error || errorMessage;
        } catch (e) {
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      toast.success("Transcription démarrée avec succès", { id: 'transcribe-toast' });
      
      // Mise à jour optimiste de l'interface
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'processing' } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'processing' });
      }
      
      // Rechargement après un délai
      setTimeout(fetchVideos, 5000);
      
    } catch (err) {
      console.error("Erreur lors de la transcription:", err);
      let errorMessage = err.message;
      
      if (errorMessage.includes('Échec de confirmation de la mise à jour')) {
        errorMessage = "Problème de connexion à la base de données. Veuillez réessayer.";
      }
      
      toast.error(`Erreur: ${errorMessage}`, { id: 'transcribe-toast' });
      
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { 
          ...v, 
          status: 'failed', 
          video_error: errorMessage,
          error_message: errorMessage
        } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ 
          ...video, 
          status: 'failed', 
          video_error: errorMessage,
          error_message: errorMessage
        });
      }
    } finally {
      setProcessingVideoId(null);
    }
  };

  const analyzeVideo = async (video) => {
    if (!video) return;
    
    try {
      setProcessingVideoId(video.id);
      toast.loading("Démarrage de l'analyse IA...", { id: 'analyze-toast' });
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
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
        let errorMessage = "Erreur lors de l'analyse";
        try {
          const errorResult = await response.json();
          errorMessage = errorResult.error || errorMessage;
        } catch (e) {
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      toast.success("Analyse IA démarrée avec succès", { id: 'analyze-toast' });
      
      // Mise à jour optimiste de l'interface
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'analyzing' } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'analyzing' });
      }
      
      // Rechargement après un délai
      setTimeout(fetchVideos, 5000);
      
    } catch (err) {
      console.error("Erreur lors de l'analyse:", err);
      let errorMessage = err.message;
      
      if (errorMessage.includes('Échec de confirmation de la mise à jour')) {
        errorMessage = "Problème de connexion à la base de données. Veuillez réessayer.";
      }
      
      toast.error(`Erreur: ${errorMessage}`, { id: 'analyze-toast' });
      
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { 
          ...v, 
          status: 'failed', 
          video_error: errorMessage,
          error_message: errorMessage
        } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ 
          ...video, 
          status: 'failed', 
          video_error: errorMessage,
          error_message: errorMessage
        });
      }
    } finally {
      setProcessingVideoId(null);
    }
  };
  
  const deleteVideo = async (video) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) return;
    
    try {
      // Supprimer d'abord les enregistrements liés
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .delete()
        .eq('video_id', video.id);
      
      if (transcriptionError) {
        console.warn("Erreur lors de la suppression de la transcription:", transcriptionError);
      }
      
      // Supprimer la vidéo elle-même
      const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', video.id);
      
      if (dbError) throw dbError;
      
      // Supprimer le fichier de stockage s'il existe
      const path = video.storage_path || video.file_path;
      if (path) {
        try {
          const cleanPath = path.replace(/^videos\//, '');
          const { error: storageError } = await supabase.storage
            .from('videos')
            .remove([cleanPath]);
          
          if (storageError) {
            console.warn("Erreur lors de la suppression du fichier:", storageError);
          }
        } catch (storageErr) {
          console.warn("Erreur lors de la suppression du fichier:", storageErr);
        }
      }
      
      toast.success('Vidéo supprimée avec succès');
      
      // Mettre à jour l'état local
      setVideos(prev => prev.filter(v => v.id !== video.id));
      if (selectedVideo?.id === video.id) {
        setSelectedVideo(null);
      }
      
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      toast.error(`Erreur: ${err.message}`);
    }
  };
  
  useEffect(() => {
    if (!user) return;

    fetchVideos();
    
    const channel = supabase
      .channel('videos_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'videos',
          filter: `user_id=eq.${user.id}` 
        }, 
        (payload) => {
          console.log('Change received!', payload);
          fetchVideos();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchVideos]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mes Vidéos</h1>
        <div className="flex space-x-2">
          <button 
            onClick={fetchVideos}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            disabled={loading}
          >
            {loading ? 'Chargement...' : 'Actualiser'}
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
          <button 
            onClick={fetchVideos}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Réessayer
          </button>
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
                  {video.status === 'failed' && video.video_error && (
                    <p className="text-xs text-red-500 mt-1 truncate">
                      {video.video_error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="md:col-span-2 bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="font-medium">Détails de la vidéo</h3>
            </div>
            
            {selectedVideo ? (
              <div className="p-4">
                <h2 className="text-xl font-bold mb-2">
                  {selectedVideo.title || 'Sans titre'}
                </h2>
                
                <VideoPlayer video={selectedVideo} />
                
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
                  {selectedVideo.duration && (
                    <div>
                      <p className="text-sm text-gray-500">Durée</p>
                      <p>{Math.round(selectedVideo.duration)} secondes</p>
                    </div>
                  )}
                  {selectedVideo.performance_score && (
                    <div>
                      <p className="text-sm text-gray-500">Score de performance</p>
                      <p>{selectedVideo.performance_score.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedVideo.status !== 'processing' && selectedVideo.status !== 'analyzing' && (
                    <>
                      <button 
                        onClick={() => transcribeVideo(selectedVideo)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        disabled={processingVideoId === selectedVideo.id || selectedVideo.hasTranscription}
                      >
                        {processingVideoId === selectedVideo.id ? 'Transcription en cours...' : 'Transcrire la vidéo'}
                      </button>
                      {selectedVideo.hasTranscription && !selectedVideo.hasAnalysis && (
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
                
                {selectedVideo.hasTranscription && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Transcription</h3>
                    <TranscriptionViewer transcription={selectedVideo.transcription_text} />
                  </div>
                )}

                {selectedVideo.hasAnalysis && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Analyse IA</h3>
                    <VideoAnalysisResults analysis={selectedVideo.analysis} />
                  </div>
                )}

                {!selectedVideo.hasTranscription && !selectedVideo.hasAnalysis && selectedVideo.status !== 'failed' && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                    <p>Aucune transcription ou analyse disponible pour cette vidéo. Lancez la transcription ou l'analyse ci-dessus.</p>
                  </div>
                )}

                {selectedVideo.status === 'failed' && selectedVideo.video_error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <p>Erreur de traitement: {selectedVideo.video_error}</p>
                    <button 
                      onClick={() => {
                        if (selectedVideo.hasTranscription) {
                          analyzeVideo(selectedVideo);
                        } else {
                          transcribeVideo(selectedVideo);
                        }
                      }}
                      className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Réessayer
                    </button>
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
