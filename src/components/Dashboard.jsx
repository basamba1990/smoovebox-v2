import React, { useState, useEffect } from 'react';
import { Video, FileText, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    videosCount: 0,
    transcriptionsCount: 0,
    averageScore: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        // Récupérer le nombre de vidéos
        const { data: videos, error: videosError } = await supabase
          .from('videos')
          .select('id')
          .eq('user_id', user.id);

        if (videosError) throw videosError;

        // Récupérer le nombre de transcriptions
        const { data: transcriptions, error: transcriptionsError } = await supabase
          .from('transcriptions')
          .select('id, confidence_score')
          .eq('user_id', user.id);

        if (transcriptionsError) throw transcriptionsError;

        // Calculer le score moyen
        const averageScore = transcriptions.length > 0 
          ? transcriptions.reduce((sum, t) => sum + (t.confidence_score || 0), 0) / transcriptions.length
          : null;

        setStats({
          videosCount: videos?.length || 0,
          transcriptionsCount: transcriptions?.length || 0,
          averageScore: averageScore ? Math.round(averageScore) : null
        });
      } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

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
    </div>
  );
};

export default Dashboard;

