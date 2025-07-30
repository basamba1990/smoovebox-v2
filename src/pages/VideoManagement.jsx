import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import VideoPlayer from '../components/VideoPlayer';
import VideoAnalysisResults from '../components/VideoAnalysisResults'; // Assurez-vous d'importer ce composant
import TranscriptionViewer from '../components/TranscriptionViewer'; // Assurez-vous d'importer ce composant

const VideosPage = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [processingVideoId, setProcessingVideoId] = useState(null); // Pour suivre la vidéo en cours de traitement
  
  // Fonction pour charger les vidéos
  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setError("Vous devez être connecté pour voir vos vidéos");
        setLoading(false);
        return;
      }
      
      console.log("Chargement des vidéos pour l'utilisateur:", user.id);
      
      // Requête à Supabase pour récupérer les vidéos de l'utilisateur
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
        console.log("Vidéos récupérées:", data);
        setVideos(data || []);
        
        // Si des vidéos sont disponibles, sélectionner la première par défaut
        if (data && data.length > 0 && !selectedVideo) {
          setSelectedVideo(data[0]);
        } else if (selectedVideo) {
          // Mettre à jour la vidéo sélectionnée si elle existe dans la nouvelle liste
          const updatedSelected = data.find(v => v.id === selectedVideo.id);
          if (updatedSelected) {
            setSelectedVideo(updatedSelected);
          } else if (data.length > 0) {
            setSelectedVideo(data[0]); // Si la vidéo sélectionnée a été supprimée, sélectionner la première
          } else {
            setSelectedVideo(null); // Plus de vidéos
          }
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
  
  // Charger les vidéos au chargement du composant et quand l'utilisateur change
  useEffect(() => {
    fetchVideos();
    
    // Configurer un canal de souscription pour les mises à jour en temps réel
    const videosSubscription = supabase
      .channel('videos_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'videos',
          filter: `user_id=eq.${user?.id}` 
        }, 
        (payload) => {
          console.log('Changement détecté:', payload);
          fetchVideos(); // Recharger les vidéos quand il y a un changement
        }
      )
      .subscribe();
    
    // Nettoyer la souscription quand le composant est démonté
    return () => {
      supabase.removeChannel(videosSubscription);
    };
  }, [user]);
  
  // Fonction pour traiter une vidéo
  const processVideo = async (video) => {
    try {
      if (!video) return;
      
      setProcessingVideoId(video.id); // Indiquer que cette vidéo est en cours de traitement
      toast.loading("Traitement de la vidéo en cours...", { id: 'process-video-toast' });
      
      // Appeler l'Edge Function pour traiter la vidéo
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        toast.error("Session expirée, veuillez vous reconnecter", { id: 'process-video-toast' });
        setProcessingVideoId(null);
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-openai-api-key': import.meta.env.VITE_OPENAI_API_KEY // Ajouter la clé OpenAI
        },
        body: JSON.stringify({
          videoId: video.id,
          videoUrl: video.storage_path // Passer le storage_path, l'Edge Function générera l'URL signée
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors du traitement de la vidéo");
      }
      
      toast.success("Vidéo traitée avec succès", { id: 'process-video-toast' });
      fetchVideos(); // Recharger les vidéos pour afficher les résultats
      
    } catch (err) {
      console.error("Erreur lors du traitement de la vidéo:", err);
      toast.error(`Erreur: ${err.message}`, { id: 'process-video-toast' });
    } finally {
      setProcessingVideoId(null);
    }
  };
  
  // Fonction pour obtenir le statut en français
  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING':
        return 'En attente';
      case 'PROCESSING':
        return 'En traitement';
      case 'COMPLETED':
        return 'Terminé';
      case 'FAILED':
        return 'Échec';
      default:
        return status;
    }
  };
  
  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 text-gray-800';
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          <p className="text-gray-600 mb-4">Commencez par uploader une vidéo pour l'analyser avec notre IA</p>
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
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedVideo?.id === video.id ? 'bg-blue-50' : ''}`}
                >
                  <h4 className="font-medium">{video.title || 'Sans titre'}</h4>
                  <p className="text-sm text-gray-500">
                    {new Date(video.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-1">
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(video.status)}`}>
                      {getStatusText(video.status)}
                    </span>
                  </div>
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
                <h2 className="text-xl font-bold mb-2">{selectedVideo.title || 'Sans titre'}</h2>
                
                {/* Lecteur vidéo */}
                <VideoPlayer video={selectedVideo} />
                
                {/* Informations sur la vidéo */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Date d'upload</p>
                    <p>{new Date(selectedVideo.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Statut</p>
                    <p className={`${
                      selectedVideo.status === 'COMPLETED' ? 'text-green-600' : 
                      selectedVideo.status === 'PROCESSING' ? 'text-yellow-600' : 
                      selectedVideo.status === 'FAILED' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {getStatusText(selectedVideo.status)}
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex space-x-2 mb-4">
                  {selectedVideo.status !== 'PROCESSING' && (
                    <button 
                      onClick={() => processVideo(selectedVideo)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      disabled={selectedVideo.status === 'PROCESSING' || processingVideoId === selectedVideo.id}
                    >
                      {processingVideoId === selectedVideo.id ? 'Traitement...' : (selectedVideo.status === 'COMPLETED' ? 'Retraiter' : 'Traiter')}
                    </button>
                  )}
                  <button 
                    onClick={async () => {
                      if (confirm('Êtes-vous sûr de vouloir supprimer cette vidéo ?')) {
                        const { error } = await supabase
                          .from('videos')
                          .delete()
                          .eq('id', selectedVideo.id);
                        
                        if (error) {
                          toast.error(`Erreur: ${error.message}`);
                        } else {
                          toast.success('Vidéo supprimée');
                          fetchVideos();
                        }
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Supprimer
                  </button>
                </div>
                
                {/* Résultats d'analyse */}
                {selectedVideo.status === 'COMPLETED' && selectedVideo.analysis && (
                  <VideoAnalysisResults analysis={selectedVideo.analysis} />
                )}
                
                {/* Transcription */}
                {selectedVideo.status === 'COMPLETED' && selectedVideo.transcription && (
                  <TranscriptionViewer transcription={selectedVideo.transcription} />
                )}

                {selectedVideo.status === 'PROCESSING' && (
                  <div className="mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
                    <p className="text-yellow-800 font-medium">La vidéo est en cours de traitement. Les résultats d'analyse et de transcription seront disponibles une fois le traitement terminé.</p>
                  </div>
                )}

                {selectedVideo.status === 'FAILED' && (
                  <div className="mt-6 bg-red-50 border border-red-200 p-4 rounded-lg text-center">
                    <p className="text-red-800 font-medium">Le traitement de cette vidéo a échoué. Veuillez réessayer ou contacter le support.</p>
                  </div>
                )}

                {selectedVideo.status === 'PENDING' && (
                  <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
                    <p className="text-blue-800 font-medium">La vidéo est en attente de traitement. Cliquez sur "Traiter" pour lancer l'analyse.</p>
                  </div>
                )}

              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                Sélectionnez une vidéo dans la liste pour voir ses détails.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideosPage;
