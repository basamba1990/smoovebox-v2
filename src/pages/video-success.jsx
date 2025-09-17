// src/pages/video-success.jsx
import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';

const VideoSuccess = () => {
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = useSupabaseClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoId = searchParams.get('id');

  useEffect(() => {
    if (videoId) fetchVideoData();
  }, [videoId]);

  const fetchVideoData = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, storage_path, created_at')
        .eq('id', videoId)
        .single();

      if (error) throw error;
      setVideoData(data);
    } catch (err) {
      console.error('Erreur récupération vidéo:', err);
      setError('Impossible de charger les données de la vidéo.');
      toast.error('Erreur lors du chargement de la vidéo.');
    } finally {
      setLoading(false);
    }
  };

  // Générer URL publique via Supabase Storage
  const videoUrl = videoData
    ? supabase
        .storage
        .from('videos')
        .getPublicUrl(videoData.storage_path).data.publicUrl
    : '';

  const copyToClipboard = () => {
    if (videoUrl) {
      navigator.clipboard.writeText(videoUrl);
      toast.success('Lien copié dans le presse-papiers !');
    }
  };

  if (loading) return <p className="text-white">Chargement...</p>;
  if (error || !videoData)
    return <p className="text-red-500">{error || 'Vidéo non trouvée.'}</p>;

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
