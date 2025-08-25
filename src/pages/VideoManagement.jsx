// src/pages/VideoManagement.jsx
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import VideoPlayer from '../components/VideoPlayer';
import VideoAnalysisResults from '../components/VideoAnalysisResults';
import TranscriptionViewer from '../components/TranscriptionViewer';
import VideoProcessingStatus from '../components/VideoProcessingStatus';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Play, Trash2, Lightbulb, Mic, XCircle, Loader2 } from 'lucide-react';

const VideoManagement = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [processingVideoId, setProcessingVideoId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const fetchVideos = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      console.log("Récupération des vidéos pour user_id:", user.id);

      if (!supabase) {
        throw new Error("Supabase client non initialisé");
      }

      const { data, error: supabaseError } = await supabase
        .from("videos")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          updated_at,
          transcription_text,
          transcription_data,
          analysis,
          ai_result,
          error_message,
          transcription_error,
          user_id,
          storage_path,
          file_path,
          public_url,
          duration,
          performance_score,
          ai_score
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        console.error("Erreur Supabase:", supabaseError);
        throw new Error(`Erreur Supabase: ${supabaseError.message}`);
      }

      console.log("Videos data received:", data);

      const normalizedVideos = (data || []).map(video => {
        // Vérifier si transcription_data existe et contient du texte ou des segments
        let hasTranscription = false;
        if (video.transcription_data) {
          try {
            const parsedTranscriptionData = typeof video.transcription_data === 'string' 
              ? JSON.parse(video.transcription_data) 
              : video.transcription_data;
            if (parsedTranscriptionData.text || (parsedTranscriptionData.segments && parsedTranscriptionData.segments.length > 0)) {
              hasTranscription = true;
            }
          } catch (e) {
            console.warn("Erreur lors du parsing de transcription_data:", e);
          }
        } else if (video.transcription_text) {
          hasTranscription = true;
        }
        
        let analysisData = video.analysis || {};
        if ((!analysisData || Object.keys(analysisData).length === 0) && video.ai_result) {
          try {
            analysisData = JSON.parse(video.ai_result);
          } catch (e) {
            console.error("Erreur lors du parsing de ai_result:", e);
            analysisData = { summary: video.ai_result };
          }
        }
        const hasAnalysis = !!(analysisData && Object.keys(analysisData).length > 0);

        let normalizedStatus = video.status || "pending";
        let statusLabel = getStatusLabel(normalizedStatus);

        if (hasTranscription && !hasAnalysis && normalizedStatus !== 'failed') {
          normalizedStatus = "transcribed";
          statusLabel = "Transcrite";
        }
        if (hasAnalysis && normalizedStatus !== 'failed') {
          normalizedStatus = "analyzed";
          statusLabel = "Analysée";
        }

        return {
          ...video,
          normalizedStatus,
          statusLabel,
          hasTranscription,
          hasAnalysis,
          analysis_result: analysisData,
          error_message: video.error_message || video.transcription_error || null
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

  const getPublicUrl = (video) => {
    if (!video) return null;
    if (video.public_url) return video.public_url;
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    try {
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
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'processing' } : v
      );
      setVideos(updatedVideos);
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'processing' });
      }
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
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'analyzing' } : v
      );
      setVideos(updatedVideos);
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'analyzing' });
      }
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
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .delete()
        .eq('video_id', video.id);
      if (transcriptionError) {
        console.warn("Erreur lors de la suppression de la transcription:", transcriptionError);
      }
      const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', video.id);
      if (dbError) throw dbError;
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
          .subscribe();
        return () => {
          supabase.removeChannel(channel);
        };
      } catch (e) {
        console.error("Erreur lors de la configuration de l'abonnement en temps réel:", e);
      }
    };
    setupRealtime();
  }, [user, fetchVideos]);

  const handleTranscriptionUpdate = useCallback((status, errorMessage) => {
    if (selectedVideo && selectedVideo.id) {
      setSelectedVideo(prev => ({
        ...prev,
        status: status,
        error_message: errorMessage || prev.error_message
      }));
      setVideos(prevVideos => prevVideos.map(v => 
        v.id === selectedVideo.id ? { ...v, status: status, error_message: errorMessage || v.error_message } : v
      ));
    }
  }, [selectedVideo]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mes Vidéos</h1>
        <div className="flex space-x-2">
          <Button onClick={fetchVideos} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Actualiser
          </Button>
          <Button onClick={() => window.location.href = '/upload'}>
            Uploader une vidéo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="ml-4 text-lg text-gray-600">Chargement des vidéos...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center">
          <XCircle className="h-5 w-5 mr-2" />
          <p>{error}</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium mb-2">Aucune vidéo disponible</h3>
          <p className="text-gray-600 mb-4">Commencez par uploader une vidéo pour l'analyser</p>
          <Button onClick={() => window.location.href = '/upload'}>
            Uploader une vidéo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-medium">Liste des vidéos ({videos.length})</h3>
            </div>
            <div className="overflow-y-auto max-h-[600px]">
              {videos.map((video) => (
                <div 
                  key={video.id}
                  onClick={() => {
                    setSelectedVideo(video);
                    setIsModalOpen(true);
                  }}
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
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Transcrit
                          </Badge>
                        )}
                        {video.hasAnalysis && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            Analysé
                          </Badge>
                        )}
                        {video.status === 'failed' && (
                          <Badge variant="destructive">
                            Échec
                          </Badge>
                        )}
                      </div>
                    </div>
                    <VideoProcessingStatus videoId={video.id} initialStatus={video.status} />
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
          
          <div className="md:col-span-2 bg-white rounded-lg shadow p-4">
            <div className="p-4 text-center text-gray-500">
              Sélectionnez une vidéo dans la liste pour voir ses détails
            </div>
          </div>
        </div>
      )}

      {selectedVideo && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[800px] lg:max-w-[1000px] h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{selectedVideo.title || 'Détails de la vidéo'}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-y-auto pr-4 -mr-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <VideoPlayer video={selectedVideo} />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-gray-500">Date d'upload</p>
                      <p>{new Date(selectedVideo.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Statut</p>
                      <VideoProcessingStatus videoId={selectedVideo.id} initialStatus={selectedVideo.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {selectedVideo.status !== 'processing' && selectedVideo.status !== 'analyzing' && (
                      <>
                        {!selectedVideo.hasTranscription && selectedVideo.status !== 'failed' && (
                          <Button 
                            onClick={() => transcribeVideo(selectedVideo)}
                            disabled={processingVideoId === selectedVideo.id}
                          >
                            <Mic className="h-4 w-4 mr-2" />
                            {processingVideoId === selectedVideo.id ? 'Transcription en cours...' : 'Transcrire la vidéo'}
                          </Button>
                        )}
                        {selectedVideo.hasTranscription && !selectedVideo.hasAnalysis && selectedVideo.status !== 'failed' && (
                          <Button 
                            onClick={() => analyzeVideo(selectedVideo)}
                            disabled={processingVideoId === selectedVideo.id}
                          >
                            <Lightbulb className="h-4 w-4 mr-2" />
                            {processingVideoId === selectedVideo.id ? 'Analyse en cours...' : 'Analyser la vidéo'}
                          </Button>
                        )}
                        {selectedVideo.status === 'failed' && (
                          <Button 
                            onClick={() => transcribeVideo(selectedVideo)}
                            variant="destructive"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Réessayer la transcription
                          </Button>
                        )}
                      </>
                    )}
                    <Button 
                      onClick={() => deleteVideo(selectedVideo)}
                      variant="outline" className="text-red-500 border-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                    </Button>
                  </div>
                  {(selectedVideo.status === 'pending' || selectedVideo.status === 'uploaded') && !selectedVideo.hasTranscription && (
                    <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                      <p className="text-blue-700">
                        La vidéo est prête pour la transcription. Cliquez sur "Transcrire" pour commencer.
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  {selectedVideo.hasTranscription && (
                    <TranscriptionViewer 
                      video={selectedVideo}
                      onTranscriptionUpdate={handleTranscriptionUpdate}
                    />
                  )}
                  {selectedVideo.hasAnalysis && (
                    <VideoAnalysisResults 
                      analysis={selectedVideo.analysis_result}
                    />
                  )}
                  {!selectedVideo.hasTranscription && !selectedVideo.hasAnalysis && selectedVideo.status !== 'processing' && selectedVideo.status !== 'analyzing' && selectedVideo.status !== 'failed' && (
                    <div className="mt-6 bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                      <p>Aucune transcription ou analyse disponible pour le moment.</p>
                      <p className="text-sm mt-2">Lancez la transcription pour commencer l'analyse.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default VideoManagement;
