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
      
      // CORRECTION: Récupérer plus de champs pour une meilleure gestion des statuts
      const { data, error } = await supabase
        .from("videos")
        .select(`
          *,
          transcriptions (
            id,
            status,
            confidence_score,
            processed_at,
            error_message,
            analysis_result
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
            (normalizedStatus === 'completed' || normalizedStatus === 'published' || normalizedStatus === 'ready')) {
          normalizedStatus = 'transcribed';
          statusLabel = 'Transcrite';
        }
        
        // Si la vidéo a une analyse
        if (video.analysis && (normalizedStatus === 'completed' || normalizedStatus === 'published' || normalizedStatus === 'ready')) {
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
      
      // CORRECTION: Utiliser la méthode fetch comme dans l'ancien fichier
      const transcribeResponse = await fetch('/functions/v1/transcribe-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ videoId })
      });
      
      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        console.error("Réponse d'erreur:", errorData);
        throw new Error(`Erreur: ${errorData.error || errorData.details || transcribeResponse.statusText}`);
      }
      
      const data = await transcribeResponse.json();
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

  // CORRECTION: Amélioration du mapping des statuts avec les données réelles
  const getStatusBadge = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    // Normaliser le statut en minuscules pour la comparaison
    const normalizedStatus = status.toLowerCase();
    
    // Déterminer le statut réel basé sur les données disponibles
    let realStatus = normalizedStatus;
    if (hasAnalysis) {
      realStatus = 'analyzed';
    } else if (hasTranscription) {
      realStatus = 'transcribed';
    } else if (normalizedStatus === 'processing' || normalizedStatus === 'analyzing') {
      realStatus = 'processing';
    } else if (normalizedStatus === 'ready' || normalizedStatus === 'uploaded' || normalizedStatus === 'pending' || normalizedStatus === 'completed') {
      realStatus = 'ready';
    }
    
    const statusMap = {
      'ready': 'bg-blue-100 text-blue-800',
      'processing': 'bg-yellow-100 text-yellow-800',
      'transcribed': 'bg-green-100 text-green-800',
      'analyzed': 'bg-purple-100 text-purple-800',
      'failed': 'bg-red-100 text-red-800',
    };
    
    return statusMap[realStatus] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'Inconnu';
    
    // Normaliser le statut en minuscules pour la comparaison
    const normalizedStatus = status.toLowerCase();
    
    // Déterminer le statut réel basé sur les données disponibles
    let realStatus = normalizedStatus;
    if (hasAnalysis) {
      realStatus = 'analyzed';
    } else if (hasTranscription) {
      realStatus = 'transcribed';
    } else if (normalizedStatus === 'processing' || normalizedStatus === 'analyzing') {
      realStatus = 'processing';
    } else if (normalizedStatus === 'ready' || normalizedStatus === 'uploaded' || normalizedStatus === 'pending' || normalizedStatus === 'completed') {
      realStatus = 'ready';
    }
    
    const statusTextMap = {
      'ready': 'Prêt',
      'processing': 'En cours',
      'transcribed': 'Transcrit',
      'analyzed': 'Analysé',
      'failed': 'Échec',
    };
    
    return statusTextMap[realStatus] || 'Inconnu';
  };

  const getStatusIcon = (status, hasTranscription = false, hasAnalysis = false) => {
    // Déterminer le statut réel basé sur les données disponibles
    let realStatus = status?.toLowerCase();
    if (hasAnalysis) {
      realStatus = 'analyzed';
    } else if (hasTranscription) {
      realStatus = 'transcribed';
    } else if (realStatus === 'processing' || realStatus === 'analyzing') {
      realStatus = 'processing';
    } else if (realStatus === 'ready' || realStatus === 'uploaded' || realStatus === 'pending' || realStatus === 'completed') {
      realStatus = 'ready';
    }
    
    const iconMap = {
      'ready': CheckCircle,
      'processing': Clock,
      'transcribed': FileText,
      'analyzed': BarChart3,
      'failed': AlertCircle,
    };
    
    return iconMap[realStatus] || CheckCircle;
  };

  // CORRECTION: Fonction pour obtenir l'URL publique d'une vidéo avec URL signée
  const getVideoUrl = async (video) => {
    if (!video) return null;
    
    // Si la vidéo a déjà une URL publique, l'utiliser
    if (video.url) return video.url;
    
    // Sinon, générer une URL signée à partir du chemin de stockage
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      // Nettoyer le chemin si nécessaire (enlever le préfixe "videos/")
      const cleanPath = path.replace(/^videos\//, '');
      
      // CORRECTION: Générer une URL signée au lieu d'une URL publique
      const { data: signedUrl, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(cleanPath, 3600); // URL valide pendant 1 heure
      
      if (error) {
        console.error("Erreur lors de la génération de l'URL signée:", error);
        return null;
      }
      
      return signedUrl?.signedUrl || null;
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
        title: 'Prêtes',
        value: data.videosByStatus?.ready || 0,
        icon: CheckCircle,
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
          // CORRECTION: Vérifier les transcriptions et analyses de manière plus robuste
          const hasTranscription = (video.transcriptions && video.transcriptions.length > 0 && 
                                   video.transcriptions[0].status === 'completed') ||
                                   (video.transcription && video.transcription.length > 0);
          const hasAnalysis = (video.transcriptions && video.transcriptions.length > 0 && 
                              video.transcriptions[0].analysis_result) ||
                              (video.analysis && Object.keys(video.analysis).length > 0);
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
                    
                    {video.transcriptions && video.transcriptions.length > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        getStatusBadge(video.transcriptions[0].status)
                      }`}>
                        Transcription: {getStatusText(video.transcriptions[0].status)}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {deleteConfirm === video.id ? (
                    <>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteVideo(video.id);
                        }}
                      >
                        Confirmer
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(null);
                        }}
                      >
                        Annuler
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(video.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              
              {video.status === 'failed' && (
                <div className="mt-3 p-2 bg-red-50 rounded-md flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium">Erreur de traitement</p>
                    <p>Cette vidéo n'a pas pu être traitée correctement.</p>
                  </div>
                </div>
              )}
              
              {/* CORRECTION: Bouton pour démarrer la transcription si nécessaire */}
              {video.status === 'ready' && !hasTranscription && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTranscription(video.id);
                    }}
                    disabled={transcribing}
                  >
                    {transcribing ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Transcription en cours...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Démarrer la transcription
                      </>
                    )}
                  </Button>
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

    const hasTranscription = (selectedVideo.transcriptions && selectedVideo.transcriptions.length > 0 && 
                             selectedVideo.transcriptions[0].status === 'completed') ||
                             (selectedVideo.transcription && selectedVideo.transcription.length > 0);
    const hasAnalysis = (selectedVideo.transcriptions && selectedVideo.transcriptions.length > 0 && 
                        selectedVideo.transcriptions[0].analysis_result) ||
                        (selectedVideo.analysis && Object.keys(selectedVideo.analysis).length > 0);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              {selectedVideo.title || 'Vidéo sans nom'}
            </CardTitle>
            <CardDescription>
              Uploadée le {formatDate(selectedVideo.created_at)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* CORRECTION: Utiliser VideoPlayer avec URL signée */}
            <VideoPlayer 
              video={selectedVideo} 
              getVideoUrl={getVideoUrl}
            />
            
            {selectedVideo.description && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-gray-600">{selectedVideo.description}</p>
              </div>
            )}
            
            <div className="mt-4 flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                getStatusBadge(selectedVideo.status, hasTranscription, hasAnalysis)
              }`}>
                {getStatusText(selectedVideo.status, hasTranscription, hasAnalysis)}
              </span>
              
              {selectedVideo.file_size && (
                <span className="text-sm text-gray-500">
                  {(selectedVideo.file_size / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transcription */}
        {hasTranscription && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transcription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptionViewer video={selectedVideo} />
            </CardContent>
          </Card>
        )}

        {/* Analyse */}
        {hasAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analyse IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Afficher l'analyse ici */}
              <div className="space-y-4">
                {selectedVideo.analysis && (
                  <div>
                    <h4 className="font-medium mb-2">Résumé de l'analyse</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(selectedVideo.analysis, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                {selectedVideo.transcriptions && selectedVideo.transcriptions[0]?.analysis_result && (
                  <div>
                    <h4 className="font-medium mb-2">Résultat de l'analyse</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm">
                        {JSON.stringify(selectedVideo.transcriptions[0].analysis_result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600">Gérez vos vidéos et analysez vos performances</p>
      </div>

      {renderDashboardStats()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="videos" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Mes Vidéos
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="analyses" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analyses
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Détails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Mes Vidéos ({videos.length})</h2>
            <Button onClick={fetchVideos} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
          {renderVideoList()}
        </TabsContent>

        <TabsContent value="upload">
          <VideoUploader onUploadComplete={fetchVideos} />
        </TabsContent>

        <TabsContent value="analyses">
          <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analyses IA</h3>
            <p className="text-gray-600">
              Les analyses détaillées de vos vidéos apparaîtront ici
            </p>
          </div>
        </TabsContent>

        <TabsContent value="details">
          {renderVideoDetails()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
