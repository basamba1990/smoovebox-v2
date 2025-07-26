import React from 'react';
import { Video, FileText, BarChart3, Clock, Lightbulb } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';

const Dashboard = ({ dashboardData }) => {
  const { user } = useAuth();
  
  // Si aucune donnée n'est fournie, afficher un message
  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
          <p className="text-gray-600">Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  const { stats, recentVideos } = dashboardData;

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

      {/* Vidéos récentes */}
      {recentVideos && recentVideos.length > 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Vidéos récentes</h3>
          <div className="space-y-4">
            {recentVideos.map((video) => (
              <div key={video.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded overflow-hidden">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-medium text-gray-900 truncate">{video.title || 'Sans titre'}</h4>
                  <p className="text-sm text-gray-500 truncate">{video.description || 'Aucune description'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{new Date(video.created_at).toLocaleDateString()}</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                      {video.status || 'En attente'}
                    </span>
                  </div>
                  {video.file_path && (
                    <a 
                      href={video.file_path} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline text-sm mt-2 block"
                    >
                      Voir la vidéo
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : stats.videosCount === 0 && (
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

      {/* Suggestions IA (si disponibles) */}
      {dashboardData.aiSuggestions && dashboardData.aiSuggestions.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold">Suggestions IA</h3>
          </div>
          <div className="space-y-3">
            {dashboardData.aiSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-gray-800">{suggestion.suggestion_text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pour: {suggestion.videos?.title || 'Vidéo inconnue'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activités récentes (si disponibles) */}
      {dashboardData.recentActivities && dashboardData.recentActivities.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-semibold">Activités récentes</h3>
          </div>
          <div className="space-y-2">
            {dashboardData.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <div>
                  <p className="text-sm text-gray-800">{activity.description || activity.activity_type}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
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
