import React, { useEffect, useState } from 'react';
import { useTransformationSession } from '../hooks/useTransformationSession';

/**
 * Composant pour afficher le journal de transformation GENUP
 * Affiche toutes les vidéos d'une session groupées par type et chronologiquement
 */
export default function TransformationJournal({ sessionId }) {
  const { getSessionVideos, loading, error } = useTransformationSession();
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState({
    totalVideos: 0,
    pitchCount: 0,
    reflexiveCount: 0,
    actionTraceCount: 0,
  });

  useEffect(() => {
    if (sessionId) {
      loadJournal();
    }
  }, [sessionId]);

  const loadJournal = async () => {
    const fetchedVideos = await getSessionVideos(sessionId);
    if (fetchedVideos) {
      setVideos(fetchedVideos);
      calculateStats(fetchedVideos);
    }
  };

  const calculateStats = (videoList) => {
    const stats = {
      totalVideos: videoList.length,
      pitchCount: videoList.filter(v => v.video_type === 'pitch').length,
      reflexiveCount: videoList.filter(v => v.video_type === 'reflexive').length,
      actionTraceCount: videoList.filter(v => v.video_type === 'action_trace').length,
    };
    setStats(stats);
  };

  const getVideoTypeIcon = (type) => {
    const icons = {
      pitch: '🎤',
      reflexive: '💭',
      action_trace: '🎯',
      ai_synthesis: '🤖',
      human_validation: '✓',
    };
    return icons[type] || '📹';
  };

  const getVideoTypeLabel = (type) => {
    const labels = {
      pitch: 'Pitch',
      reflexive: 'Réflexion',
      action_trace: 'Trace d\'action',
      ai_synthesis: 'Synthèse IA',
      human_validation: 'Validation',
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      validated: 'bg-emerald-100 text-emerald-800',
      failed: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement du journal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-red-200">
        <h3 className="font-bold mb-2">Erreur</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Statistiques */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.totalVideos}</div>
          <div className="text-sm text-gray-400">Vidéos totales</div>
        </div>
        <div className="bg-blue-700/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-300">{stats.pitchCount}</div>
          <div className="text-sm text-blue-200">Pitchs</div>
        </div>
        <div className="bg-purple-700/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-300">{stats.reflexiveCount}</div>
          <div className="text-sm text-purple-200">Réflexions</div>
        </div>
        <div className="bg-green-700/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-300">{stats.actionTraceCount}</div>
          <div className="text-sm text-green-200">Traces d\'action</div>
        </div>
      </div>

      {/* Timeline des vidéos */}
      {videos.length === 0 ? (
        <div className="bg-slate-700 rounded-lg p-12 text-center">
          <p className="text-gray-400 text-lg">
            Aucune vidéo dans cette session. Commencez par enregistrer votre premier contenu !
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="bg-slate-700 rounded-lg p-6 hover:bg-slate-600 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Numéro et icône */}
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-600">
                    <span className="text-lg">{getVideoTypeIcon(video.video_type)}</span>
                  </div>
                </div>

                {/* Contenu */}
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-white">
                      {video.title || `${getVideoTypeLabel(video.video_type)} #${index + 1}`}
                    </h3>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(video.status)}`}>
                      {video.status}
                    </span>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-600 text-gray-300">
                      {getVideoTypeLabel(video.video_type)}
                    </span>
                  </div>

                  {video.description && (
                    <p className="text-gray-300 text-sm mb-3">{video.description}</p>
                  )}

                  {/* Analyse IA si disponible */}
                  {video.analysis && (
                    <div className="bg-slate-800 rounded-lg p-3 mb-3">
                      <div className="text-xs text-gray-400 mb-2">Analyse IA</div>
                      {video.analysis.tone && (
                        <p className="text-sm text-gray-200">
                          <span className="font-semibold">Ton :</span> {video.analysis.tone}
                        </p>
                      )}
                      {video.analysis.emotions && video.analysis.emotions.length > 0 && (
                        <p className="text-sm text-gray-200 mt-1">
                          <span className="font-semibold">Émotions :</span> {video.analysis.emotions.join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-xs text-gray-500">
                    {new Date(video.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {/* Bouton de lecture */}
                {video.public_url && (
                  <div className="flex-shrink-0">
                    <a
                      href={video.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      <span className="text-white">▶</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
