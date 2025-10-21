// ✅ VERSION CORRIGÉE - Dashboard optimisé
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Upload, FileText, Video, RefreshCw, Trash2, AlertCircle, 
  CheckCircle, Clock, Play, BarChart3, Eye, Download, 
  Search, Filter, X, Sparkles, TrendingUp, Users, Zap 
} from 'lucide-react';

// ✅ NOUVEAU : Hook personnalisé pour la gestion des vidéos
const useVideosManager = (userId, refreshKey) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [operationState, setOperationState] = useState({
    transcribing: false,
    analyzing: false,
    deleting: false
  });

  const fetchVideos = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      console.log('📥 Récupération optimisée des vidéos pour:', userId);
      
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          transcription_data,
          analysis,
          transcript,
          ai_result,
          transcription_text,
          profiles!inner(full_name, avatar_url)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ ${data?.length || 0} vidéos chargées avec profils`);
      setVideos(data || []);

    } catch (err) {
      console.error('❌ Erreur fetchVideos:', err);
      setError(`Erreur lors du chargement: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ✅ Rechargement automatique avec dépendances
  useEffect(() => {
    fetchVideos();
  }, [fetchVideos, refreshKey]);

  const startTranscription = useCallback(async (videoId) => {
    try {
      setOperationState(prev => ({ ...prev, transcribing: true }));
      
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
      
      // ✅ Rechargement intelligent après délai
      setTimeout(() => {
        fetchVideos();
      }, 3000);

    } catch (err) {
      console.error('❌ Erreur transcription:', err);
      setError(`Erreur transcription: ${err.message}`);
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'error', transcription_status: 'error' }
          : video
      ));
    } finally {
      setOperationState(prev => ({ ...prev, transcribing: false }));
    }
  }, [fetchVideos]);

  const startAnalysis = useCallback(async (videoId, transcriptionText) => {
    try {
      setOperationState(prev => ({ ...prev, analyzing: true }));
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'analyzing' }
          : video
      ));

      if (!transcriptionText?.trim()) {
        throw new Error('Texte de transcription manquant');
      }

      const { data, error } = await supabase.functions.invoke('analyze-transcription', {
        body: { 
          videoId: videoId,
          transcriptionText: transcriptionText,
          userId: userId
        }
      });

      if (error) throw error;

      console.log('✅ Analyse IA lancée:', data);
      
      setTimeout(() => {
        fetchVideos();
      }, 3000);

    } catch (err) {
      console.error('❌ Erreur analyse:', err);
      setError(`Erreur analyse IA: ${err.message}`);
      
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, status: 'error' }
          : video
      ));
    } finally {
      setOperationState(prev => ({ ...prev, analyzing: false }));
    }
  }, [fetchVideos, userId]);

  const deleteVideo = useCallback(async (videoId) => {
    try {
      setOperationState(prev => ({ ...prev, deleting: true }));
      
      const video = videos.find(v => v.id === videoId);
      if (video?.file_path) {
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([video.file_path]);
        
        if (storageError) {
          console.warn('⚠️ Impossible de supprimer le fichier:', storageError);
        }
      }

      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      setVideos(prev => prev.filter(video => video.id !== videoId));
      console.log('✅ Vidéo supprimée:', videoId);
      
    } catch (err) {
      console.error('❌ Erreur suppression:', err);
      setError(`Erreur suppression: ${err.message}`);
      throw err;
    } finally {
      setOperationState(prev => ({ ...prev, deleting: false }));
    }
  }, [videos]);

  return {
    videos,
    loading,
    error,
    operationState,
    fetchVideos,
    startTranscription,
    startAnalysis,
    deleteVideo
  };
};

