import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button-enhanced.jsx';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const Dashboard = ({ 
  data, 
  loading, 
  error, 
  refreshKey, 
  onVideoUploaded = () => {} 
}) => {
  const { user } = useAuth();
  const [recentVideos, setRecentVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState(null);

  // Charger les vidéos récentes
  const loadRecentVideos = async () => {
    try {
      setVideosLoading(true);
      
      if (!user) {
        console.log('❌ Aucun utilisateur connecté');
        return;
      }

      console.log('📥 Chargement vidéos pour user:', user.id);
      
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (videosError) {
        console.error('❌ Erreur chargement vidéos:', videosError);
        throw videosError;
      }

      console.log(`✅ ${videos?.length || 0} vidéos chargées`);
      setRecentVideos(videos || []);
    } catch (err) {
      console.error('❌ Erreur loadRecentVideos:', err);
      toast.error('Erreur lors du chargement des vidéos');
    } finally {
      setVideosLoading(false);
    }
  };

  useEffect(() => {
    loadRecentVideos();
  }, [user, refreshKey]);

  // Fonction pour obtenir l'URL de la vidéo
  const getVideoUrl = async (video) => {
    if (!video) return null;

    try {
      // Priorité 1: URL publique directe
      if (video.video_url) {
        console.log('🔗 Utilisation video_url:', video.video_url);
        return video.video_url;
      }

      // Priorité 2: URL publique depuis storage
      if (video.storage_path) {
        const { data } = supabase.storage.from('videos').getPublicUrl(video.storage_path);
        if (data.publicUrl) {
          console.log('🔗 URL publique générée:', data.publicUrl);
          return data.publicUrl;
        }
      }

      // Priorité 3: URL signée
      if (video.storage_path) {
        console.log('🔑 Génération URL signée pour:', video.storage_path);
        const { data, error } = await supabase.storage
          .from('videos')
          .createSignedUrl(video.storage_path, 3600); // 1 heure

        if (error) {
          console.error('❌ Erreur URL signée:', error);
          throw error;
        }
        
        console.log('✅ URL signée générée');
        return data.signedUrl;
      }

      console.warn('⚠️ Aucune URL disponible pour la vidéo:', video.id);
      return null;
    } catch (err) {
      console.error('❌ Erreur getVideoUrl:', err);
      return null;
    }
  };

  // Fonction pour lire la vidéo
  const playVideo = async (video) => {
    try {
      console.log('🎬 Lecture vidéo demandée:', video.id);
      const url = await getVideoUrl(video);
      
      if (url) {
        console.log('✅ URL obtenue, ouverture lecteur');
        setVideoPlayerUrl(url);
        setSelectedVideo(video);
      } else {
        console.error('❌ Impossible d\'obtenir l\'URL');
        toast.error('Impossible de charger la vidéo pour la lecture');
      }
    } catch (err) {
      console.error('❌ Erreur playVideo:', err);
      toast.error(`Erreur lors du chargement: ${err.message}`);
    }
  };

  // Formater la durée
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Obtenir le statut de la vidéo
  const getVideoStatus = (video) => {
    if (video.status === 'failed') return { text: 'Échec', color: 'bg-red-100 text-red-800' };
    if (video.status === 'processing' || video.status === 'analyzing') return { text: 'Traitement', color: 'bg-yellow-100 text-yellow-800' };
    if (video.status === 'analyzed' || video.status === 'published') return { text: 'Terminée', color: 'bg-green-100 text-green-800' };
    return { text: 'Uploadée', color: 'bg-blue-100 text-blue-800' };
  };

  if (loading || videosLoading) {
    return (
      <div className="card-spotbulle p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-france-600"></div>
          <span className="ml-3 text-gray-600">Chargement de vos vidéos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-spotbulle p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-red-600 text-lg mr-2">⚠️</div>
            <div>
              <h3 className="font-semibold text-red-800">Erreur de chargement</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
          <Button 
            onClick={loadRecentVideos}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-spotbulle p-4 text-center">
          <div className="text-2xl font-bold text-france-600">{data?.totalVideos || 0}</div>
          <div className="text-gray-600 text-sm">Vidéos totales</div>
        </div>
        
        <div className="card-spotbulle p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{data?.videosByStatus?.analyzed || 0}</div>
          <div className="text-gray-600 text-sm">Analysées</div>
        </div>
        
        <div className="card-spotbulle p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{data?.transcriptionsCount || 0}</div>
          <div className="text-gray-600 text-sm">Transcrites</div>
        </div>
        
        <div className="card-spotbulle p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {data?.totalDuration ? formatDuration(data.totalDuration) : '0:00'}
          </div>
          <div className="text-gray-600 text-sm">Durée totale</div>
        </div>
      </div>

      {/* Vidéos Récentes */}
      <div className="card-spotbulle p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-french font-bold text-gray-900">
            🎥 Vos Vidéos Récentes
          </h2>
          <Link to="/record-video">
            <Button className="btn-spotbulle">
              + Nouvelle Vidéo
            </Button>
          </Link>
        </div>

        {recentVideos.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-6xl mb-4">🎥</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Aucune vidéo pour le moment
            </h3>
            <p className="text-gray-500 mb-4">
              Commencez par enregistrer votre première vidéo pour partager vos passions
            </p>
            <Link to="/record-video">
              <Button className="btn-spotbulle">
                🎤 Créer ma première vidéo
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentVideos.map((video) => {
              const status = getVideoStatus(video);
              
              return (
                <div key={video.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Lecteur Vidéo avec bouton play */}
                  <div className="aspect-video bg-black relative group cursor-pointer" onClick={() => playVideo(video)}>
                    {/* Overlay de lecture */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white/90 rounded-full p-4 transform scale-0 group-hover:scale-100 transition-transform">
                        <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                    
                    {/* Image de preview ou placeholder */}
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="text-4xl mb-2">📹</div>
                        <p className="text-sm">Cliquer pour lire</p>
                      </div>
                    </div>
                    
                    {/* Badge de statut */}
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.text}
                      </span>
                    </div>
                    
                    {/* Durée */}
                    {video.duration && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>

                  {/* Informations de la vidéo */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 truncate">
                      {video.title || `Vidéo du ${new Date(video.created_at).toLocaleDateString()}`}
                    </h3>
                    
                    <div className="flex justify-between items-center text-sm text-gray-600 mb-3">
                      <span>{new Date(video.created_at).toLocaleDateString()}</span>
                      
                      {/* Score IA */}
                      {video.ai_score && (
                        <span className="font-medium text-france-600">
                          Score: {(video.ai_score * 10).toFixed(1)}/10
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {video.tags && video.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {video.tags.slice(0, 3).map((tag, index) => (
                          <span 
                            key={index} 
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                        {video.tags.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            +{video.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={() => playVideo(video)}
                        className="flex-1 bg-france-500 hover:bg-france-600 text-white"
                        size="sm"
                      >
                        ▶️ Lire
                      </Button>
                      
                      <Link 
                        to={video.analysis_result ? `/video-analysis/${video.id}` : '#'}
                        className={`flex-1 text-center py-2 px-3 rounded text-sm ${
                          video.analysis_result 
                            ? 'bg-gray-500 hover:bg-gray-600 text-white' 
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        📊 Analyse
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Voir toutes les vidéos */}
        {recentVideos.length > 0 && (
          <div className="mt-6 text-center">
            <Link to="/record-video">
              <Button variant="outline" className="border-france-300 text-france-700 hover:bg-france-50">
                Voir toutes mes vidéos
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Progression de l'analyse */}
      {(data?.videosByStatus?.processing > 0 || data?.videosByStatus?.analyzing > 0) && (
        <div className="card-spotbulle p-6 bg-blue-50 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            🔄 Traitement en cours
          </h3>
          <div className="space-y-3">
            {data.videosByStatus.processing > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Vidéos en cours de traitement</span>
                <span className="font-semibold">{data.videosByStatus.processing}</span>
              </div>
            )}
            {data.videosByStatus.analyzing > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-blue-700">Analyses IA en cours</span>
                <span className="font-semibold">{data.videosByStatus.analyzing}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de lecture vidéo */}
      {selectedVideo && videoPlayerUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                🎬 {selectedVideo.title || 'Lecture vidéo'}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedVideo(null);
                  setVideoPlayerUrl(null);
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                ✕ Fermer
              </Button>
            </div>
            
            <div className="p-4 bg-black">
              <video 
                controls 
                autoPlay 
                className="w-full h-auto max-h-[70vh] rounded-lg"
                src={videoPlayerUrl}
                onError={(e) => {
                  console.error('❌ Erreur lecture vidéo:', e);
                  toast.error('Erreur de lecture vidéo');
                }}
              >
                Votre navigateur ne supporte pas la lecture vidéo.
                <source src={videoPlayerUrl} type="video/mp4" />
                <source src={videoPlayerUrl} type="video/webm" />
              </video>
            </div>

            <div className="p-4 border-t">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>Durée: {selectedVideo.duration ? formatDuration(selectedVideo.duration) : 'Inconnue'}</span>
                <span>Créée le: {new Date(selectedVideo.created_at).toLocaleDateString()}</span>
              </div>
              
              {selectedVideo.transcription_text && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                  <p className="text-sm text-gray-700">
                    <strong>Transcription:</strong> {selectedVideo.transcription_text.substring(0, 200)}...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
