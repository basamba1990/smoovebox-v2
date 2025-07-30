import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import VideoPlayer from '../components/VideoPlayer';

const VideosPage = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  
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
        if (data && data.length > 0) {
          setSelectedVideo(data[0]);
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
  
  // Fonction pour générer l'URL de la vidéo
  const getVideoUrl = async (video) => {
    if (!video || !video.storage_path) return null;
    
    try {
      // Tente d'abord de générer une URL signée pour les fichiers privés
      const { data, error } = await supabase.storage
        .from(\'videos\')
        .createSignedUrl(video.storage_path, 3600); // URL valide pour 1 heure

      if (data?.signedUrl) {
        return data.signedUrl;
      } else if (error && error.message.includes(\'not found\')) {
        // Si le fichier n\'est pas trouvé avec createSignedUrl, tente getPublicUrl comme fallback
        const { data: publicData } = supabase.storage
          .from(\'videos\')
          .getPublicUrl(video.storage_path);
        return publicData?.publicUrl;
      } else if (error) {
        console.error("Erreur lors de la génération de l\'URL signée:", error);
        return null;
      }
    } catch (err) {
      console.error("Erreur inattendue lors de la génération de l'URL:", err);
      return null;
    }
  };
  
  // Fonction pour traiter une vidéo
  const processVideo = async (video) => {
    try {
      if (!video) return;
      
      toast.loading("Traitement de la vidéo en cours...");
      
      const videoUrl = await getVideoUrl(video);
      if (!videoUrl) {
        toast.error("Impossible de générer l'URL de la vidéo");
        return;
      }
      
      // Appeler l'Edge Function pour traiter la vidéo
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      if (!token) {
        toast.error("Session expirée, veuillez vous reconnecter");
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          videoId: video.id,
          videoUrl: videoUrl
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Erreur lors du traitement de la vidéo");
      }
      
      toast.success("Vidéo traitée avec succès");
      fetchVideos(); // Recharger les vidéos pour afficher les résultats
      
    } catch (err) {
      console.error("Erreur lors du traitement de la vidéo:", err);
      toast.error(`Erreur: ${err.message}`);
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
                      disabled={selectedVideo.status === 'PROCESSING'}
                    >
                      {selectedVideo.status === 'COMPLETED' ? 'Retraiter' : 'Traiter'}
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
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Analyse IA</h3>
                    
                    {selectedVideo.analysis.summary && (
                      <div className="mb-4">
                        <h4 className="font-medium">Résumé</h4>
                        <p className="text-gray-700">{selectedVideo.analysis.summary}</p>
                      </div>
                    )}
                    
                    {selectedVideo.analysis.keywords && selectedVideo.analysis.keywords.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium">Mots-clés</h4>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedVideo.analysis.keywords.map((keyword, index) => (
                            <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {selectedVideo.analysis.suggestions && selectedVideo.analysis.suggestions.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium">Suggestions d'amélioration</h4>
                        <ul className="list-disc pl-5 mt-1">
                          {selectedVideo.analysis.suggestions.map((suggestion, index) => (
                            <li key={index} className="text-gray-700">{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Transcription */}
                {selectedVideo.status === 'COMPLETED' && selectedVideo.transcription && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Transcription</h3>
                    
                    {selectedVideo.transcription.text && (
                      <div className="bg-gray-50 p-4 rounded">
                        <p className="text-gray-700">{selectedVideo.transcription.text}</p>
                      </div>
                    )}
                    
                    {selectedVideo.transcription.segments && selectedVideo.transcription.segments.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Segments</h4>
                        <div className="space-y-2">
                          {selectedVideo.transcription.segments.map((segment, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded">
                              <div className="text-xs text-gray-500 mb-1">
                                {Math.floor(segment.start / 60)}:{(segment.start % 60).toString().padStart(2, '0')} - 
                                {Math.floor(segment.end / 60)}:{(segment.end % 60).toString().padStart(2, '0')}
                              </div>
                              <p>{segment.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">Aucune vidéo sélectionnée</p>
                <p className="text-sm text-gray-400">Sélectionnez une vidéo dans la liste pour voir les détails</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideosPage;




