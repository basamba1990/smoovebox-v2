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
      
      // Vérifier que supabase est correctement initialisé
      if (!supabase) {
        throw new Error("Supabase client non initialisé");
      }
      
      // CORRECTION: Utiliser la table videos avec jointure manuelle pour récupérer les données de transcription et d'analyse
      const { data: videosData, error: videosError } = await supabase
        .from("videos")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          updated_at,
          user_id,
          storage_path,
          file_path,
          public_url,
          duration,
          performance_score,
          ai_score,
          analysis,
          error_message
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (videosError) {
        console.error("Erreur Supabase:", videosError);
        throw new Error(`Erreur Supabase: ${videosError.message}`);
      }
      
      console.log("Videos data received:", videosData);
      
      // CORRECTION: Récupérer les transcriptions séparément
      const videoIds = (videosData || []).map(v => v.id);
      let transcriptionsData = [];
      
      if (videoIds.length > 0) {
        const { data: transcriptions, error: transcriptionsError } = await supabase
          .from("transcriptions")
          .select("video_id, full_text, analysis_result")
          .in("video_id", videoIds);
        
        if (transcriptionsError) {
          console.warn("Erreur lors de la récupération des transcriptions:", transcriptionsError);
        } else {
          transcriptionsData = transcriptions || [];
        }
      }
      
      // CORRECTION: Combiner les données manuellement
      const normalizedVideos = (videosData || []).map(video => {
        // Trouver la transcription correspondante
        const transcription = transcriptionsData.find(t => t.video_id === video.id);
        
        const hasTranscription = !!(transcription?.full_text);
        // Utiliser analysis de la table videos ou analysis_result de la transcription
        const analysisData = video.analysis || transcription?.analysis_result || {};
        const hasAnalysis = !!(analysisData && Object.keys(analysisData).length > 0);
        
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
          transcription_text: transcription?.full_text || null,
          analysis_result: analysisData,
          normalizedStatus,
          statusLabel,
          hasTranscription,
          hasAnalysis,
          error_message: video.error_message || null
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
      // Utiliser l'URL de Supabase depuis les variables d'environnement
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error("URL Supabase non configurée");
        return null;
      }
      
      const url = new URL(supabaseUrl);
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
      
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) {
        throw new Error("Erreur d'authentification: " + authError.message);
      }
      
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      const videoUrl = video.public_url || getPublicUrl(video);
      if (!videoUrl) {
        throw new Error("URL de la vidéo non disponible");
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("URL Supabase non configurée");
      }
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/transcribe-video`,
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
          error_message: errorMessage
        } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ 
          ...video, 
          status: 'failed', 
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
      
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) {
        throw new Error("Erreur d'authentification: " + authError.message);
      }
      
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("URL Supabase non configurée");
      }
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/analyze-transcription`,
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
          error_message: errorMessage
        } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ 
          ...video, 
          status: 'failed', 
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
    
    // Configurer l'abonnement aux changements en temps réel
    const setupRealtime = async () => {
      try {
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
          .subscribe((status) => {
            console.log('Subscription status:', status);
          });
        
        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Erreur lors de la configuration du temps réel:", error);
      }
    };
    
    const cleanup = setupRealtime();
    
    return () => {
      if (cleanup && typeof cleanup.then === 'function') {
        cleanup.then(fn => fn && fn());
      }
    };
  }, [user, fetchVideos]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>Veuillez vous connecter pour accéder à vos vidéos.</p>
        </div>
      </div>
    );
  }

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
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Chargement des vidéos...</span>
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
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">Aucune vidéo trouvée.</p>
          <button 
            onClick={() => window.location.href = '/upload'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Uploader votre première vidéo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">{video.title}</h3>
                <p className="text-gray-600 text-sm mb-2">{video.description}</p>
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    video.normalizedStatus === 'analyzed' ? 'bg-green-100 text-green-800' :
                    video.normalizedStatus === 'transcribed' ? 'bg-blue-100 text-blue-800' :
                    video.normalizedStatus === 'processing' || video.normalizedStatus === 'analyzing' ? 'bg-yellow-100 text-yellow-800' :
                    video.normalizedStatus === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {video.statusLabel}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(video.created_at).toLocaleDateString()}
                  </span>
                </div>
                {video.error_message && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded text-xs mb-2">
                    {video.error_message}
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedVideo(video)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Voir détails
                </button>
                
                {!video.hasTranscription && video.normalizedStatus !== 'processing' && (
                  <button
                    onClick={() => transcribeVideo(video)}
                    disabled={processingVideoId === video.id}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {processingVideoId === video.id ? 'En cours...' : 'Transcrire'}
                  </button>
                )}
                
                {video.hasTranscription && !video.hasAnalysis && video.normalizedStatus !== 'analyzing' && (
                  <button
                    onClick={() => analyzeVideo(video)}
                    disabled={processingVideoId === video.id}
                    className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                  >
                    {processingVideoId === video.id ? 'En cours...' : 'Analyser'}
                  </button>
                )}
                
                <button
                  onClick={() => deleteVideo(video)}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">{selectedVideo.title}</h2>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <VideoPlayer video={selectedVideo} />
                  {selectedVideo.hasTranscription && (
                    <div className="mt-4">
                      <TranscriptionViewer 
                        transcription={selectedVideo.transcription_text}
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <VideoProcessingStatus video={selectedVideo} />
                  {selectedVideo.hasAnalysis && (
                    <div className="mt-4">
                      <VideoAnalysisResults 
                        analysis={selectedVideo.analysis_result}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoManagement;

