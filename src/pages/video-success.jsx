import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';

const VideoSuccess = () => {
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = useSupabaseClient();
  const user = useUser();
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
        .select('id, title, description, storage_path, user_id, created_at')
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

  const videoUrl = videoData ? `${window.location.origin}/video/${videoData.id}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(videoUrl);
    toast.success('Lien copié dans le presse-papiers !');
  };

  const shareByEmail = async () => {
    if (!videoData || !user) return;
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          user_id: user.id,
          video_id: videoData.id,
          video_url: videoUrl,
        },
      });
      if (error) throw error;
      toast.success('E-mail envoyé avec succès !');
    } catch (err) {
      console.error('Erreur envoi e-mail:', err);
      toast.error('Erreur lors de l\'envoi de l\'e-mail.');
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (error || !videoData) return <div>{error || 'Vidéo non trouvée. Veuillez réessayer.'}</div>;

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <h2 className="text-2xl text-white mb-4">Votre vidéo est en ligne !</h2>

      <div className="mb-8 p-6 border-2 border-blue-500 rounded-lg bg-white/10 backdrop-blur-md">
        <h3 className="text-xl text-white mb-4">Partagez votre vidéo avec ce QR code</h3>
        <div className="flex justify-center mb-4">
          <QRCode value={videoUrl} size={200} fgColor="#38b2ac" />
        </div>
        <p className="text-sm text-gray-200">Scannez ce QR code pour accéder à votre vidéo</p>
      </div>

      <div className="mb-6 w-full max-w-md">
        <p className="text-white mb-2">Lien direct vers votre vidéo :</p>
        <input
          type="text"
          value={videoUrl}
          readOnly
          className="w-full p-2 border rounded bg-white/10 text-white"
        />
        <div className="flex gap-4 mt-4 justify-center">
          <Button onClick={copyToClipboard}>Copier le lien</Button>
          <Button onClick={shareByEmail}>Partager par e-mail</Button>
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
