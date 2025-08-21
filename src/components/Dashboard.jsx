import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { Upload, FileText, Video, RefreshCw, Trash2, AlertCircle, CheckCircle, Clock, Play, BarChart3 } from 'lucide-react';
import { VIDEO_STATUS, TRANSCRIPTION_STATUS } from '../constants/videoStatus.js';
import VideoUploader from './VideoUploader.jsx';
import TranscriptionViewer from './TranscriptionViewer.jsx';
import VideoPlayer from './VideoPlayer.jsx';

const Dashboard = ({ data }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  const fetchVideos = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Récupération des vidéos pour user_id:', user.id);
      
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
      let normalizedStatus = video.status || 'pending';
      let statusLabel = getStatusLabel(normalizedStatus);
      
      // Si la vidéo a une transcription complétée mais pas d'analyse
      if ((video.transcription || (video.transcriptions && video.transcriptions.length > 0)) && 
          !video.analysis && 
          (normalizedStatus === 'completed' || normalizedStatus === 'published')) {
        normalizedStatus = 'transcribed';
        statusLabel = 'Transcrite';
      }
      
      // Si la vidéo a une analyse
      if (video.analysis && (normalizedStatus === 'completed' || normalizedStatus === 'published')) {
        normalizedStatus = 'analyzed';
        statusLabel = 'Analysée';
      }
      
      return {
        ...video,
        normalizedStatus,
        statusLabel
      };
    });
    
    setVideos(normalizedVideos);
    console.log('Vidéos récupérées:', normalizedVideos.length || 0);
    
    // Mise à jour de la vidéo sélectionnée si nécessaire
    if (selectedVideo) {
      const updatedSelectedVideo = normalizedVideos.find(v => v.id === selectedVideo.id);
      if (updatedSelectedVideo) {
        setSelectedVideo(updatedSelectedVideo);
      }
    }
      
    } catch (error) {
      console.error('Erreur lors du chargement des vidéos:', error);
      setError(`Erreur de chargement: ${error.message}`);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async (videoId) => {
    if (!videoId) return;
    
    try {
      // Récupérer d'abord les informations de la vidéo pour le stockage
      const { data: videoData } = await supabase
        .from('videos')
        .select('storage_path, file_path')
        .eq('id', videoId)
        .single();
      
      // Supprimer le fichier du stockage si un chemin est disponible
      if (videoData && (videoData.storage_path || videoData.file_path)) {
        const storagePath = videoData.storage_path || videoData.file_path;
        // Nettoyer le chemin si nécessaire (enlever le préfixe "videos/")
        const cleanPath = storagePath.replace(/^videos\//, '');
        
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([cleanPath]);
        
        if (storageError) {
          console.error('Erreur lors de la suppression du fichier:', storageError);
        }
      }
      
      // Supprimer d'abord les transcriptions associées
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .delete()
        .eq('video_id', videoId);
      
      if (transcriptionError) {
        console.error('Erreur lors de la suppression des transcriptions:', transcriptionError);
      }
      
      // Puis supprimer la vidéo
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);
      
      if (error) {
        console.error('Erreur lors de la suppression de la vidéo:', error);
        return;
      }
      
      // Mettre à jour l'état local
      setVideos(videos.filter(video => video.id !== videoId));
      setDeleteConfirm(null);
      
      // Si la vidéo supprimée était sélectionnée, désélectionner
      if (selectedVideo && selectedVideo.id === videoId) {
        setSelectedVideo(null);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  // Fonction pour démarrer manuellement la transcription
  const startTranscription = async (videoId) => {
    try {
      setTranscribing(true);
      
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error("Non authentifié");
      }
      
      // Construire l'URL de la fonction Edge
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
      const functionUrl = `https://${projectRef}.supabase.co/functions/v1/transcribe-video`;
      
      console.log("Appel de la fonction de transcription:", functionUrl);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ videoId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Réponse d'erreur:", errorData);
        throw new Error(`Erreur: ${errorData.error || errorData.details || response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Réponse de transcription:", data);
      
      alert("Transcription démarrée avec succès! Actualisez dans quelques instants pour voir les résultats.");
      
      // Mettre à jour le statut de la vidéo localement
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === videoId 
            ? { ...video, status: 'processing' } 
            : video
        )
      );
      
      if (selectedVideo && selectedVideo.id === videoId) {
        setSelectedVideo(prev => ({ ...prev, status: 'processing' }));
      }
      
      // Rafraîchir la liste des vidéos après un délai
      setTimeout(() => {
        fetchVideos();
      }, 3000);
      
    } catch (error) {
      alert(`Erreur: ${error.message}`);
      console.error("Erreur de transcription:", error);
    } finally {
      setTranscribing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // CORRECTION: Amélioration du mapping des statuts avec les données de la vue video_details
  const getStatusBadge = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    // Normaliser le statut en majuscules pour la comparaison
    const normalizedStatus = status.toUpperCase();
    
    // Déterminer le statut réel basé sur les données disponibles
    let realStatus = normalizedStatus;
    // CORRECTION: Utiliser analysis_summary pour vérifier l'analyse
    if (hasAnalysis) {
      realStatus = 'ANALYZED';
    } else if (hasTranscription) {
      realStatus = 'TRANSCRIBED';
    } else if (normalizedStatus === 'PROCESSING' || normalizedStatus === 'ANALYZING') {
      realStatus = 'PROCESSING';
    } else if (normalizedStatus === 'UPLOADED' || normalizedStatus === 'PENDING' || normalizedStatus === 'COMPLETED') {
      realStatus = 'UPLOADED';
    }
    
    const statusMap = {
      'UPLOADED': 'bg-blue-100 text-blue-800',
      'PROCESSING': 'bg-yellow-100 text-yellow-800',
      'TRANSCRIBED': 'bg-green-100 text-green-800',
      'ANALYZED': 'bg-purple-100 text-purple-800',
      'FAILED': 'bg-red-100 text-red-800',
    };
    
    return statusMap[realStatus] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'Inconnu';
    
    // Normaliser le statut en majuscules pour la comparaison
    const normalizedStatus = status.toUpperCase();
    
    // Déterminer le statut réel basé sur les données disponibles
    let realStatus = normalizedStatus;
    // CORRECTION: Utiliser analysis_summary pour vérifier l'analyse
    if (hasAnalysis) {
      realStatus = 'ANALYZED';
    } else if (hasTranscription) {
      realStatus = 'TRANSCRIBED';
    } else if (normalizedStatus === 'PROCESSING' || normalizedStatus === 'ANALYZING') {
      realStatus = 'PROCESSING';
    } else if (normalizedStatus === 'UPLOADED' || normalizedStatus === 'PENDING' || normalizedStatus === 'COMPLETED') {
      realStatus = 'UPLOADED';
    }
    
    const statusTextMap = {
      'UPLOADED': 'Uploadé',
      'PROCESSING': 'En cours',
      'TRANSCRIBED': 'Transcrit',
      'ANALYZED': 'Analysé',
      'FAILED': 'Échec',
    };
    
    return statusTextMap[realStatus] || 'Inconnu';
  };

  const getStatusIcon = (status, hasTranscription = false, hasAnalysis = false) => {
    // Déterminer le statut réel basé sur les données disponibles
    let realStatus = status?.toUpperCase();
    // CORRECTION: Utiliser analysis_summary pour vérifier l'analyse
    if (hasAnalysis) {
      realStatus = 'ANALYZED';
    } else if (hasTranscription) {
      realStatus = 'TRANSCRIBED';
    } else if (realStatus === 'PROCESSING' || realStatus === 'ANALYZING') {
      realStatus = 'PROCESSING';
    } else if (realStatus === 'UPLOADED' || realStatus === 'PENDING' || realStatus === 'COMPLETED') {
      realStatus = 'UPLOADED';
    }
    
    const iconMap = {
      'UPLOADED': Upload,
      'PROCESSING': Clock,
      'TRANSCRIBED': FileText,
      'ANALYZED': BarChart3,
      'FAILED': AlertCircle,
    };
    
    return iconMap[realStatus] || Upload;
  };

  // Fonction pour obtenir l'URL publique d'une vidéo
  const getVideoUrl = (video) => {
    if (!video) return null;
    
    // Si la vidéo a déjà une URL publique, l'utiliser
    if (video.public_url) return video.public_url;
    
    // Sinon, construire l'URL à partir du chemin de stockage
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      // Extraire le projectRef de l'URL Supabase
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

  // CORRECTION: Affichage amélioré des statistiques du dashboard
  const renderDashboardStats = () => {
    if (!data) return null;

    const stats = [
      {
        title: 'Total Vidéos',
        value: data.totalVideos || 0,
        icon: Video,
        color: 'text-blue-600'
      },
      {
        title: 'Uploadées',
        value: data.videosByStatus?.uploaded || 0,
        icon: Upload,
        color: 'text-blue-600'
      },
      {
        title: 'En cours',
        value: data.videosByStatus?.processing || 0,
        icon: Clock,
        color: 'text-yellow-600'
      },
      {
        title: 'Transcrites',
        value: data.videosByStatus?.transcribed || 0,
        icon: FileText,
        color: 'text-green-600'
      },
      {
        title: 'Analysées',
        value: data.videosByStatus?.analyzed || 0,
        icon: BarChart3,
        color: 'text-purple-600'
      }
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="p-4">
              <div className="flex items-center space-x-2">
                <IconComponent className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderVideoList = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 p-8 rounded-lg shadow-sm border text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-red-800">Erreur de chargement</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchVideos} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      );
    }

    if (videos.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune vidéo disponible</h3>
          <p className="text-gray-600 mb-4">
            Commencez par uploader une vidéo pour l'analyser avec notre IA
          </p>
          <Button onClick={() => setActiveTab('upload')}>
            Uploader une vidéo
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {videos.map((video) => {
          // CORRECTION: Utiliser les champs de la vue video_details
          const hasTranscription = video.transcription_text && video.transcription_text.length > 0;
          const hasAnalysis = video.analysis_summary && Object.keys(video.analysis_summary).length > 0;
          const StatusIcon = getStatusIcon(video.status, hasTranscription, hasAnalysis);
          
          return (
            <div 
              key={video.id} 
              className={`bg-white p-6 rounded-lg shadow-sm border cursor-pointer transition-all ${
                selectedVideo?.id === video.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedVideo(video)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{video.title || 'Vidéo sans nom'}</h3>
                  <p className="text-sm text-gray-500">{formatDate(video.created_at)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                      getStatusBadge(video.status, hasTranscription, hasAnalysis)
                    }`}>
                      <StatusIcon className="h-3 w-3" />
                      {getStatusText(video.status, hasTranscription, hasAnalysis)}
                    </span>
                    
                    {/* CORRECTION: Afficher le statut de transcription si disponible */}
                    {video.transcription_status && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        getStatusBadge(video.transcription_status)
                      }`}>
                        Transcription: {getStatusText(video.transcription_status)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {deleteConfirm === video.id ? (
                    <>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteVideo(video.id);
                        }}
                        variant="destructive"
                        size="sm"
                      >
                        Confirmer
                      </Button>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(null);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Annuler
                      </Button>
                    </>
                  ) : (
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(video.id);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* CORRECTION: Afficher l'erreur de vidéo si disponible */}
              {video.status === VIDEO_STATUS.FAILED && (
                <div className="mt-3 p-2 bg-red-50 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    {video.error_message || "Une erreur s'est produite lors du traitement de cette vidéo."}
                  </p>
                </div>
              )}
              
              {/* CORRECTION: Afficher l'erreur de transcription si disponible */}
              {video.transcription_status === TRANSCRIPTION_STATUS.FAILED && (
                <div className="mt-3 p-2 bg-red-50 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    {video.transcription_error || "Une erreur s'est produite lors de la transcription."}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderVideoDetails = () => {
    if (!selectedVideo) {
      return (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune vidéo sélectionnée</h3>
          <p className="text-gray-600">
            Sélectionnez une vidéo dans la liste pour voir ses détails
          </p>
        </div>
      );
    }

    const videoUrl = getVideoUrl(selectedVideo);
    // CORRECTION: Utiliser les champs de la vue video_details
    const hasTranscription = selectedVideo.transcription_text && selectedVideo.transcription_text.length > 0;
    const hasAnalysis = selectedVideo.analysis_summary && Object.keys(selectedVideo.analysis_summary).length > 0;
    const canTranscribe = selectedVideo.status === VIDEO_STATUS.COMPLETED && 
                         (!selectedVideo.transcription_status || 
                          selectedVideo.transcription_status === TRANSCRIPTION_STATUS.FAILED);

    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="mb-4">
          <h3 className="text-xl font-semibold">{selectedVideo.title || 'Vidéo sans nom'}</h3>
          <p className="text-sm text-gray-500">{formatDate(selectedVideo.created_at)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              getStatusBadge(selectedVideo.status, hasTranscription, hasAnalysis)
            }`}>
              {getStatusText(selectedVideo.status, hasTranscription, hasAnalysis)}
            </span>
            
            {/* CORRECTION: Afficher le statut de transcription si disponible */}
            {selectedVideo.transcription_status && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                getStatusBadge(selectedVideo.transcription_status)
              }`}>
                Transcription: {getStatusText(selectedVideo.transcription_status)}
              </span>
            )}
          </div>
        </div>

        {videoUrl && (
          <div className="mb-4">
            <VideoPlayer src={videoUrl} />
          </div>
        )}

        <div className="space-y-4">
          {selectedVideo.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-gray-600 text-sm">{selectedVideo.description}</p>
            </div>
          )}

          {canTranscribe && (
            <div className="flex gap-2">
              <Button 
                onClick={() => startTranscription(selectedVideo.id)}
                disabled={transcribing}
                size="sm"
              >
                {transcribing ? 'Transcription en cours...' : 'Démarrer la transcription'}
              </Button>
            </div>
          )}

          {hasTranscription && (
            <div>
              <h4 className="font-medium mb-2">Transcription</h4>
              <TranscriptionViewer 
                transcription={selectedVideo.transcription_text}
                analysis={selectedVideo.analysis_summary} // CORRECTION: Utiliser analysis_summary
              />
            </div>
          )}

          {hasAnalysis && (
            <div>
              <h4 className="font-medium mb-2">Analyse IA</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                  {/* CORRECTION: Utiliser analysis_summary */}
                  {JSON.stringify(selectedVideo.analysis_summary, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Connexion requise</h2>
          <p className="text-gray-600">Veuillez vous connecter pour accéder au dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600">Gérez vos vidéos et analysez vos performances</p>
      </div>

      {/* Affichage des statistiques si des données sont fournies */}
      {data && renderDashboardStats()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="videos">Mes Vidéos</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="analytics">Analyses</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Liste des vidéos</h2>
              {renderVideoList()}
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4">Détails de la vidéo</h2>
              {renderVideoDetails()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Uploader une nouvelle vidéo</CardTitle>
              <CardDescription>
                Ajoutez une vidéo pour l'analyser avec notre IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUploader onUploadComplete={fetchVideos} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analyses et statistiques</CardTitle>
              <CardDescription>
                Consultez les performances de vos vidéos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data && data.videoPerformance && data.videoPerformance.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Analyses détaillées de vos {data.totalVideos} vidéos.
                  </p>
                  {/* Ici on pourrait ajouter des graphiques avec les données de performance */}
                </div>
              ) : (
                <p className="text-gray-600">
                  Les analyses détaillées seront disponibles une fois que vous aurez uploadé et analysé des vidéos.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;


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
