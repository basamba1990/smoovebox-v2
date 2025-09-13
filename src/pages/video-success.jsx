import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import QRCode from 'qrcode.react';

const VideoSuccess = () => {
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = useSupabaseClient();
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetchVideoData();
    }
  }, [id]);

  const fetchVideoData = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, storage_path, user_id, created_at')
        .eq('id', id)
        .single();

      if (error) throw error;
      setVideoData(data);
    } catch (error) {
      console.error('Erreur récupération vidéo:', error);
      setError('Impossible de charger les données de la vidéo.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(videoUrl);
    alert('Lien copié dans le presse-papiers !');
  };

  const shareByEmail = () => {
    const shareText = `Regardez ma vidéo sur SpotBulle : ${videoUrl}`;
    window.open(`mailto:?body=${encodeURIComponent(shareText)}`, '_blank');
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#38b2ac', fontSize: '18px' }}>Chargement...</p>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ backgroundColor: '#fed7d7', color: '#9b2c2c', padding: '15px', borderRadius: '8px' }}>
          {error || 'Vidéo non trouvée. Veuillez réessayer.'}
        </div>
      </div>
    );
  }

  const videoUrl = `${window.location.origin}/video/${videoData.id}`;

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <h1 style={{ color: '#38b2ac', fontSize: '28px', marginBottom: '20px' }}>
        Votre vidéo est en ligne !
      </h1>

      <div style={{
        margin: '30px 0',
        padding: '20px',
        border: '2px solid #38b2ac',
        borderRadius: '12px',
        backgroundColor: '#f7fafc',
      }}>
        <h3 style={{ color: '#2d3748', fontSize: '20px' }}>Partagez votre vidéo avec ce QR code</h3>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
          <QRCode value={videoUrl} size={200} fgColor="#38b2ac" />
        </div>
        <p style={{ fontSize: '14px', color: '#718096' }}>
          Scannez ce QR code pour accéder à votre vidéo
        </p>
      </div>

      <div style={{ margin: '20px 0' }}>
        <p style={{ color: '#2d3748', marginBottom: '10px' }}>Lien direct vers votre vidéo :</p>
        <input
          type="text"
          value={videoUrl}
          readOnly
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            marginBottom: '10px',
            backgroundColor: '#edf2f7',
          }}
        />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={copyToClipboard}
            style={{
              backgroundColor: '#edf2f7',
              color: '#2d3748',
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #cbd5e0',
              cursor: 'pointer',
            }}
          >
            Copier le lien
          </button>
          <button
            onClick={shareByEmail}
            style={{
              backgroundColor: '#38b2ac',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Partager par email
          </button>
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <button
          onClick={() => router.push('/directory')}
          style={{
            backgroundColor: '#f6ad55',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Explorer l'annuaire des participants
        </button>
      </div>
    </div>
  );
};

export default VideoSuccess;