// ✅ NOUVEAU : Composant de statistiques avancées
const AdvancedDashboardStats = ({ videos }) => {
  const stats = useMemo(() => {
    const total = videos.length;
    const processed = videos.filter(v => 
      ['processed', 'transcribed', 'analyzed'].includes(v.status)
    ).length;
    const transcribed = videos.filter(v => 
      v.transcription_data || v.transcript || v.transcription_text
    ).length;
    const analyzed = videos.filter(v => 
      v.analysis || v.ai_result
    ).length;
    const totalDuration = videos.reduce((sum, video) => sum + (video.duration || 0), 0);
    const avgDuration = total > 0 ? totalDuration / total : 0;

    // ✅ NOUVEAU : Score d'engagement calculé
    const engagementScore = calculateEngagementScore(videos);

    return {
      total,
      processed,
      transcribed,
      analyzed,
      totalDuration,
      avgDuration,
      engagementScore
    };
  }, [videos]);

  const calculateEngagementScore = (videos) => {
    if (videos.length === 0) return 0;
    
    const weights = {
      analyzed: 0.4,
      transcribed: 0.3,
      processed: 0.2,
      uploaded: 0.1
    };

    const score = videos.reduce((total, video) => {
      let videoScore = 0;
      if (video.analysis || video.ai_result) videoScore += weights.analyzed;
      else if (video.transcription_data || video.transcription_text) videoScore += weights.transcribed;
      else if (video.status === 'processed') videoScore += weights.processed;
      else videoScore += weights.uploaded;

      return total + videoScore;
    }, 0);

    return Math.round((score / videos.length) * 100);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Total Vidéos</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Video className="h-8 w-8 opacity-90" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Transcrites</p>
              <p className="text-2xl font-bold">{stats.transcribed}</p>
            </div>
            <FileText className="h-8 w-8 opacity-90" />
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Analysées IA</p>
              <p className="text-2xl font-bold">{stats.analyzed}</p>
            </div>
            <BarChart3 className="h-8 w-8 opacity-90" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Durée Moy.</p>
              <p className="text-2xl font-bold">{Math.round(stats.avgDuration / 60)}min</p>
            </div>
            <Clock className="h-8 w-8 opacity-90" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-red-500 to-pink-600 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-90">Engagement</p>
              <p className="text-2xl font-bold">{stats.engagementScore}%</p>
            </div>
            <TrendingUp className="h-8 w-8 opacity-90" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ✅ VERSION AMÉLIORÉE : VideoFilter avec suggestions IA
const SmartVideoFilter = ({ videos, onFilterChange, userProfile }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [aiSuggestions, setAiSuggestions] = useState([]);

  // ✅ NOUVEAU : Suggestions IA basées sur le profil utilisateur
  useEffect(() => {
    if (userProfile?.passions && videos.length > 0) {
      const suggestions = generateAISuggestions(userProfile.passions, videos);
      setAiSuggestions(suggestions);
    }
  }, [userProfile, videos]);

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
      // ✅ Extraction des thèmes de l'analyse IA
      if (video.analysis?.key_topics) {
        video.analysis.key_topics.forEach(topic => {
          tags.add(topic.toLowerCase());
        });
      }
    });
    return Array.from(tags).sort();
  }, [videos]);

  const filteredVideos = useMemo(() => {
    let result = videos.filter(video => {
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

      // ✅ NOUVEAU : Filtre par date
      const matchesDate = dateRange === 'all' || isInDateRange(video.created_at, dateRange);

      return matchesSearch && matchesTags && matchesStatus && matchesDate;
    });

    onFilterChange(result);
    return result;
  }, [videos, searchTerm, selectedTags, statusFilter, dateRange, onFilterChange]);

  const generateAISuggestions = (passions, videos) => {
    const suggestions = [];
    
    if (passions.includes('football') || passions.includes('sport')) {
      suggestions.push({
        type: 'sport',
        tags: ['technique', 'entrainement', 'match', 'performance'],
        description: 'Vidéos liées à votre passion sportive'
      });
    }

    if (passions.includes('éducation') || passions.includes('apprentissage')) {
      suggestions.push({
        type: 'education',
        tags: ['pédagogie', 'apprentissage', 'conseils', 'partage'],
        description: 'Contenus éducatifs et formatifs'
      });
    }

    return suggestions;
  };

  const isInDateRange = (dateString, range) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    switch (range) {
      case 'today': return diffDays <= 1;
      case 'week': return diffDays <= 7;
      case 'month': return diffDays <= 30;
      default: return true;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setStatusFilter('all');
    setDateRange('all');
  };

  const hasActiveFilters = searchTerm || selectedTags.length > 0 || statusFilter !== 'all' || dateRange !== 'all';

  return (
    <div className="space-y-4 mb-6 p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700">
      {/* En-tête avec suggestions IA */}
      {aiSuggestions.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-300">Suggestions IA</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setSelectedTags(suggestion.tags)}
                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all flex items-center gap-1"
              >
                <Zap className="h-3 w-3" />
                {suggestion.description}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
        {/* Barre de recherche avancée */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            🔍 Recherche intelligente
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Titre, description, transcription, thèmes IA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filtre par statut */}
        <div>
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
            <option value="analyzed">Analysées IA</option>
            <option value="failed">Échecs</option>
          </select>
        </div>

        {/* Filtre par date */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            📅 Période
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Toutes dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">30 derniers jours</option>
          </select>
        </div>
      </div>

      {/* Filtre par tags amélioré */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">
            🏷️ Mots-clés & Thèmes IA
          </label>
          <span className="text-xs text-gray-400">
            {selectedTags.length} sélectionné(s)
          </span>
        </div>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-700/50 rounded-lg">
          {allTags.slice(0, 50).map(tag => (
            <button
              key={tag}
              onClick={() => {
                setSelectedTags(prev => 
                  prev.includes(tag) 
                    ? prev.filter(t => t !== tag)
                    : [...prev, tag]
                );
              }}
              className={`px-3 py-1 rounded-full text-sm transition-all flex items-center gap-1 ${
                selectedTags.includes(tag)
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {tag}
              {selectedTags.includes(tag) && (
                <X className="h-3 w-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Résumé et actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          {hasActiveFilters && (
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
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-sm rounded-full">
                  {statusFilter}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="hover:text-red-300 text-xs"
                  >
                    ×
                  </button>
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-400">
            {filteredVideos.length} vidéo(s) sur {videos.length}
            {hasActiveFilters && (
              <span className="ml-2 text-blue-400">
                (filtré)
              </span>
            )}
          </div>
          
          {hasActiveFilters && (
            <Button
              onClick={clearFilters}
              variant="outline"
              size="sm"
              className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
            >
              <X className="h-4 w-4 mr-1" />
              Tout effacer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ✅ VERSION AMÉLIORÉE : Dashboard principal
const EnhancedDashboard = ({ refreshKey = 0, onVideoUploaded, userProfile }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('videos');
  const [filteredVideos, setFilteredVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedVideoForAnalysis, setSelectedVideoForAnalysis] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // ✅ Utilisation du hook personnalisé
  const {
    videos,
    loading,
    error,
    operationState,
    fetchVideos,
    startTranscription,
    startAnalysis,
    deleteVideo
  } = useVideosManager(user?.id, refreshKey);

  // ✅ Gestion optimisée des URLs vidéo avec cache
  const getVideoUrl = useCallback(async (video) => {
    if (!video) return null;

    // ✅ Cache simple en mémoire
    const cacheKey = `video_url_${video.id}`;
    const cachedUrl = sessionStorage.getItem(cacheKey);
    if (cachedUrl) return cachedUrl;

    try {
      let url = null;

      if (video.public_url) {
        url = video.public_url;
      } else if (video.storage_path || video.file_path) {
        const path = video.storage_path || video.file_path;
        const { data, error } = await supabase.storage
          .from('videos')
          .createSignedUrl(path, 3600);

        if (!error) url = data.signedUrl;
      }

      if (url) {
        sessionStorage.setItem(cacheKey, url);
        setTimeout(() => sessionStorage.removeItem(cacheKey), 3500000); // 58 minutes
      }

      return url;
    } catch (err) {
      console.error('❌ Erreur getVideoUrl:', err);
      return null;
    }
  }, []);

  const handleVideoAction = useCallback(async (video, action) => {
    try {
      switch (action) {
        case 'play':
          const url = await getVideoUrl(video);
          if (url) {
            setVideoPlayerUrl(url);
            setSelectedVideo(video);
          } else {
            throw new Error('URL vidéo non disponible');
          }
          break;
        case 'view-analysis':
          setSelectedVideoForAnalysis(video);
          break;
        case 'transcribe':
          await startTranscription(video.id);
          break;
        case 'analyze':
          const transcriptionText = video.transcription_text || 
                                  video.transcription_data?.text || 
                                  video.transcript?.text || '';
          await startAnalysis(video.id, transcriptionText);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(`❌ Erreur action ${action}:`, err);
    }
  }, [getVideoUrl, startTranscription, startAnalysis]);

  const handleDeleteVideo = useCallback(async (videoId) => {
    try {
      await deleteVideo(videoId);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('❌ Erreur suppression:', err);
    }
  }, [deleteVideo]);

  // ✅ Rendu conditionnel optimisé
  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Accès non autorisé</h2>
        <p className="text-gray-600 mb-4">Veuillez vous connecter pour accéder à votre tableau de bord.</p>
        <Button onClick={() => window.location.href = '/login'}>
          Se connecter
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* En-tête amélioré */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Tableau de Bord SpotBulle
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez et analysez vos vidéos avec l'intelligence artificielle
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Sélecteur de vue */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Grille
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Liste
            </button>
          </div>

          <Button onClick={fetchVideos} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          
          <Button 
            onClick={() => setActiveTab('upload')}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
          >
            <Upload className="h-4 w-4 mr-2" />
            Nouvelle Vidéo
          </Button>
        </div>
      </div>

      {/* Statistiques avancées */}
      <AdvancedDashboardStats videos={videos} />

      {/* Navigation par onglets améliorée */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="videos" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Mes Vidéos ({filteredVideos.length})
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Uploader
          </TabsTrigger>
        </TabsList>
        
        {/* Onglet Vidéos */}
        <TabsContent value="videos" className="space-y-6">
          <SmartVideoFilter 
            videos={videos} 
            onFilterChange={setFilteredVideos}
            userProfile={userProfile}
          />
          
          <VideoListView 
            videos={filteredVideos}
            loading={loading}
            error={error}
            viewMode={viewMode}
            operationState={operationState}
            onVideoAction={handleVideoAction}
            onDeleteClick={setDeleteConfirm}
            onViewAnalysis={setSelectedVideoForAnalysis}
          />
        </TabsContent>
        
        {/* ✅ NOUVEAU : Onglet Analytics */}
        <TabsContent value="analytics">
          <DashboardAnalytics videos={videos} userProfile={userProfile} />
        </TabsContent>
        
        {/* Onglet Upload */}
        <TabsContent value="upload">
          <VideoUploader onUploadComplete={() => {
            fetchVideos();
            if (onVideoUploaded) onVideoUploaded();
            setActiveTab('videos');
          }} />
        </TabsContent>
      </Tabs>

      {/* Modaux */}
      <VideoPlayerModal 
        video={selectedVideo}
        videoUrl={videoPlayerUrl}
        onClose={() => {
          setSelectedVideo(null);
          setVideoPlayerUrl(null);
        }}
      />

      <DeleteConfirmationModal 
        videoId={deleteConfirm}
        onConfirm={handleDeleteVideo}
        onCancel={() => setDeleteConfirm(null)}
        isDeleting={operationState.deleting}
      />

      <AnalysisModal 
        video={selectedVideoForAnalysis}
        onClose={() => setSelectedVideoForAnalysis(null)}
      />
    </div>
  );
};

// ✅ COMPOSANT : Liste de vidéos optimisée
const VideoListView = ({ 
  videos, 
  loading, 
  error, 
  viewMode, 
  operationState, 
  onVideoAction, 
  onDeleteClick,
  onViewAnalysis 
}) => {
  if (loading) {
    return <VideoListSkeleton viewMode={viewMode} />;
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-800 mb-2">Erreur de chargement</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-dashed border-gray-300">
        <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucune vidéo</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Commencez par uploader votre première vidéo pour bénéficier des analyses IA avancées.
        </p>
        <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600">
          <Upload className="h-5 w-5 mr-2" />
          Commencer maintenant
        </Button>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid' 
      ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
      : "space-y-4"
    }>
      {videos.map((video) => (
        <VideoCard 
          key={video.id}
          video={video}
          viewMode={viewMode}
          operationState={operationState}
          onVideoAction={onVideoAction}
          onDeleteClick={onDeleteClick}
          onViewAnalysis={onViewAnalysis}
        />
      ))}
    </div>
  );
};

export default EnhancedDashboard;
