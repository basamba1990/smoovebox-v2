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

const Dashboard = ({ refreshKey = 0, onVideoUploaded }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedVideoForAnalysis, setSelectedVideoForAnalysis] = useState(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState(null);

  // ✅ CORRECTION : Rechargement amélioré avec dépendances complètes
  useEffect(() => {
    console.log('🔄 Dashboard: refreshKey changé, rechargement des vidéos...', refreshKey);
    if (user) {
      fetchVideos();
    }
  }, [user, refreshKey, onVideoUploaded]);

  // ✅ CORRECTION : Fonction fetchVideos optimisée
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
          ai_result,
          transcription_text
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} vidéos trouvées`);
      setVideos(data || []);

    } catch (err) {
      console.error('❌ Erreur fetchVideos:', err);
      setError(`Erreur lors du chargement des vidéos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CORRECTION CRITIQUE : Fonction getVideoUrl améliorée avec gestion robuste
  const getVideoUrl = async (video) => {
    if (!video) return null;

    try {
      // ✅ PRIORITÉ 1: URL publique directe
      if (video.public_url) {
        console.log('✅ Utilisation URL publique:', video.public_url);
        return video.public_url;
      }

      // ✅ PRIORITÉ 2: storage_path (NON NULL) avant file_path
      const path = video.storage_path || video.file_path;
      
      if (!path) {
        console.error('❌ Aucun chemin de stockage disponible pour la vidéo:', video.id);
        return null;
      }

      console.log('📁 Génération URL signée pour:', path);
      
      // ✅ Vérification que le bucket existe
      const { data: bucketData, error: bucketError } = await supabase.storage
        .from('videos')
        .list('', { limit: 1 });
      
      if (bucketError) {
        console.error('❌ Erreur accès bucket:', bucketError);
        throw new Error(`Bucket inaccessible: ${bucketError.message}`);
      }

      // ✅ Génération URL signée
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(path, 3600); // 1 heure

      if (error) {
        console.error('❌ Erreur génération URL signée:', error);
        throw error;
      }
      
      console.log('✅ URL signée générée');
      return data.signedUrl;

    } catch (err) {
      console.error('❌ Erreur getVideoUrl:', err);
      
      // ✅ Fallback: essayer de régénérer l'URL publique
      if (video.storage_path) {
        const { data: fallbackUrl } = supabase.storage
          .from('videos')
          .getPublicUrl(video.storage_path);
        console.log('🔄 Fallback URL publique');
        return fallbackUrl.publicUrl;
      }
      
      return null;
    }
  };

  // ✅ CORRECTION : Fonction playVideo améliorée
  const playVideo = async (video) => {
    try {
      console.log('🎬 Tentative de lecture vidéo:', video.id);
      console.log('📊 Données vidéo:', {
        id: video.id,
        file_path: video.file_path,
        storage_path: video.storage_path,
        public_url: video.public_url
      });
      
      const url = await getVideoUrl(video);
      
      if (url) {
        console.log('✅ URL vidéo obtenue');
        setVideoPlayerUrl(url);
        setSelectedVideo(video);
      } else {
        console.error('❌ Impossible d\'obtenir l\'URL de la vidéo');
        setError('Impossible de charger la vidéo. Vérifiez que le fichier existe dans le stockage.');
      }
    } catch (err) {
      console.error('❌ Erreur playVideo:', err);
      setError(`Erreur lors du chargement de la vidéo: ${err.message}`);
    }
  };

  const deleteVideo = async (videoId) => {
    if (!videoId) return;

    try {
      setLoading(true);
      
      const video = videos.find(v => v.id === videoId);
      if (video?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([video.file_path]);
        
        if (storageError) {
          console.warn('⚠️ Impossible de supprimer le fichier storage:', storageError);
        }
      }

      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

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
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'processing', transcription_status: 'processing' }
          : video
      ));

      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { videoId }
      });

      if (error) throw error;

      console.log('✅ Transcription lancée:', data);
      
      setTimeout(() => {
        fetchVideos();
      }, 5000);

    } catch (err) {
      console.error('❌ Erreur startTranscription:', err);
      setError(`Erreur transcription: ${err.message}`);
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'error', transcription_status: 'error' }
          : video
      ));
    } finally {
      setTranscribing(false);
    }
  };

  // ✅ CORRECTION : Fonction startAnalysis avec gestion robuste
  const startAnalysis = async (videoId, transcriptionText, userId) => {
    try {
      setAnalyzing(true);
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'analyzing' }
          : video
      ));

      console.log('🟡 Début analyse IA pour video:', videoId);
      console.log('📝 Texte de transcription:', transcriptionText?.length, 'caractères');

      if (!transcriptionText?.trim()) {
        throw new Error('Texte de transcription manquant ou vide');
      }

      const { data, error } = await supabase.functions.invoke('analyze-transcription', {
        body: { 
          videoId: videoId,
          transcriptionText: transcriptionText,
          userId: userId
        }
      });

      if (error) {
        console.error('❌ Erreur fonction Edge:', error);
        throw new Error(`Erreur fonction Edge: ${error.message}`);
      }

      console.log('✅ Analyse IA lancée:', data);
      
      setTimeout(() => {
        fetchVideos();
      }, 5000);

    } catch (err) {
      console.error('❌ Erreur startAnalysis:', err);
      setError(`Erreur analyse IA: ${err.message}`);
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'error' }
          : video
      ));
    } finally {
      setAnalyzing(false);
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
      'analyzing': 'Analyse en cours',
      'analyzed': 'Analysée'
    };

    let label = statusMap[status] || status;

    if (hasTranscription && status !== 'transcribed' && status !== 'analyzed') {
      label += ' + Transcription';
    }
    if (hasAnalysis && status !== 'analyzed') {
      label += ' + Analyse IA';
    }

    return label;
  };

  const getStatusBadge = (status, hasTranscription = false, hasAnalysis = false) => {
    if (!status) return 'bg-gray-3 text-gray-11';

    let baseClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ';

    if (hasAnalysis) {
      baseClass += 'bg-green-3 text-green-11';
    } else if (hasTranscription) {
      baseClass += 'bg-blue-3 text-blue-11';
    } else {
      switch (status) {
        case 'uploaded':
          baseClass += 'bg-yellow-3 text-yellow-11';
          break;
        case 'processing':
        case 'analyzing':
          baseClass += 'bg-blue-3 text-blue-11';
          break;
        case 'processed':
        case 'transcribed':
        case 'analyzed':
          baseClass += 'bg-green-3 text-green-11';
          break;
        case 'error':
          baseClass += 'bg-red-3 text-red-11';
          break;
        default:
          baseClass += 'bg-gray-3 text-gray-11';
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

  // ✅ CORRECTION : handleVideoAction avec gestion d'erreur améliorée
  const handleVideoAction = async (video, action) => {
    try {
      switch (action) {
        case 'play':
          await playVideo(video);
          break;
        case 'view':
          const url = await getVideoUrl(video);
          if (url) {
            window.open(url, '_blank');
          } else {
            setError('Impossible d\'ouvrir la vidéo. URL non disponible.');
          }
          break;
        case 'transcribe':
          await startTranscription(video.id);
          break;
        case 'analyze':
          const transcriptionText = video.transcription_text || 
                                  video.transcription_data?.text || 
                                  video.transcript?.text || '';
          
          if (!transcriptionText.trim()) {
            setError('Aucune transcription disponible pour l\'analyse. Transcrivez d\'abord la vidéo.');
            return;
          }
          
          await startAnalysis(video.id, transcriptionText, user.id);
          break;
        case 'view-analysis':
          setSelectedVideoForAnalysis(video);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`❌ Erreur action ${action}:`, err);
      setError(`Erreur lors de l'action ${action}: ${err.message}`);
    }
  };

  const renderDashboardStats = () => {
    const stats = {
      total: videos.length,
      processed: videos.filter(v => v.status === 'processed' || v.status === 'transcribed' || v.status === 'analyzed').length,
      transcribed: videos.filter(v => v.transcription_data || v.transcript || v.transcription_text).length,
      analyzed: videos.filter(v => v.analysis || v.ai_result).length
    };

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-10">Total Vidéos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Video className="h-8 w-8 text-blue-7" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-10">Traités</p>
                <p className="text-2xl font-bold">{stats.processed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-7" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-10">Transcrits</p>
                <p className="text-2xl font-bold">{stats.transcribed}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-7" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-10">Analysés IA</p>
                <p className="text-2xl font-bold">{stats.analyzed}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-7" />
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
                <div className="h-4 bg-gray-4 rounded mb-4 w-3/4"></div>
                <div className="h-20 bg-gray-4 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-7 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-11 mb-2">Erreur de chargement</h3>
          <p className="text-gray-10 mb-4">{error}</p>
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
          <Video className="h-16 w-16 text-gray-7 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-11 mb-2">Aucune vidéo</h3>
          <p className="text-gray-10 mb-4">Commencez par uploader votre première vidéo</p>
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
          const hasTranscription = !!(video.transcription_data || video.transcript || video.transcription_text);
          const hasAnalysis = !!(video.analysis || video.ai_result);
          const transcriptionText = video.transcription_text || video.transcription_data?.text || video.transcript?.text || '';
          
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
                      variant="default"
                      size="sm"
                      onClick={() => handleVideoAction(video, 'play')}
                      className="bg-blue-11 hover:bg-blue-12"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Lire
                    </Button>
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
                <p className="text-sm text-gray-10 mb-4">
                  {video.description || 'Aucune description'}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Transcription
                    </h4>
                    {hasTranscription ? (
                      <div className="text-sm bg-gray-2 rounded p-3 max-h-32 overflow-y-auto">
                        {transcriptionText.substring(0, 200)}...
                      </div>
                    ) : (
                      <div className="text-sm text-gray-9">
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
                            {transcribing ? 'Traitement...' : 'Transcrire'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analyse IA
                    </h4>
                    {hasAnalysis ? (
                      <div className="space-y-2">
                        <div className="text-sm bg-gray-2 rounded p-3 max-h-24 overflow-y-auto">
                          {video.analysis?.summary || video.ai_result?.insights || 'Analyse disponible'}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVideoAction(video, 'view-analysis')}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Voir détail
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleVideoAction(video, 'analyze')}
                            disabled={analyzing || !hasTranscription}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {analyzing ? 'Analyse...' : 'Ré-analyser'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-9">
                        {hasTranscription ? (
                          <Button
                            size="sm"
                            onClick={() => handleVideoAction(video, 'analyze')}
                            disabled={analyzing}
                          >
                            <BarChart3 className="h-4 w-4 mr-1" />
                            {analyzing ? 'Analyse en cours...' : 'Analyser'}
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
          <VideoUploader onUploadComplete={() => {
            fetchVideos();
            if (onVideoUploaded) onVideoUploaded();
          }} />
        </TabsContent>
      </Tabs>

      {selectedVideo && videoPlayerUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Lecture : {selectedVideo.title || 'Sans titre'}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedVideo(null);
                  setVideoPlayerUrl(null);
                }}
              >
                Fermer
              </Button>
            </div>
            <div className="p-4">
              <video 
                controls 
                autoPlay 
                className="w-full h-auto max-h-[70vh]"
                src={videoPlayerUrl}
              >
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            </div>
          </div>
        </div>
      )}

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

      {selectedVideoForAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Analyse IA détaillée - {selectedVideoForAnalysis.title || 'Sans titre'}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedVideoForAnalysis(null)}
              >
                Fermer
              </Button>
            </div>
            <div className="p-4">
              <VideoAnalysisResults video={selectedVideoForAnalysis} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
