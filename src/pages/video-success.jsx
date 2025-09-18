// src/pages/video-success.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';
import { videoService } from '../services/videoService';

const VideoSuccess = () => {
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
          // Fallback to createSignedUrl directly
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

      // Vérifier la session
      const isSessionValid = await refreshSession();
      if (!isSessionValid) {
        console.log('Session invalide, redirection suggérée vers /login');
        setError('Veuillez vous reconnecter.');
        toast.error('Session invalide, veuillez vous reconnecter.');
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('Utilisateur non authentifié, erreur:', authError);
        setError('Veuillez vous reconnecter.');
        toast.error('Utilisateur non authentifié.');
        return;
      }
      console.log('Utilisateur authentifié:', user.id);

      console.log('Chargement vidéo ID:', videoId);
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, storage_path, created_at, public_url')
        .eq('id', videoId)
        .single();

      if (error) {
        console.error('Erreur Supabase:', error);
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

      console.log('Données vidéo:', data);
      setVideoData(data);

      // Incrémenter les vues
      try {
        await videoService.incrementViews(videoId);
        console.log('Vues incrémentées pour vidéo:', videoId);
      } catch (viewError) {
        console.warn('Erreur incrémentation vues:', viewError);
        toast.warning('Vidéo chargée, mais échec de l’incrémentation des vues.');
      }

      // Générer l'URL accessible
      const url = await buildAccessibleUrl(data);
      if (!url) {
        setError('Impossible de générer l’URL de la vidéo.');
        toast.error('Erreur lors de la génération de l’URL de la vidéo.');
      } else {
        setVideoUrl(url);
        // Envoyer un email avec l'URL
        try {
          if (!import.meta.env.VITE_SUPABASE_URL) {
            console.error('VITE_SUPABASE_URL manquant');
            toast.error('Erreur de configuration serveur.');
            setError('Erreur de configuration serveur.');
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
            console.warn('Erreur envoi email:', await response.text());
            toast.warning('Vidéo chargée, mais échec de l’envoi de l’email.');
          } else {
            console.log('Email envoyé avec succès pour vidéo:', videoId);
            toast.success('Un email avec le lien de votre vidéo a été envoyé.');
          }
        } catch (emailError) {
          console.warn('Erreur envoi email:', emailError);
          toast.warning('Vidéo chargée, mais échec de l’envoi de l’email.');
        }
      }
    } catch (err) {
      console.error('Erreur récupération vidéo:', err);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p>Chargement de votre vidéo...</p>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div className="flex flex-col items-center text-center text-white p-6">
        <p className="text-red-500 mb-4">{error || 'Vidéo non trouvée.'}</p>
        <Button onClick={fetchVideoData} className="bg-blue-500 hover:bg-blue-600 mb-4">
          Réessayer
        </Button>
        <Button onClick={() => navigate('/login')} className="bg-gray-500 hover:bg-gray-600">
          Se reconnecter
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Votre vidéo est en ligne !</h1>
      <div className="mb-8 p-6 border-2 border-blue-500 rounded-lg bg-white/10 backdrop-blur-md">
        <h3 className="text-xl mb-4">Partagez votre vidéo avec ce QR code</h3>
        <div className="flex justify-center mb-4">
          <QRCode value={videoUrl} size={200} fgColor="#38b2ac" />
        </div>
        <p className="text-sm text-gray-200">
          Scannez ce QR code pour accéder à votre vidéo
        </p>
      </div>
      <div className="mb-6 w-full max-w-md">
        <p className="mb-2">Lien direct vers votre vidéo :</p>
        <input
          type="text"
          value={videoUrl}
          readOnly
          className="w-full p-2 border rounded bg-white/10 text-white mb-4"
        />
        <div className="flex gap-4 mt-4 justify-center">
          <Button onClick={copyToClipboard}>Copier le lien</Button>
        </div>
      </div>
      <Button
        onClick={() => navigate('/directory')}
        className="bg-orange-500 hover:bg-orange-600"
      >
        Explorer l'annuaire des participants
      </Button>
    </div>
  );
};

export default VideoSuccess;
