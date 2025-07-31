import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import VideoPlayer from '../components/VideoPlayer';
import VideoAnalysisResults from '../components/VideoAnalysisResults';
import TranscriptionViewer from '../components/TranscriptionViewer';

const VideosPage = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [processingVideoId, setProcessingVideoId] = useState(null);
  
  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setError("Vous devez être connecté pour voir vos vidéos");
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Erreur lors du chargement des vidéos:", error);
        setError(`Erreur lors du chargement des vidéos: ${error.message}`);
        setVideos([]);
      } else {
        setVideos(data || []);
        
        // Mettre à jour la vidéo sélectionnée
        if (data && data.length > 0) {
          if (!selectedVideo || !data.some(v => v.id === selectedVideo.id)) {
            setSelectedVideo(data[0]);
          } else {
            // Actualiser les données de la vidéo sélectionnée
            const updatedVideo = data.find(v => v.id === selectedVideo.id);
            if (updatedVideo) setSelectedVideo(updatedVideo);
          }
        } else {
          setSelectedVideo(null);
        }
      }
    } catch (err) {
      console.error("Exception lors du chargement des vidéos:", err);
      setError(`Une erreur inattendue s'est produite: ${err.message}`);
      setVideos([]);
    } finally {
      setLoading(false);
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
          fetchVideos();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getPublicUrl = (path) => {
    if (!path) return null;
    try {
      // Extraire le projectRef de l'URL Supabase
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0];
      return `https://${projectRef}.supabase.co/storage/v1/object/public/videos/${path}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  };
  
  const processVideo = async (video) => {
    if (!video) return;
    
    try {
      setProcessingVideoId(video.id);
      toast.loading("Traitement de la vidéo en cours...", { id: 'process-video-toast' });
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        toast.error("Session expirée, veuillez vous reconnecter", { id: 'process-video-toast' });
        setProcessingVideoId(null);
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          video_id: video.id
        })
      });
      
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || "Erreur lors du traitement de la vidéo");
      }
      
      toast.success("Vidéo traitée avec succès", { id: 'process-video-toast' });
      
      // Actualiser après un court délai pour laisser le temps au traitement
      setTimeout(fetchVideos, 2000);
      
    } catch (err) {
      console.error("Erreur lors du traitement de la vidéo:", err);
      toast.error(`Erreur: ${err.message}`, { id: 'process-video-toast' });
      
      // Mettre à jour le statut en échec dans l'interface
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'FAILED', error: err.message } : v
      );
      setVideos(updatedVideos);
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...video, status: 'FAILED', error: err.message });
      }
    } finally {
      setProcessingVideoId(null);
    }
  };
  
  const deleteVideo = async (video) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) return;
    
    try {
      // 1. Supprimer le fichier du stockage
      const { error: storageError } = await supabase.storage
        .from('videos')
        .remove([video.path]);
      
      if (storageError) throw storageError;
      
      // 2. Supprimer l'enregistrement de la base de données
      const { error: dbError } = await supabase
        .from('videos')
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
  
  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING': return 'En attente';
      case 'PROCESSING': return 'En traitement';
      case 'COMPLETED': return 'Terminé';
      case 'FAILED': return 'Échec';
      default: return status;
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      case 'PROCESSING': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(video.status)}`}>
                      {getStatusText(video.status)}
                    </span>
                  </div>
                  {video.status === 'FAILED' && (
                    <p className="text-xs text-red-500 mt-1 truncate">
                      {video.error || 'Erreur inconnue'}
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
                
                <VideoPlayer url={getPublicUrl(selectedVideo.path)} />
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Date d'upload</p>
                    <p>{new Date(selectedVideo.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Statut</p>
                    <p className={`
                      ${selectedVideo.status === 'COMPLETED' ? 'text-green-600' : 
                        selectedVideo.status === 'PROCESSING' ? 'text-yellow-600' : 
                        selectedVideo.status === 'FAILED' ? 'text-red-600' :
                        'text-gray-600'} font-medium`
                      }>
                      {getStatusText(selectedVideo.status)}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedVideo.status !== 'PROCESSING' && (
                    <button 
                      onClick={() => processVideo(selectedVideo)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={processingVideoId === selectedVideo.id}
                    >
                      {processingVideoId === selectedVideo.id 
                        ? 'Traitement en cours...' 
                        : (selectedVideo.status === 'COMPLETED' ? 'Retraiter' : 'Traiter')}
                    </button>
                  )}
                  <button 
                    onClick={() => deleteVideo(selectedVideo)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Supprimer
                  </button>
                </div>
                
                {selectedVideo.status === 'FAILED' && selectedVideo.error && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                    <p className="text-red-700">
                      <strong>Erreur de traitement :</strong> {selectedVideo.error}
                    </p>
                  </div>
                )}
                
                {selectedVideo.status === 'COMPLETED' && selectedVideo.analysis && (
                  <VideoAnalysisResults analysis={selectedVideo.analysis} />
                )}
                
                {selectedVideo.status === 'COMPLETED' && selectedVideo.transcription && (
                  <TranscriptionViewer transcription={selectedVideo.transcription} />
                )}

                {selectedVideo.status === 'PROCESSING' && (
                  <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                    <p className="text-yellow-700">
                      La vidéo est en cours de traitement. Les résultats seront disponibles sous peu.
                    </p>
                  </div>
                )}

                {selectedVideo.status === 'PENDING' && (
                  <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <p className="text-blue-700">
                      La vidéo est prête pour le traitement. Cliquez sur "Traiter" pour commencer l'analyse.
                    </p>
                  </div>
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

export default VideosPage;
