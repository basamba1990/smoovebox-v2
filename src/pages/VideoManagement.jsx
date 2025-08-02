import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import VideoPlayer from '../components/VideoPlayer';
import VideoAnalysisResults from '../components/VideoAnalysisResults';
import TranscriptionViewer from '../components/TranscriptionViewer';

const VideoManagement = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [transcribingVideoId, setTranscribingVideoId] = useState(null);
  
  // Charger les vidéos de l'utilisateur
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
        throw new Error(`Erreur lors du chargement des vidéos: ${error.message}`);
      }

      // Convertir les statuts si nécessaire (COMPLETED -> published, etc.)
      const convertedData = data.map(video => ({
        ...video,
        status: convertStatus(video.status)
      }));

      setVideos(convertedData || []);
      
      // Mettre à jour la vidéo sélectionnée
      if (convertedData && convertedData.length > 0) {
        if (!selectedVideo || !convertedData.some(v => v.id === selectedVideo.id)) {
          setSelectedVideo(convertedData[0]);
        } else {
          const updatedVideo = convertedData.find(v => v.id === selectedVideo.id);
          if (updatedVideo) setSelectedVideo(updatedVideo);
        }
      } else {
        setSelectedVideo(null);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des vidéos:", err);
      setError(err.message);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Convertir les statuts entre les formats
  const convertStatus = (status) => {
    if (!status) return 'draft';
    
    switch (status.toUpperCase()) {
      case 'COMPLETED': return 'published';
      case 'PROCESSING': return 'processing';
      case 'FAILED': return 'failed';
      case 'PENDING': return 'draft';
      default: return status.toLowerCase();
    }
  };
  
  // Convertir les statuts dans l'autre sens
  const convertStatusToLegacy = (status) => {
    if (!status) return 'PENDING';
    
    switch (status.toLowerCase()) {
      case 'published': return 'COMPLETED';
      case 'processing': return 'PROCESSING';
      case 'failed': return 'FAILED';
      case 'draft': return 'PENDING';
      default: return status.toUpperCase();
    }
  };
  
  useEffect(() => {
    if (!user) return;

    fetchVideos();
    
    // Configurer l'abonnement aux changements en temps réel
    const channel = supabase
      .channel('videos_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'videos',
          filter: `user_id=eq.${user.id}` 
        }, 
        fetchVideos
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Obtenir l'URL publique d'une vidéo
  const getPublicUrl = (video) => {
    if (!video) return null;
    
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
            videoUrl: video.public_url || `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/videos/${video.storage_path || video.file_path}`
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
      
      // Supprimer l'enregistrement en base
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
  
  // Fonctions utilitaires pour l'affichage du statut
  const getStatusText = (status) => {
    switch (status) {
      case 'draft': return 'En attente';
      case 'processing': return 'En traitement';
      case 'published': return 'Terminé';
      case 'failed': return 'Échec';
      default: return status;
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
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
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusColor(video.status)}`}>
                      {getStatusText(video.status)}
                    </span>
                  </div>
                  {video.status === 'failed' && video.error && (
                    <p className="text-xs text-red-500 mt-1 truncate">
                      {video.error}
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
                <VideoPlayer url={getPublicUrl(selectedVideo)} />
                
                {/* Métadonnées */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Date d'upload</p>
                    <p>{new Date(selectedVideo.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Statut</p>
                    <p className={`font-medium ${
                      selectedVideo.status === 'published' ? 'text-green-600' : 
                      selectedVideo.status === 'processing' ? 'text-yellow-600' : 
                      selectedVideo.status === 'failed' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {getStatusText(selectedVideo.status)}
                    </p>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedVideo.status !== 'processing' && (
                    <button 
                      onClick={() => transcribeVideo(selectedVideo)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={transcribingVideoId === selectedVideo.id}
                    >
                      {transcribingVideoId === selectedVideo.id 
                        ? 'Transcription en cours...' 
                        : (selectedVideo.status === 'published' ? 'Retranscrire' : 'Transcrire')}
                    </button>
                  )}
                  <button 
                    onClick={() => deleteVideo(selectedVideo)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
