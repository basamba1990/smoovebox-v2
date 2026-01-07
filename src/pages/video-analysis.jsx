// src/pages/video-analysis.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import VideoAnalysisResults from '../components/VideoAnalysisResults';
import { Button } from '../components/ui/button-enhanced';
import ProfessionalHeader from '../components/ProfessionalHeader';

const VideoAnalysisPage = ({ user, profile, onSignOut }) => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  useEffect(() => {
    fetchVideoData();
  }, [videoId]);

  const fetchVideoData = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) throw error;
      setVideo(data);
    } catch (err) {
      setError('Erreur lors du chargement de la vidéo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestProfile = async () => {
    if (!video) return;

    try {
      setProfileLoading(true);
      setProfileMessage(null);

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-profile-information`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            videoId,
            userId: video.user_id,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.error) {
        throw new Error(result.error || `Erreur ${response.status}`);
      }

      setProfileMessage('Profil mis à jour à partir de la transcription (profile_information).');
      // Optionally refresh video data to see updated profile_information later
      fetchVideoData();
    } catch (err) {
      console.error('Erreur test profil:', err);
      setProfileMessage(err.message || 'Erreur lors de l’extraction du profil.');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement de l'analyse...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* En-tête */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-french font-bold text-gray-900">
                📊 Analyse de Votre Vidéo
              </h1>
              <p className="text-gray-600 mt-2">
                Découvrez des insights détaillés sur votre communication
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate('/record-video')}
                className="btn-spotbulle"
              >
                🎥 Nouvelle Vidéo
              </Button>
              <Button
                variant="outline"
                onClick={handleTestProfile}
                disabled={profileLoading || !video?.transcription_text}
              >
                {profileLoading ? 'Extraction profil...' : 'Tester profil IA'}
              </Button>
            </div>
          </div>

          {/* Contenu de l'analyse */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonne principale - Analyse détaillée */}
            <div className="lg:col-span-2 space-y-6">
              {profileMessage && (
                <div className="card-spotbulle p-4 bg-blue-50 border border-blue-200 text-sm text-blue-800">
                  {profileMessage}
                </div>
              )}

              <VideoAnalysisResults video={video} />
              
              {/* Transcription */}
              {video.transcription_text && (
                <div className="card-spotbulle p-6">
                  <h3 className="text-xl font-semibold mb-4">📝 Transcription</h3>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {video.transcription_text}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Colonne latérale - Actions et recommandations */}
            <div className="space-y-6">
              {/* Score global */}
              <div className="card-spotbulle p-6 text-center">
                <h3 className="text-lg font-semibold mb-4">🎯 Score IA</h3>
                <div className="text-4xl font-bold text-france-600 mb-2">
                  {video.ai_score ? (video.ai_score * 10).toFixed(1) : '7.0'}/10
                </div>
                <p className="text-gray-600 text-sm">
                  Qualité globale de votre communication
                </p>
              </div>

              {/* Actions rapides */}
              <div className="card-spotbulle p-6">
                <h3 className="text-lg font-semibold mb-4">🚀 Prochaines Étapes</h3>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/record-video')}
                    className="w-full justify-start btn-spotbulle"
                  >
                    🎥 Améliorer avec une nouvelle vidéo
                  </Button>
                  <Button
                    onClick={() => navigate('/directory')}
                    className="w-full justify-start bg-white text-france-600 border border-france-600 hover:bg-france-50"
                  >
                    👥 Partager avec la communauté
                  </Button>
                  <Button
                    onClick={() => navigate('/')}
                    className="w-full justify-start bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  >
                    🎓 Voir les séminaires
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalysisPage;
