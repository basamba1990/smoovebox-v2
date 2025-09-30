import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Upload, FileText, Video, RefreshCw, Trash2, AlertCircle, CheckCircle, Clock, Play, BarChart3 } from 'lucide-react';
import { VIDEO_STATUS, TRANSCRIPTION_STATUS } from '../constants/videoStatus';
import VideoUploader from './VideoUploader';
import TranscriptionViewer from './TranscriptionViewer';
import VideoPlayer from './VideoPlayer';
import VideoAnalysisResults from './VideoAnalysisResults';

const Dashboard = ({ data, refreshKey = 0 }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [transcribing, setTranscribing] = useState(false);

  // NOUVEAU : Effet pour recharger les vidéos quand refreshKey change
  useEffect(() => {
    console.log('🔄 Dashboard: refreshKey changé, rechargement des vidéos...', refreshKey);
    if (user) {
      fetchVideos();
    }
  }, [user, refreshKey]);

  const fetchVideos = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('📹 Chargement des vidéos pour user:', user.id);
      
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          transcriptions (
            id,
            video_id,
            status,
            transcription_text,
            full_text,
            segments,
            analysis_result,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur récupération vidéos:', error);
        setError(error.message);
      } else {
        console.log('✅ Vidéos chargées:', data?.length || 0, 'vidéo(s)');
        
        // Normaliser les données pour s'assurer que nous avons les bonnes propriétés
        const normalizedVideos = data.map(video => {
          // Utiliser transcription_data OU transcription_text pour détecter les transcriptions
          const hasTranscription = !!(video.transcription_text || video.transcription_data);
          
          // Utiliser analysis_result s'il est disponible, sinon analysis
          let analysisData = video.analysis_result || video.analysis || {};
          
          // Si analysis_result est vide mais ai_result existe, essayer de le parser
          if ((!analysisData || Object.keys(analysisData).length === 0) && video.ai_result) {
            try {
              analysisData = JSON.parse(video.ai_result);
            } catch (e) {
              analysisData = { summary: video.ai_result };
            }
          }
          
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
            normalizedStatus,
            statusLabel,
            hasTranscription,
            hasAnalysis,
            analysis_result: analysisData
          };
        });
        
        setVideos(normalizedVideos);
      }
    } catch (error) {
      console.error('❌ Erreur générale récupération vidéos:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async (videoId) => {
    if (!videoId) return;
    
    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);
      
      if (error) {
        setError(error.message);
      } else {
        // Mettre à jour la liste des vidéos
        setVideos(videos.filter(video => video.id !== videoId));
        if (selectedVideo && selectedVideo.id === videoId) {
          setSelectedVideo(null);
        }
        toast.success('Vidéo supprimée avec succès');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const startTranscription = async (videoId) => {
    try {
      setTranscribing(true);
      
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ videoId })
        }
      );
      
      if (!response.ok) {
        throw new Error('Erreur lors de la transcription');
      }
      
      // Mettre à jour le statut de la vidéo
      setVideos(videos.map(video => 
        video.id === videoId ? { ...video, status: 'processing' } : video
      ));
      
      toast.success('Transcription démarrée avec succès');
      
    } catch (error) {
      setError(error.message);
      toast.error('Erreur lors du démarrage de la transcription');
    } finally {
      setTranscribing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Date invalide';
    }
  };

  const getStatusLabel = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'Inconnu';
    
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
    
    if (hasTranscription && !hasAnalysis) return 'Transcrite';
    if (hasAnalysis) return 'Analysée';
    
    return statusMap[status] || status;
  };

  const getStatusBadge = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    if (hasAnalysis) return 'bg-purple-100 text-purple-800';
    if (hasTranscription) return 'bg-green-100 text-green-800';
    
    const statusMap = {
      'uploaded': 'bg-blue-100 text-blue-800',
      'processing': 'bg-yellow-100 text-yellow-800',
      'transcribed': 'bg-green-100 text-green-800',
      'analyzing': 'bg-indigo-100 text-indigo-800',
      'analyzed': 'bg-purple-100 text-purple-800',
      'published': 'bg-teal-100 text-teal-800',
      'failed': 'bg-red-100 text-red-800',
      'draft': 'bg-gray-100 text-gray-800',
      'ready': 'bg-green-100 text-green-800',
      'pending': 'bg-gray-100 text-gray-800'
    };
    
    return statusMap[status] || 'bg-gray-100 text-gray-800';
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
      'uploaded': <Clock className="h-4 w-4" />,
      'processing': <RefreshCw className="h-4 w-4 animate-spin" />,
      'transcribed': <FileText className="h-4 w-4" />,
      'analyzing': <RefreshCw className="h-4 w-4 animate-spin" />,
      'analyzed': <BarChart3 className="h-4 w-4" />,
      'published': <CheckCircle className="h-4 w-4" />,
      'failed': <AlertCircle className="h-4 w-4" />,
      'draft': <Clock className="h-4 w-4" />,
      'ready': <CheckCircle className="h-4 w-4" />,
      'pending': <Clock className="h-4 w-4" />
    };
    
    return iconMap[realStatus] || <AlertCircle className="h-4 w-4" />;
  };

  const getVideoUrl = async (video) => {
    if (!video) return null;
    
    if (video.public_url) return video.public_url;
    
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      const { data } = supabase.storage
        .from('videos')
        .getPublicUrl(path);
      
      return data.publicUrl;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'URL:', error);
      return null;
    }
  };

  const renderDashboardStats = () => {
    if (!data) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total des vidéos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalVideos || videos.length}</div>
            <p className="text-xs text-muted-foreground">
              {videos.filter(v => v.hasAnalysis).length} analysée(s)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vidéos transcrites</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{videos.filter(v => v.hasTranscription).length}</div>
            <p className="text-xs text-muted-foreground">
              {videos.filter(v => v.hasTranscription && !v.hasAnalysis).length} en attente d'analyse
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vidéos analysées</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{videos.filter(v => v.hasAnalysis).length}</div>
            <p className="text-xs text-muted-foreground">
              Dernière: {videos[0] ? formatDate(videos[0].created_at) : 'Aucune'}
            </p>
          </CardContent>
        </Card>
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
    
    if (videos.length === 0) {
      return (
        <div className="text-center py-12">
          <Video className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune vidéo</h3>
          <p className="mt-1 text-sm text-gray-500">Commencez par enregistrer votre première vidéo.</p>
          <div className="mt-6">
            <Button onClick={() => window.location.href = '/record-video'}>
              <Upload className="h-4 w-4 mr-2" />
              Enregistrer une vidéo
            </Button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 gap-4">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden">
            <CardHeader className="bg-gray-50 py-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{video.title || 'Sans titre'}</CardTitle>
                  <CardDescription>
                    Uploadé le {formatDate(video.created_at)}
                    {video.duration && ` • Durée: ${Math.round(video.duration)} secondes`}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(video.normalizedStatus, video.hasTranscription, video.hasAnalysis)}`}>
                    {getStatusIcon(video.normalizedStatus, video.hasTranscription, video.hasAnalysis)}
                    <span className="ml-1">{video.statusLabel}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedVideo(selectedVideo?.id === video.id ? null : video)}
                  >
                    {selectedVideo?.id === video.id ? 'Masquer' : 'Détails'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {selectedVideo?.id === video.id && (
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="mb-4">
                    <VideoPlayer video={video} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-medium mb-2">Informations</h4>
                      <p><strong>Statut:</strong> {video.statusLabel}</p>
                      <p><strong>Date d'upload:</strong> {formatDate(video.created_at)}</p>
                      {video.duration && <p><strong>Durée:</strong> {Math.round(video.duration)} secondes</p>}
                      {video.file_size && <p><strong>Taille:</strong> {Math.round(video.file_size / 1024 / 1024)} Mo</p>}
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Actions</h4>
                      <div className="flex space-x-2">
                        {!video.hasTranscription && (
                          <Button
                            size="sm"
                            onClick={() => startTranscription(video.id)}
                            disabled={transcribing}
                          >
                            {transcribing ? 'Transcription...' : 'Transcrire'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteVideo(video.id)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {video.hasTranscription && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Transcription</h4>
                      <TranscriptionViewer video={video} />
                    </div>
                  )}
                  
                  {video.hasAnalysis && (
                    <div>
                      <h4 className="font-medium mb-2">Analyse</h4>
                      <VideoAnalysisResults video={video} />
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Tableau de Bord</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="videos">Mes Vidéos ({videos.length})</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="progress">Progression</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          {renderDashboardStats()}
          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>Vos vidéos les plus récentes</CardDescription>
            </CardHeader>
            <CardContent>
              {renderVideoList()}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="videos">
          <Card>
            <CardHeader>
              <CardTitle>Mes Vidéos</CardTitle>
              <CardDescription>Gérez toutes vos vidéos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <p>{videos.length} vidéo(s) disponible(s)</p>
                <Button onClick={fetchVideos} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
              </div>
              {renderVideoList()}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Uploader une vidéo</CardTitle>
              <CardDescription>Ajoutez une nouvelle vidéo à analyser</CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUploader onUploadComplete={fetchVideos} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Mes progrès</CardTitle>
              <CardDescription>Suivez votre progression</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800">Vidéos complétées</h4>
                    <p className="text-2xl font-bold text-blue-600">{videos.filter(v => v.hasAnalysis).length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800">En cours</h4>
                    <p className="text-2xl font-bold text-green-600">{videos.filter(v => !v.hasAnalysis).length}</p>
                  </div>
                </div>
                
                {videos.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Dernières activités</h4>
                    <div className="space-y-2">
                      {videos.slice(0, 3).map(video => (
                        <div key={video.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-sm">{video.title || 'Sans titre'}</span>
                          <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(video.normalizedStatus)}`}>
                            {video.statusLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
