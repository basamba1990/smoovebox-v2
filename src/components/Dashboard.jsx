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
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Dashboard
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Aperçu de vos activités et statistiques en temps réel
        </p>
      </div>
      
      {/* Statistiques avec design moderne */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <Video className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Vidéos uploadées</h3>
              <p className="text-xs text-gray-500">Total des uploads</p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              {stats.videosCount}
            </p>
            <div className="flex items-center gap-1 text-green-600 text-sm mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Actif</span>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Analyses IA</h3>
              <p className="text-xs text-gray-500">Transcriptions complètes</p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-700 bg-clip-text text-transparent">
              {stats.transcriptionsCount}
            </p>
            <div className="flex items-center gap-1 text-blue-600 text-sm mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>IA</span>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl shadow-lg">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Score moyen</h3>
              <p className="text-xs text-gray-500">Évaluation qualité IA</p>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-700 bg-clip-text text-transparent">
              {stats.averageScore !== null ? `${stats.averageScore}%` : '-'}
            </p>
            {stats.averageScore !== null && (
              <div className="flex items-center gap-1 text-purple-600 text-sm mb-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Qualité</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vidéos récentes avec design amélioré */}
      {recentVideos && recentVideos.length > 0 ? (
        <div className="bg-white/60 backdrop-blur-sm p-8 rounded-xl shadow-lg border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
              <Video className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Vidéos récentes</h3>
          </div>
          <div className="grid gap-4">
            {recentVideos.map((video, index) => (
              <div 
                key={video.id} 
                className="group flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:bg-white/80 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex-shrink-0 w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden shadow-md">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                      <Video className="h-8 w-8 text-blue-500" />
                    </div>
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {video.title || 'Sans titre'}
                  </h4>
                  <p className="text-sm text-gray-600 truncate mt-1">
                    {video.description || 'Aucune description'}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-gray-500">
                      {new Date(video.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      video.status === 'published' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : video.status === 'processing'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      {video.status === 'published' ? 'Publié' : 
                       video.status === 'processing' ? 'En cours' : 
                       video.status || 'En attente'}
                    </span>
                  </div>
                </div>
                {video.file_path && (
                  <div className="flex-shrink-0">
                    <a 
                      href={video.file_path} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <Video className="h-4 w-4" />
                      <span className="hidden sm:inline">Voir</span>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : stats.videosCount === 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-8 text-center shadow-lg">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 animate-pulse"></div>
            </div>
            <Video className="h-16 w-16 text-blue-600 mx-auto relative z-10" />
          </div>
          <h3 className="text-xl font-semibold text-blue-900 mb-3">
            Commencez votre première analyse
          </h3>
          <p className="text-blue-700 mb-6 max-w-md mx-auto">
            Uploadez votre première vidéo de pitch pour voir vos statistiques apparaître ici et bénéficier de l'analyse IA.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 rounded-lg border border-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-blue-700 text-sm font-medium">Prêt pour l'upload</span>
          </div>
        </div>
      )}

      {/* Suggestions IA avec design moderne */}
      {dashboardData.aiSuggestions && dashboardData.aiSuggestions.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm p-8 rounded-xl shadow-lg border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
              <Lightbulb className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Suggestions IA</h3>
          </div>
          <div className="grid gap-4">
            {dashboardData.aiSuggestions.map((suggestion, index) => (
              <div 
                key={suggestion.id} 
                className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 hover:shadow-md transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <p className="text-gray-800 font-medium">{suggestion.suggestion_text}</p>
                <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  Pour: {suggestion.videos?.title || 'Vidéo inconnue'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activités récentes avec design moderne */}
      {dashboardData.recentActivities && dashboardData.recentActivities.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm p-8 rounded-xl shadow-lg border border-white/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Activités récentes</h3>
          </div>
          <div className="space-y-3">
            {dashboardData.recentActivities.map((activity, index) => (
              <div 
                key={activity.id} 
                className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-white/60 transition-all duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 animate-pulse"></div>
                <div className="flex-grow">
                  <p className="text-sm text-gray-800 font-medium">
                    {activity.description || activity.activity_type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString('fr-FR')}
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
