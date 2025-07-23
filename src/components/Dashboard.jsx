import React, { useState, useEffect } from 'react';
import { Video, FileText, BarChart3, Play, Calendar, AlertTriangle, Database } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    videosCount: 0,
    transcriptionsCount: 0,
    averageScore: null
  });
  const [recentVideos, setRecentVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        // Test de connexion à la base de données
        const { data: testConnection, error: connectionError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);
          
        if (connectionError && connectionError.code === 'PGRST116') {
          // Table profiles n'existe pas
          setDbError({
            type: 'missing_tables',
            message: 'Les tables de base de données ne sont pas configurées',
            details: 'Il semble que les tables Supabase (profiles, videos, transcriptions) ne soient pas créées.'
          });
          setLoading(false);
          return;
        }
        
        // D'abord récupérer le profil de l'utilisateur
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
          
        if (profileError) {
          if (profileError.code === 'PGRST301') {
            // Profil n'existe pas, essayer de le créer
            console.log('Création du profil utilisateur...');
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                user_id: user.id,
                email: user.email,
                username: user.email.split('@')[0],
                full_name: user.user_metadata?.full_name || user.email.split('@')[0]
              })
              .select()
              .single();
              
            if (createError) {
              throw new Error(`Erreur lors de la création du profil: ${createError.message}`);
            }
            
            // Utiliser le nouveau profil
            const profileId = newProfile.id;
            
            // Initialiser avec des stats vides pour un nouveau profil
            setStats({
              videosCount: 0,
              transcriptionsCount: 0,
              averageScore: null
            });
            setRecentVideos([]);
            setLoading(false);
            return;
          } else {
            throw new Error(`Erreur de profil: ${profileError.message}`);
          }
        }
        
        const profileId = profileData.id;
        
        // Récupérer le nombre de vidéos avec le profile_id
        const { data: videos, error: videosError } = await supabase
          .from('videos')
          .select('id, title, file_path, created_at, thumbnail_url, status')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false });

        if (videosError) {
          if (videosError.code === 'PGRST116') {
            setDbError({
              type: 'missing_videos_table',
              message: 'Table videos non trouvée',
              details: 'La table "videos" n\'existe pas dans la base de données.'
            });
            setLoading(false);
            return;
          }
          console.warn('Erreur lors de la récupération des vidéos:', videosError.message);
        }

        // Récupérer le nombre de transcriptions
        const { data: transcriptions, error: transcriptionsError } = await supabase
          .from('transcriptions')
          .select('id, confidence_score')
          .in('video_id', videos?.map(v => v.id) || []);

        if (transcriptionsError && transcriptionsError.code === 'PGRST116') {
          console.warn('Table transcriptions non trouvée, continuons sans les transcriptions');
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

        // Garder les 3 vidéos les plus récentes pour l'affichage
        setRecentVideos(videos?.slice(0, 3) || []);
        
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        setDbError({
          type: 'connection_error',
          message: 'Erreur de connexion à la base de données',
          details: error.message
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const retryConnection = () => {
    setLoading(true);
    setDbError(null);
    // Relancer le useEffect
    window.location.reload();
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

  // Affichage d'erreur de base de données
  if (dbError) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
          <p className="text-gray-600">Aperçu de vos activités et statistiques</p>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Database className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                {dbError.message}
              </h3>
              <p className="text-yellow-700 mb-4">
                {dbError.details}
              </p>
              
              {dbError.type === 'missing_tables' && (
                <div className="bg-yellow-100 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Solutions possibles :</h4>
                  <ul className="text-yellow-700 text-sm space-y-1">
                    <li>• Vérifiez que les migrations Supabase ont été exécutées</li>
                    <li>• Créez les tables profiles, videos et transcriptions</li>
                    <li>• Vérifiez les politiques RLS (Row Level Security)</li>
                    <li>• Contactez l'administrateur système</li>
                  </ul>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button onClick={retryConnection} variant="outline">
                  Réessayer
                </Button>
                <Button 
                  onClick={() => window.open('https://supabase.com/docs/guides/database', '_blank')}
                  variant="outline"
                >
                  Documentation Supabase
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Affichage des stats par défaut en mode dégradé */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold">Vidéos uploadées</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-500">Non disponible</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold">Analyses IA</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-500">Non disponible</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold">Score moyen</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-500">Non disponible</p>
          </div>
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

      {/* Section des vidéos récentes */}
      {recentVideos.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Vidéos récentes</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentVideos.map((video) => (
              <div key={video.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Play className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {video.title || video.file_path || 'Sans titre'}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {formatDate(video.created_at)}
                    </div>
                    {video.status && (
                      <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                        video.status === 'published' ? 'bg-green-100 text-green-800' :
                        video.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {video.status === 'published' ? 'Publié' :
                         video.status === 'processing' ? 'En cours' :
                         video.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
};

export default Dashboard;

