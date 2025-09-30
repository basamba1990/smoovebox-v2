import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Upload, FileText, Video, RefreshCw, Trash2, AlertCircle, CheckCircle, Clock, Play, BarChart3, Eye, Download } from 'lucide-react';
import { VIDEO_STATUS, TRANSCRIPTION_STATUS } from '../constants/videoStatus';
import VideoUploader from './VideoUploader';
import TranscriptionViewer from './TranscriptionViewer';
import VideoPlayer from './VideoPlayer';
import VideoAnalysisResults from './VideoAnalysisResults';

const Dashboard = ({ refreshKey = 0, onDataUpdate }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [transcribing, setTranscribing] = useState(false);

  // Recharger les vidéos quand refreshKey change ou utilisateur change
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
      setError(null);

      console.log('📥 Récupération des vidéos pour user:', user.id);
      
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          transcription_data,
          analysis,
          transcript,
          ai_result
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} vidéos trouvées:`, data);
      setVideos(data || []);

    } catch (err) {
      console.error('❌ Erreur fetchVideos:', err);
      setError(`Erreur lors du chargement des vidéos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async (videoId) => {
    if (!videoId) return;

    try {
      setLoading(true);
      
      // Supprimer le fichier de stockage
      const video = videos.find(v => v.id === videoId);
      if (video?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([video.file_path]);
        
        if (storageError) {
          console.warn('⚠️ Impossible de supprimer le fichier storage:', storageError);
        }
      }

      // Supprimer l'enregistrement de la base
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      // Mettre à jour l'état local
      setVideos(prev => prev.filter(video => video.id !== videoId));
      setDeleteConfirm(null);
      
      console.log('✅ Vidéo supprimée:', videoId);
      
    } catch (err) {
      console.error('❌ Erreur deleteVideo:', err);
      setError(`Erreur lors de la suppression: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startTranscription = async (videoId) => {
    try {
      setTranscribing(true);
      
      // Mettre à jour le statut immédiatement
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'processing', transcription_status: 'processing' }
          : video
      ));

      // Appeler l'edge function pour la transcription
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { videoId }
      });

      if (error) throw error;

      console.log('✅ Transcription lancée:', data);
      
      // Recharger les vidéos après un délai
      setTimeout(() => {
        fetchVideos();
      }, 5000);

    } catch (err) {
      console.error('❌ Erreur startTranscription:', err);
      setError(`Erreur transcription: ${err.message}`);
      
      // Revenir au statut précédent en cas d'erreur
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'error', transcription_status: 'error' }
          : video
      ));
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

    const statusMap = {
      'uploaded': 'Téléversée',
      'processing': 'En traitement',
      'processed': 'Traitée',
      'error': 'Erreur',
      'transcribed': 'Transcrite',
      'analyzed': 'Analysée'
    };

    let label = statusMap[status] || status;

    if (hasTranscription) {
      label += ' + Transcription';
    }
    if (hasAnalysis) {
      label += ' + Analyse IA';
    }

    return label;
  };

  const getStatusBadge = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'bg-gray-100 text-gray-800';

    let baseClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ';

    if (hasAnalysis) {
      baseClass += 'bg-green-100 text-green-800';
    } else if (hasTranscription) {
      baseClass += 'bg-blue-100 text-blue-800';
    } else {
      switch (status) {
        case 'uploaded':
          baseClass += 'bg-yellow-100 text-yellow-800';
          break;
        case 'processing':
          baseClass += 'bg-blue-100 text-blue-800';
          break;
        case 'processed':
        case 'transcribed':
        case 'analyzed':
          baseClass += 'bg-green-100 text-green-800';
          break;
        case 'error':
          baseClass += 'bg-red-100 text-red-800';
          break;
        default:
          baseClass += 'bg-gray-100 text-gray-800';
      }
    }

    return baseClass;
  };

  const getStatusIcon = (status, hasTranscription = false, hasAnalysis = false) => {
    let realStatus = status?.toLowerCase();
    if (hasAnalysis) {
      realStatus = 'analyzed';
    } else if (hasTranscription) {
      realStatus = 'transcribed';
    } else if (realStatus === 'processing' || realStatus === 'analyzing') {
      realStatus = 'processing';
    }

    switch (realStatus) {
      case 'uploaded':
        return <Upload className="h-4 w-4" />;
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'processed':
      case 'transcribed':
        return <FileText className="h-4 w-4" />;
      case 'analyzed':
        return <BarChart3 className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  const getVideoUrl = async (video) => {
    if (!video) return null;

    try {
      // Si URL publique disponible
      if (video.public_url) {
        return video.public_url;
      }

      // Sinon générer une URL signée
      if (video.file_path) {
        const { data, error } = await supabase.storage
          .from('videos')
          .createSignedUrl(video.file_path, 3600); // 1 heure

        if (error) throw error;
        return data.signedUrl;
      }

      return null;
    } catch (err) {
      console.error('Erreur getVideoUrl:', err);
      return null;
    }
  };

  const handleVideoAction = async (video, action) => {
    switch (action) {
      case 'view':
        const url = await getVideoUrl(video);
        if (url) {
          window.open(url, '_blank');
        }
        break;
      case 'transcribe':
        await startTranscription(video.id);
        break;
      case 'analyze':
        // Implémenter l'analyse IA
        console.log('Analyse IA pour:', video.id);
        break;
      default:
        break;
    }
  };

  const renderDashboardStats = () => {
    const stats = {
      total: videos.length,
      processed: videos.filter(v => v.status === 'processed' || v.status === 'transcribed' || v.status === 'analyzed').length,
      transcribed: videos.filter(v => v.transcription_data || v.transcript).length,
      analyzed: videos.filter(v => v.analysis || v.ai_result).length
    };

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Vidéos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Video className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Traités</p>
                <p className="text-2xl font-bold">{stats.processed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Transcrits</p>
                <p className="text-2xl font-bold">{stats.transcribed}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Analysés IA</p>
                <p className="text-2xl font-bold">{stats.analyzed}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
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
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-4 w-3/4"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erreur de chargement</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchVideos}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      );
    }

    if (videos.length === 0) {
      return (
        <div className="text-center py-12">
          <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune vidéo</h3>
          <p className="text-gray-600 mb-4">Commencez par uploader votre première vidéo</p>
          <Button onClick={() => setActiveTab('upload')}>
            <Upload className="h-4 w-4 mr-2" />
            Uploader une vidéo
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {videos.map((video) => {
          const hasTranscription = !!(video.transcription_data || video.transcript);
          const hasAnalysis = !!(video.analysis || video.ai_result);
          
          return (
            <Card key={video.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {video.title || 'Sans titre'}
                      <span className={getStatusBadge(video.status, hasTranscription, hasAnalysis)}>
                        {getStatusIcon(video.status, hasTranscription, hasAnalysis)}
                        {getStatusLabel(video.status, hasTranscription, hasAnalysis)}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Créé le {formatDate(video.created_at)}
                      {video.duration && ` • ${Math.round(video.duration / 60)} min`}
                      {video.file_size && ` • ${(video.file_size / (1024 * 1024)).toFixed(1)} MB`}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVideoAction(video, 'view')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(video.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {video.description || 'Aucune description'}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Transcription */}
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Transcription
                    </h4>
                    {hasTranscription ? (
                      <div className="text-sm bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                        {video.transcription_data?.text || video.transcript?.text || 'Transcription disponible'}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        {video.status === 'processing' ? (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Transcription en cours...
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleVideoAction(video, 'transcribe')}
                            disabled={transcribing}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Transcrire
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Analyse IA */}
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analyse IA
                    </h4>
                    {hasAnalysis ? (
                      <div className="text-sm bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                        {video.analysis?.summary || video.ai_result?.insights || 'Analyse disponible'}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        {hasTranscription ? (
                          <Button
                            size="sm"
                            onClick={() => handleVideoAction(video, 'analyze')}
                          >
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Analyser
                          </Button>
                        ) : (
                          'Transcription requise'
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tableau de Bord</h1>
        <Button onClick={fetchVideos} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {renderDashboardStats()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="videos">Mes Vidéos ({videos.length})</TabsTrigger>
          <TabsTrigger value="upload">Uploader une vidéo</TabsTrigger>
        </TabsList>
        
        <TabsContent value="videos" className="space-y-4">
          {renderVideoList()}
        </TabsContent>
        
        <TabsContent value="upload">
          <VideoUploader onUploadComplete={fetchVideos} />
        </TabsContent>
      </Tabs>

      {/* Modal de confirmation de suppression */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirmer la suppression</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Êtes-vous sûr de vouloir supprimer cette vidéo ? Cette action est irréversible.</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => deleteVideo(deleteConfirm)}
                disabled={loading}
              >
                {loading ? 'Suppression...' : 'Supprimer'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
