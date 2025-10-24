import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Upload, FileText, Video, RefreshCw, Trash2, AlertCircle, 
  CheckCircle, Clock, Play, BarChart3, Eye, Download, 
  Search, Filter, X, Sparkles, Volume2
} from 'lucide-react';
import VideoUploader from './VideoUploader';
import VideoAnalysisResults from './VideoAnalysisResults';

// ✅ Composant de filtrage amélioré
const VideoFilter = ({ videos, onFilterChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  const allTags = useMemo(() => {
    const tags = new Set();
    videos.forEach(video => {
      if (video.tags && Array.isArray(video.tags)) {
        video.tags.forEach(tag => {
          if (tag && typeof tag === 'string') {
            tags.add(tag.toLowerCase().trim());
          }
        });
      }
      if (video.title) {
        video.title.split(' ').forEach(word => {
          if (word.length > 2) tags.add(word.toLowerCase());
        });
      }
    });
    return Array.from(tags).sort();
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const matchesSearch = !searchTerm || 
        video.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        video.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        video.transcription_text?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTags = selectedTags.length === 0 || 
        (video.tags && selectedTags.some(tag => 
          video.tags.map(t => t.toLowerCase().trim()).includes(tag)
        ));

      const matchesStatus = statusFilter === 'all' || 
        video.status === statusFilter || 
        (statusFilter === 'transcribed' && (video.transcription_data || video.transcript || video.transcription_text)) || 
        (statusFilter === 'analyzed' && (video.analysis || video.ai_result));

      return matchesSearch && matchesTags && matchesStatus;
    });
  }, [videos, searchTerm, selectedTags, statusFilter]);

  useEffect(() => {
    onFilterChange(filteredVideos);
  }, [filteredVideos, onFilterChange]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setStatusFilter('all');
  };

  const hasActiveFilters = searchTerm || selectedTags.length > 0 || statusFilter !== 'all';

  return (
    <div className="space-y-4 mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
        {/* Barre de recherche */}
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            🔍 Rechercher dans les vidéos
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input 
              type="text" 
              placeholder="Titre, description, transcription..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filtre par statut */}
        <div className="w-full lg:w-48">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            📊 Statut
          </label>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="uploaded">Uploadées</option>
            <option value="processing">En traitement</option>
            <option value="transcribed">Transcrites</option>
            <option value="analyzed">Analysées</option>
          </select>
        </div>

        {/* Bouton de réinitialisation */}
        {hasActiveFilters && (
          <Button 
            onClick={clearFilters} 
            variant="outline" 
            size="sm"
            className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
          >
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
        )}
      </div>

      {/* Filtre par tags */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          🏷️ Mots-clés
        </label>
        <div className="flex flex-wrap gap-2">
          {allTags.slice(0, 20).map(tag => (
            <button
              key={tag}
              onClick={() => {
                setSelectedTags(prev => 
                  prev.includes(tag) 
                    ? prev.filter(t => t !== tag)
                    : [...prev, tag]
                );
              }}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tag}
              {selectedTags.includes(tag) && (
                <span className="ml-1">✓</span>
              )}
            </button>
          ))}
          {allTags.length > 20 && (
            <span className="text-gray-400 text-sm px-2 py-1">
              +{allTags.length - 20} autres...
            </span>
          )}
        </div>
      </div>

      {/* Tags sélectionnés et statistiques */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-700">
        <div className="flex flex-wrap gap-2">
          {selectedTags.length > 0 && (
            <>
              <span className="text-sm text-gray-300">Filtres actifs :</span>
              {selectedTags.map(tag => (
                <span 
                  key={tag} 
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-full"
                >
                  {tag}
                  <button 
                    onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                    className="hover:text-red-300 text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
            </>
          )}
        </div>

        <div className="text-sm text-gray-400">
          {filteredVideos.length} vidéo(s) sur {videos.length}
          {hasActiveFilters && (
            <span className="ml-2 text-blue-400">
              (filtré)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ✅ COMPOSANT PRINCIPAL CORRIGÉ
const Dashboard = ({ refreshKey = 0, onVideoUploaded, userProfile }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedVideoForAnalysis, setSelectedVideoForAnalysis] = useState(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState(null);

  // ✅ Rechargement amélioré
  useEffect(() => {
    console.log('🔄 Dashboard: refreshKey changé, rechargement des vidéos...', refreshKey);
    if (user) {
      fetchVideos();
    }
  }, [user, refreshKey, onVideoUploaded]);

  useEffect(() => {
    setFilteredVideos(videos);
  }, [videos]);

  // ✅ Fonction fetchVideos optimisée
  const fetchVideos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

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
        throw error;
      }

      setVideos(data || []);

    } catch (err) {
      console.error('❌ Erreur fetchVideos:', err);
      setError(`Erreur lors du chargement des vidéos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fonction getVideoUrl améliorée
  const getVideoUrl = async (video) => {
    if (!video) return null;

    try {
      // ✅ PRIORITÉ 1: URL publique directe
      if (video.public_url) {
        return video.public_url;
      }

      // ✅ PRIORITÉ 2: storage_path
      const path = video.storage_path || video.file_path;
      if (!path) {
        console.error('❌ Aucun chemin de stockage disponible pour la vidéo:', video.id);
        return null;
      }

      // ✅ Génération URL signée
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(path, 3600);

      if (error) {
        throw error;
      }

      return data.signedUrl;

    } catch (err) {
      console.error('❌ Erreur getVideoUrl:', err);
      
      // ✅ Fallback
      if (video.storage_path) {
        const { data: fallbackUrl } = supabase.storage
          .from('videos')
          .getPublicUrl(video.storage_path);
        return fallbackUrl.publicUrl;
      }
      
      return null;
    }
  };

  // ✅ Fonction playVideo améliorée
  const playVideo = async (video) => {
    try {
      const url = await getVideoUrl(video);
      if (url) {
        setVideoPlayerUrl(url);
        setSelectedVideo(video);
      } else {
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

    } catch (err) {
      console.error('❌ Erreur deleteVideo:', err);
      setError(`Erreur lors de la suppression: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CORRECTION : Fonction startTranscription
  const startTranscription = async (videoId) => {
    try {
      setTranscribing(true);
      
      const video = videos.find(v => v.id === videoId);
      if (!video) {
        throw new Error('Vidéo non trouvée');
      }

      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'processing', transcription_status: 'processing' }
          : video
      ));

      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { 
          videoId: videoId,
          userId: user.id,
          videoUrl: video.public_url || video.storage_path
        }
      });

      if (error) {
        throw new Error(`Erreur lors de la transcription: ${error.message}`);
      }

      // ✅ RE-CHARGEMENT OPTIMISÉ
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

  // ✅ CORRECTION : Fonction startAnalysis
  const startAnalysis = async (videoId, transcriptionText, userId) => {
    try {
      setAnalyzing(true);
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'analyzing' }
          : video
      ));

      if (!transcriptionText?.trim()) {
        throw new Error('Texte de transcription manquant ou vide pour l\'analyse');
      }

      if (transcriptionText.trim().length < 10) {
        throw new Error('Texte de transcription trop court (minimum 10 caractères)');
      }

      const { data, error } = await supabase.functions.invoke('analyze-transcription', {
        body: { 
          videoId: videoId,
          transcriptionText: transcriptionText.trim(),
          userId: userId
        }
      });

      if (error) {
        throw new Error(`Erreur lors de l'analyse: ${error.message}`);
      }

      // ✅ RE-CHARGEMENT OPTIMISÉ
      setTimeout(() => {
        fetchVideos();
      }, 3000);

    } catch (err) {
      console.error('❌ Erreur startAnalysis:', err);
      
      let errorMessage = `Erreur analyse IA: ${err.message}`;
      
      if (err.message.includes('transcription manquant')) {
        errorMessage = 'Erreur: Aucun texte de transcription disponible. Veuillez d\'abord transcrire la vidéo.';
      } else if (err.message.includes('trop court')) {
        errorMessage = 'Erreur: Le texte de transcription est trop court pour l\'analyse.';
      }
      
      setError(errorMessage);
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'transcribed' }
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
    if (!status) return 'bg-gray-500 text-white';

    let baseClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ';

    if (hasAnalysis) {
      baseClass += 'bg-green-500 text-white';
    } else if (hasTranscription) {
      baseClass += 'bg-blue-500 text-white';
    } else {
      switch (status) {
        case 'uploaded':
          baseClass += 'bg-yellow-500 text-white';
          break;
        case 'processing':
        case 'analyzing':
          baseClass += 'bg-blue-500 text-white';
          break;
        case 'processed':
        case 'transcribed':
        case 'analyzed':
          baseClass += 'bg-green-500 text-white';
          break;
        case 'error':
          baseClass += 'bg-red-500 text-white';
          break;
        default:
          baseClass += 'bg-gray-500 text-white';
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

  // ✅ CORRECTION : handleVideoAction
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
          if (video.status === 'processing') {
            setError('Transcription déjà en cours...');
            return;
          }
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

          if (transcriptionText.trim().length < 10) {
            setError('La transcription est trop courte pour l\'analyse (minimum 10 caractères).');
            return;
          }

          if (video.status === 'analyzing') {
            setError('Analyse déjà en cours...');
            return;
          }

          await startAnalysis(video.id, transcriptionText, user.id);
          break;
          
        case 'view-analysis':
          setSelectedVideoForAnalysis(video);
          break;
          
        default:
          console.warn('Action non reconnue:', action);
      }
    } catch (err) {
      console.error(`❌ Erreur action ${action}:`, err);
      setError(`Erreur lors de l'action ${action}: ${err.message}`);
    }
  };

  const renderDashboardStats = () => {
    const stats = {
      total: videos.length,
      processed: videos.filter(v => 
        v.status === 'processed' || v.status === 'transcribed' || v.status === 'analyzed'
      ).length,
      transcribed: videos.filter(v => 
        v.transcription_data || v.transcript || v.transcription_text
      ).length,
      analyzed: videos.filter(v => 
        v.analysis || v.ai_result
      ).length
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
                <div className="h-4 bg-gray-300 rounded mb-4 w-3/4"></div>
                <div className="h-20 bg-gray-300 rounded"></div>
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

    if (filteredVideos.length === 0) {
      const hasFilters = filteredVideos.length === 0 && videos.length > 0;
      
      return (
        <div className="text-center py-12">
          {hasFilters ? (
            <>
              <Filter className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune vidéo ne correspond aux filtres</h3>
              <p className="text-gray-600 mb-4">Essayez de modifier vos critères de recherche</p>
              <Button onClick={() => setFilteredVideos(videos)} variant="outline">
                Voir toutes les vidéos
              </Button>
            </>
          ) : (
            <>
              <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune vidéo</h3>
              <p className="text-gray-600 mb-4">Commencez par uploader votre première vidéo</p>
              <Button onClick={() => setActiveTab('upload')}>
                <Upload className="h-4 w-4 mr-2" />
                Uploader une vidéo
              </Button>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {filteredVideos.map((video) => {
          const hasTranscription = !!(video.transcription_data || video.transcript || video.transcription_text);
          const hasAnalysis = !!(video.analysis || video.ai_result);
          const transcriptionText = video.transcription_text || 
                                  video.transcription_data?.text || 
                                  video.transcript?.text || '';

          return (
            <Card key={video.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
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
                      className="bg-blue-600 hover:bg-blue-700"
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
                <p className="text-sm text-gray-600 mb-4">
                  {video.description || 'Aucune description'}
                </p>

                {/* Tags de la vidéo */}
                {video.tags && video.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {video.tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Transcription */}
                  <div>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Transcription
                    </h4>
                    {hasTranscription ? (
                      <div className="text-sm bg-gray-50 rounded p-3 max-h-32 overflow-y-auto border">
                        {transcriptionText.substring(0, 200)}...
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
                            {transcribing ? 'Traitement...' : 'Transcrire'}
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
                      <div className="space-y-2">
                        <div className="text-sm bg-gray-50 rounded p-3 max-h-24 overflow-y-auto border">
                          {video.analysis?.summary || video.ai_result?.insights || 'Analyse disponible'}
                        </div>
                        
                        {video.analysis?.tone_analysis && (
                          <div className="text-xs bg-blue-50 rounded p-2 border border-blue-200">
                            <div className="font-medium text-blue-800 mb-1 flex items-center gap-1">
                              <Volume2 className="h-3 w-3" />
                              Ton: {video.analysis.tone_analysis.emotion}
                            </div>
                            <div className="text-blue-600 text-xs">
                              Débit: {video.analysis.tone_analysis.pace} • 
                              Énergie: {video.analysis.tone_analysis.energy} • 
                              Clarté: {video.analysis.tone_analysis.clarity}
                            </div>
                          </div>
                        )}
                        
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
                      <div className="text-sm text-gray-500">
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
        <h1 className="text-3xl font-bold">Tableau de Bord Vidéos</h1>
        <div className="flex gap-2">
          <Button onClick={fetchVideos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button 
            onClick={() => setActiveTab('upload')} 
            className="bg-green-600 hover:bg-green-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Nouvelle Vidéo
          </Button>
        </div>
      </div>

      {/* ✅ Affichage des erreurs */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div>
                <h4 className="font-semibold text-red-300">Erreur</h4>
                <p className="text-red-200 text-sm mt-1">{error}</p>
              </div>
            </div>
            <Button 
              onClick={() => setError(null)} 
              variant="outline" 
              size="sm"
              className="border-red-600 text-red-300 hover:bg-red-800"
            >
              ×
            </Button>
          </div>
          
          {error.includes('transcription') && (
            <div className="mt-3 p-3 bg-red-800/20 rounded border border-red-600/50">
              <p className="text-red-200 text-sm">
                <strong>Solution :</strong> Assurez-vous que la vidéo a été transcrite avec succès avant l'analyse.
              </p>
            </div>
          )}
        </div>
      )}

      {renderDashboardStats()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="videos">
            Mes Vidéos ({filteredVideos.length})
          </TabsTrigger>
          <TabsTrigger value="upload">Uploader une vidéo</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-4">
          <VideoFilter videos={videos} onFilterChange={setFilteredVideos} />
          {renderVideoList()}
        </TabsContent>

        <TabsContent value="upload">
          <VideoUploader 
            onUploadComplete={() => {
              fetchVideos();
              if (onVideoUploaded) onVideoUploaded();
            }} 
          />
        </TabsContent>
      </Tabs>

      {/* Modal de lecture vidéo */}
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

      {/* Modal d'analyse détaillée */}
      {selectedVideoForAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-gray-50 to-gray-100">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
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
