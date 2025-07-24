import React, { useState, useEffect } from 'react';
import { Video, FileText, BarChart3, Clock, Play } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    videosCount: 0,
    transcriptionsCount: 0,
    averageScore: null
  });
  const [recentVideos, setRecentVideos] = useState([]);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      
      try {
        // D'abord récupérer le profil de l'utilisateur
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (profileError) {
          console.warn('Profil non trouvé:', profileError.message);
          setStats({
            videosCount: 0,
            transcriptionsCount: 0,
            averageScore: null
          });
          setLoading(false);
          return;
        }
        
        const profileId = profileData.id;
        
        // Récupérer les vidéos avec plus d'informations
        const { data: videos, error: videosError } = await supabase
          .from('videos')
          .select('id, title, created_at, status, file_size')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false });

        if (videosError) {
          console.warn('Erreur lors de la récupération des vidéos:', videosError.message);
        }

        // Récupérer les transcriptions avec analyses
        const { data: transcriptions, error: transcriptionsError } = await supabase
          .from('transcriptions')
          .select(`
            id, 
            confidence_score, 
            created_at, 
            processing_status,
            analysis_result,
            videos!inner(title)
          `)
          .in('video_id', videos?.map(v => v.id) || [])
          .order('created_at', { ascending: false });

        if (transcriptionsError) {
          console.warn('Erreur lors de la récupération des transcriptions:', transcriptionsError.message);
        }

        // Calculer le score moyen
        const averageScore = transcriptions && transcriptions.length > 0 
          ? transcriptions.reduce((sum, t) => sum + (t.confidence_score || 0), 0) / transcriptions.length
          : null;

        setStats({
          videosCount: videos?.length || 0,
          transcriptionsCount: transcriptions?.length || 0,
          averageScore: averageScore ? Math.round(averageScore) : null
        });

        // Définir les vidéos récentes (max 5)
        setRecentVideos(videos?.slice(0, 5) || []);
        
        // Définir les analyses récentes (max 5)
        setRecentAnalyses(transcriptions?.slice(0, 5) || []);
        
      } catch (error) {
        console.error('Erreur lors du chargement des données du dashboard:', error);
        setStats({
          videosCount: 0,
          transcriptionsCount: 0,
          averageScore: null
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'published': { color: 'bg-green-100 text-green-800', text: 'Publié' },
      'processing': { color: 'bg-yellow-100 text-yellow-800', text: 'En cours' },
      'failed': { color: 'bg-red-100 text-red-800', text: 'Échec' },
      'draft': { color: 'bg-gray-100 text-gray-800', text: 'Brouillon' }
    };
    
    const config = statusConfig[status] || statusConfig['draft'];
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${config.color}`}>
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
          <p className="text-gray-600">Chargement de vos statistiques...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
        <p className="text-gray-600">
          Aperçu de vos activités et statistiques
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold">Vidéos uploadées</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.videosCount}</p>
          <p className="text-sm text-gray-500">Total</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold">Analyses IA</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.transcriptionsCount}</p>
          <p className="text-sm text-gray-500">Transcriptions</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold">Score moyen</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.averageScore !== null ? `${stats.averageScore}%` : '-'}
          </p>
          <p className="text-sm text-gray-500">Évaluation IA</p>
        </div>
      </div>

      {stats.videosCount === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Video className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Commencez votre première analyse
          </h3>
          <p className="text-blue-700 mb-4">
            Uploadez votre première vidéo de pitch pour voir vos statistiques apparaître ici.
          </p>
        </div>
      )}

      {/* Vidéos récentes */}
      {recentVideos.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Play className="h-5 w-5 text-blue-600" />
              Vidéos récentes
            </h3>
          </div>
          <div className="divide-y">
            {recentVideos.map((video) => (
              <div key={video.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {video.title || 'Vidéo sans titre'}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(video.created_at)}
                      </span>
                      <span>{formatFileSize(video.file_size)}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {getStatusBadge(video.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyses récentes */}
      {recentAnalyses.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Analyses récentes
            </h3>
          </div>
          <div className="divide-y">
            {recentAnalyses.map((analysis) => (
              <div key={analysis.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {analysis.videos?.title || 'Analyse sans titre'}
                    </h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(analysis.created_at)}
                      </span>
                      <span>Score: {analysis.confidence_score || 'N/A'}%</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      analysis.processing_status === 'completed_full' 
                        ? 'bg-green-100 text-green-800' 
                        : analysis.processing_status === 'completed_basic'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {analysis.processing_status === 'completed_full' ? 'Complète' :
                       analysis.processing_status === 'completed_basic' ? 'Basique' :
                       analysis.processing_status === 'transcription_only' ? 'Transcription' : 'Autre'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

