// src/pages/video-success.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';
import { videoService } from '../services/videoService';
import ProfessionalHeader from '../components/ProfessionalHeader';

const VideoSuccess = ({ user, profile, onSignOut }) => {
  const [videoData, setVideoData] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoId = useMemo(() => searchParams.get('id'), [searchParams]);

  const buildAccessibleUrl = useCallback(async (video) => {
    try {
      if (video?.public_url) {
        console.log('Utilisation de public_url depuis la base:', video.public_url);
        return video.public_url;
      }

      if (video?.storage_path) {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'X-Client-Info': 'spotbulle',
        };
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signed-url`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ storage_path: video.storage_path, expires_in: 365 * 24 * 60 * 60 }),
        });

        if (!response.ok) {
          console.warn('Erreur génération URL signée:', await response.text());
          const { data: signed, error: signedErr } = await supabase
            .storage
            .from('videos')
            .createSignedUrl(video.storage_path, 365 * 24 * 60 * 60);
          if (signedErr) {
            console.warn('Erreur createSignedUrl:', signedErr);
          } else if (signed?.signedUrl) {
            console.log('URL signée générée:', signed.signedUrl);
            return signed.signedUrl;
          }
        } else {
          const { signed_url } = await response.json();
          if (signed_url) {
            console.log('URL signée via fonction Edge:', signed_url);
            return signed_url;
          }
        }

        const { data: pub } = supabase.storage.from('videos').getPublicUrl(video.storage_path);
        if (pub?.publicUrl) {
          console.log('URL publique générée:', pub.publicUrl);
          return pub.publicUrl;
        }
      }

      console.warn('Aucune URL accessible générée');
      return '';
    } catch (e) {
      console.warn('Erreur lors de la génération de l’URL de la vidéo:', e);
      return '';
    }
  }, []);

  const fetchVideoData = async () => {
    try {
      setLoading(true);
      setError(null);

      const isSessionValid = await refreshSession();
      if (!isSessionValid) {
        setError('Veuillez vous reconnecter.');
        toast.error('Session invalide, veuillez vous reconnecter.');
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError('Veuillez vous reconnecter.');
        toast.error('Utilisateur non authentifié.');
        return;
      }

      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, storage_path, created_at, public_url, analysis_result, ai_score')
        .eq('id', videoId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setError('Vidéo non trouvée.');
          toast.error('Vidéo non trouvée.');
        } else if (error.code === '42501') {
          setError('Accès non autorisé à la vidéo.');
          toast.error('Vous n’avez pas l’autorisation d’accéder à cette vidéo.');
        } else {
          setError('Erreur lors du chargement de la vidéo.');
          toast.error('Erreur lors du chargement de la vidéo.');
        }
        throw error;
      }

      setVideoData(data);

      try {
        await videoService.incrementViews(videoId);
      } catch (viewError) {
        toast.warning('Vidéo chargée, mais échec de l’incrémentation des vues.');
      }

      const url = await buildAccessibleUrl(data);
      if (!url) {
        setError('Impossible de générer l’URL de la vidéo.');
        toast.error('Erreur lors de la génération de l’URL de la vidéo.');
      } else {
        setVideoUrl(url);
        
        // Envoi d'email (optionnel)
        try {
          if (!import.meta.env.VITE_SUPABASE_URL) {
            toast.warning('Configuration email non disponible.');
            return;
          }
          const response = await Promise.race([
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.access_token}`,
                'X-Client-Info': 'spotbulle',
              },
              body: JSON.stringify({
                user_id: user.id,
                video_id: videoId,
                video_url: url,
              }),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout envoi email')), 10000)),
          ]);
          if (!response.ok) {
            toast.warning('Vidéo chargée, mais échec de l’envoi de l’email.');
          } else {
            toast.success('Un email avec le lien de votre vidéo a été envoyé.');
          }
        } catch {
          toast.warning('Vidéo chargée, mais échec de l’envoi de l’email.');
        }
      }
    } catch {
      if (!error) {
        setError('Impossible de charger les données de la vidéo.');
        toast.error('Erreur lors du chargement de la vidéo.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!videoId) {
      setError('Paramètre id manquant.');
      setLoading(false);
      return;
    }
    fetchVideoData();
  }, [videoId]);

  const copyToClipboard = () => {
    if (videoUrl) {
      navigator.clipboard.writeText(videoUrl);
      toast.success('Lien copié dans le presse-papiers !');
    } else {
      toast.error('Aucun lien disponible à copier.');
    }
  };

  const navigateToAnalysis = () => {
    if (videoData?.analysis_result) {
      navigate(`/video-analysis/${videoId}`);
    } else {
      toast.info('L\'analyse de votre vidéo est en cours...');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-france-50 to-maroc-50">
        <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p>Chargement de votre vidéo...</p>
        </div>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-france-50 to-maroc-50">
        <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
        <div className="flex flex-col items-center text-center p-6 min-h-[50vh] justify-center">
          <p className="text-red-500 mb-4">{error || 'Vidéo non trouvée.'}</p>
          <div className="flex gap-4">
            <Button onClick={fetchVideoData} className="btn-spotbulle">
              Réessayer
            </Button>
            <Button onClick={() => navigate('/')} className="bg-gray-500 hover:bg-gray-600">
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-france-50 to-maroc-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-french font-bold text-gray-900 mb-2">
            🎉 Félicitations !
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Votre vidéo est en ligne et accessible à la communauté
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* QR Code */}
            <div className="card-spotbulle p-6">
              <h3 className="text-xl font-semibold mb-4">📱 QR Code de partage</h3>
              <div className="flex justify-center mb-4">
                <QRCode value={videoUrl} size={200} fgColor="#3b82f6" />
              </div>
              <p className="text-sm text-gray-600">
                Scannez ce QR code pour accéder directement à votre vidéo
              </p>
            </div>

            {/* Lien de partage */}
            <div className="card-spotbulle p-6">
              <h3 className="text-xl font-semibold mb-4">🔗 Lien de partage</h3>
              <div className="mb-4">
                <input
                  type="text"
                  value={videoUrl}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={copyToClipboard} className="flex-1">
                  📋 Copier le lien
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              onClick={navigateToAnalysis}
              className="btn-spotbulle text-lg py-3 px-6"
              disabled={!videoData?.analysis_result}
            >
              📊 Voir l'analyse détaillée
            </Button>
            
            <Button
              onClick={() => navigate('/record-video')}
              className="bg-white text-france-600 border border-france-600 hover:bg-france-50 text-lg py-3 px-6"
            >
              🎥 Créer une nouvelle vidéo
            </Button>
            
            <Button
              onClick={() => navigate('/directory')}
              className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 text-lg py-3 px-6"
            >
              👥 Explorer la communauté
            </Button>
          </div>

          {/* Informations supplémentaires */}
          {videoData.analysis_result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800">
                ✅ Votre vidéo a été analysée avec succès. 
                <strong> Score IA : {videoData.ai_score ? (videoData.ai_score * 10).toFixed(1) : '7.0'}/10</strong>
              </p>
            </div>
          )}

          <div className="text-sm text-gray-600">
            <p>Votre vidéo est maintenant visible par les membres de la communauté SpotBulle</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSuccess;
