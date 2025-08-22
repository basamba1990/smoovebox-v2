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
            error_message,
            analysis_result
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        throw error;
      }
      
      const normalizedVideos = (data || []).map(video => {
        let normalizedStatus = video.status || 'pending';
        let statusLabel = getStatusLabel(normalizedStatus, 
          (video.transcriptions && video.transcriptions.length > 0 && video.transcriptions[0].status === 'completed') || (video.transcription && video.transcription.length > 0),
          (video.transcriptions && video.transcriptions.length > 0 && video.transcriptions[0].analysis_result) || (video.analysis && Object.keys(video.analysis).length > 0)
        );
        
        if ((video.transcription || (video.transcriptions && video.transcriptions.length > 0)) && 
            !video.analysis && 
            (normalizedStatus === 'completed' || normalizedStatus === 'published' || normalizedStatus === 'ready')) {
          normalizedStatus = 'transcribed';
          statusLabel = 'Transcrite';
        }
        
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
      const { data: videoData } = await supabase
        .from('videos')
        .select('storage_path, file_path')
        .eq('id', videoId)
        .single();
      
      if (videoData && (videoData.storage_path || videoData.file_path)) {
        const storagePath = videoData.storage_path || videoData.file_path;
        const cleanPath = storagePath.replace(/^videos\//, '');
        
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([cleanPath]);
        
        if (storageError) {
          console.error('Erreur lors de la suppression du fichier:', storageError);
        }
      }
      
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .delete()
        .eq('video_id', videoId);
      
      if (transcriptionError) {
        console.error('Erreur lors de la suppression des transcriptions:', transcriptionError);
      }
      
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);
      
      if (error) {
        console.error('Erreur lors de la suppression de la vidéo:', error);
        return;
      }
      
      setVideos(videos.filter(video => video.id !== videoId));
      setDeleteConfirm(null);
      
      if (selectedVideo && selectedVideo.id === videoId) {
        setSelectedVideo(null);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const startTranscription = async (videoId) => {
    try {
      setTranscribing(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error("Non authentifié");
      }
      
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

  const getStatusLabel = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'Inconnu';
    
    const normalizedStatus = status.toLowerCase();
    
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

  const getStatusBadge = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    const normalizedStatus = status.toLowerCase();
    
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

  const getStatusIcon = (status, hasTranscription = false, hasAnalysis = false) => {
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

  const getVideoUrl = async (video) => {
    if (!video) return null;
    
    if (video.url) return video.url;
    
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      const cleanPath = path.replace(/^videos\//, '');
      
      const { data: signedUrl, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(cleanPath, 3600);
      
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
                <div>
                  <h4 className="text-lg font-semibold mb-1">{video.title || 'Vidéo sans titre'}</h4>
                  <p className="text-sm text-gray-500 mb-2">{formatDate(video.created_at)}</p>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(video.status, hasTranscription, hasAnalysis)}`}>
                      <StatusIcon className="-ml-0.5 mr-1.5 h-3 w-3" />
                      {getStatusLabel(video.status, hasTranscription, hasAnalysis)}
                    </span>
                    {video.duration && (
                      <span className="text-sm text-gray-500">{Math.floor(video.duration / 60)}m {Math.round(video.duration % 60)}s</span>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {(!hasTranscription || !hasAnalysis) && video.status !== 'processing' && video.status !== 'analyzing' && video.status !== 'failed' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); startTranscription(video.id); }}
                      disabled={transcribing}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(video.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {deleteConfirm === video.id && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
                  <p className="text-sm text-red-800">Confirmer la suppression de cette vidéo ?</p>
                  <div className="flex space-x-2">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); deleteVideo(video.id); }}
                    >
                      Oui
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                    >
                      Non
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Tableau de Bord</h1>

      {renderDashboardStats()}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <TabsTrigger value="videos">
            <Video className="h-4 w-4 mr-2" /> Vidéos
          </TabsTrigger>
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" /> Uploader
          </TabsTrigger>
          {selectedVideo && (
            <TabsTrigger value="player">
              <Play className="h-4 w-4 mr-2" /> Lecteur
            </TabsTrigger>
          )}
          {selectedVideo && selectedVideo.transcriptions && selectedVideo.transcriptions.length > 0 && (
            <TabsTrigger value="transcription">
              <FileText className="h-4 w-4 mr-2" /> Transcription
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="videos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Mes Vidéos</CardTitle>
              <CardDescription>Gérez et visualisez vos vidéos uploadées.</CardDescription>
            </CardHeader>
            <CardContent>
              {renderVideoList()}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Uploader une nouvelle vidéo</CardTitle>
              <CardDescription>Sélectionnez un fichier vidéo à uploader.</CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUploader onUploadSuccess={fetchVideos} />
            </CardContent>
          </Card>
        </TabsContent>
        {selectedVideo && (
          <TabsContent value="player" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{selectedVideo.title || 'Lecteur Vidéo'}</CardTitle>
                <CardDescription>Visualisez votre vidéo.</CardDescription>
              </CardHeader>
              <CardContent>
                <VideoPlayer video={selectedVideo} getVideoUrl={getVideoUrl} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
        {selectedVideo && selectedVideo.transcriptions && selectedVideo.transcriptions.length > 0 && (
          <TabsContent value="transcription" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Transcription de {selectedVideo.title || 'la vidéo'}</CardTitle>
                <CardDescription>Lisez et analysez la transcription de votre vidéo.</CardDescription>
              </CardHeader>
              <CardContent>
                <TranscriptionViewer transcription={selectedVideo.transcriptions[0]} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Dashboard;
