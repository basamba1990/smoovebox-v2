import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession, getVideoUrl } from '../lib/supabase';

const VideoSuccess = () => {
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoId = searchParams.get('id');

  useEffect(() => {
    if (videoId) fetchVideoData();
  }, [videoId]);

  const fetchVideoData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Vérification robuste de la session
      const isSessionValid = await refreshSession();
      if (!isSessionValid) {
        setError('Session expirée. Veuillez vous reconnecter.');
        toast.error('Session expirée. Veuillez vous reconnecter.');
        navigate('/login');
        return;
      }

      // Récupération de l'utilisateur
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError('Utilisateur non authentifié.');
        toast.error('Utilisateur non authentifié.');
        navigate('/login');
        return;
      }

      console.log('Tentative de récupération de la vidéo:', videoId);
      
      // Requête avec gestion d'erreur améliorée - Inclure public_url, storage_path, file_path
      const { data, error: videoError } = await supabase
        .from('videos')
        .select('id, title, description, storage_path, file_path, public_url, created_at, status, user_id')
        .eq('id', videoId)
        .single();

      if (videoError) {
        console.error('Erreur détaillée Supabase:', videoError);
        
        // Vérification spécifique des erreurs courantes
        if (videoError.code === 'PGRST116') {
          throw new Error('Vidéo non trouvée. Elle a peut-être été supprimée.');
        } else if (videoError.code === '42501') {
          throw new Error('Permissions insuffisantes pour accéder à cette vidéo.');
        } else {
          throw videoError;
        }
      }

      // Vérification que l'utilisateur accède à sa propre vidéo
      if (data.user_id !== user.id) {
        setError('Vous ne pouvez pas accéder à cette vidéo.');
        toast.error('Accès non autorisé.');
        navigate('/videos');
        return;
      }

      setVideoData(data);
    } catch (err) {
      console.error('Erreur récupération vidéo:', err);
      setError(err.message || 'Impossible de charger les données de la vidéo.');
      toast.error('Erreur lors du chargement de la vidéo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Utiliser getVideoUrl pour obtenir l'URL de la vidéo
  const videoUrl = videoData ? getVideoUrl(videoData) : '';

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
      <div className="flex flex-col items-center justify-center min-h-screen text-white p-6 text-center">
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2">Erreur</h2>
          <p className="mb-4">{error || 'Vidéo non trouvée.'}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={fetchVideoData} className="bg-blue-600 hover:bg-blue-700">
              Réessayer
            </Button>
            <Button onClick={handleReconnect} className="bg-gray-600 hover:bg-gray-700">
              Se reconnecter
            </Button>
            <Button onClick={() => navigate('/videos')} className="bg-green-600 hover:bg-green-700">
              Mes vidéos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white p-6">
      <div className="max-w-lg w-full bg-black/50 backdrop-blur-md rounded-2xl p-8 border border-white/20">
        <h1 className="text-3xl font-bold mb-6 text-center">Votre vidéo est en ligne !</h1>
        
        <div className="mb-8 p-6 border-2 border-blue-500 rounded-lg bg-white/5 text-center">
          <h3 className="text-xl mb-4">Partagez votre vidéo avec ce QR code</h3>
          <div className="flex justify-center mb-4">
            <QRCode 
              value={videoUrl} 
              size={200} 
              level="H"
              fgColor="#ffffff"
              bgColor="transparent"
              includeMargin={false}
            />
          </div>
          <p className="text-sm text-gray-300">
            Scannez ce QR code pour accéder à votre vidéo
          </p>
        </div>
        
        <div className="mb-6">
          <p className="mb-2 text-center">Lien direct vers votre vidéo :</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={videoUrl}
              readOnly
              className="flex-1 p-2 border border-gray-600 rounded bg-white/10 text-white text-sm"
            />
            <Button 
              onClick={copyToClipboard}
              className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
            >
              Copier
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate('/videos')}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Voir toutes mes vidéos
          </Button>
          <Button
            onClick={() => navigate('/record-video')}
            className="bg-green-600 hover:bg-green-700"
          >
            Créer une nouvelle vidéo
          </Button>
          <Button
            onClick={() => navigate('/directory')}
            className="bg-orange-600 hover:bg-orange-700"
          >
            Explorer l'annuaire
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoSuccess;
