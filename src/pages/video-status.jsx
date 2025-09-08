import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import {
  VIDEO_STATUS,
  getStatusLabel,
  getStatusClass,
  isProcessingStatus,
  isCompletedStatus,
  isErrorStatus
} from '../constants/videoStatus';

const VideoStatus = () => {
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const supabase = useSupabaseClient();
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      checkVideoStatus();
      
      // Vérifier le statut toutes les 5 secondes
      const interval = setInterval(checkVideoStatus, 5000);
      
      return () => clearInterval(interval);
    }
  }, [id]);

  const checkVideoStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      setVideoData(data);
      
      // Mettre à jour la barre de progression en fonction du statut
      if (isProcessingStatus(data.status)) {
        setProgress(50);
      } else if (data.status === VIDEO_STATUS.TRANSCRIBING) {
        setProgress(75);
      } else if (isCompletedStatus(data.status)) {
        setProgress(100);
        // Rediriger vers la page de succès quand c'est terminé
        setTimeout(() => {
          router.push(`/video-success?id=${id}`);
        }, 2000);
      } else if (isErrorStatus(data.status)) {
        setProgress(0);
      } else {
        setProgress(25); // Statut par défaut (uploaded/draft)
      }
      
    } catch (error) {
      console.error('Erreur récupération statut vidéo:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Chargement...</div>;
  }

  if (!videoData) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Vidéo non trouvée</div>;
  }

  // Utiliser les fonctions utilitaires pour obtenir le libellé et la classe du statut
  const statusLabel = getStatusLabel(videoData.status);
  const statusClass = getStatusClass(videoData.status);

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '600px', 
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#38b2ac' }}>Traitement de votre vidéo</h1>
      
      <div style={{ 
        margin: '30px 0', 
        padding: '20px', 
        border: '2px solid #38b2ac',
        borderRadius: '12px'
      }}>
        <h3>Statut: {statusLabel}</h3>
        
        {/* Barre de progression */}
        <div style={{ 
          width: '100%', 
          backgroundColor: '#e2e8f0', 
          borderRadius: '10px',
          margin: '20px 0'
        }}>
          <div style={{ 
            width: `${progress}%`, 
            height: '20px', 
            backgroundColor: '#38b2ac',
            borderRadius: '10px',
            transition: 'width 0.5s ease-in-out'
          }}></div>
        </div>
        
        <p style={{ fontSize: '14px', color: '#718096' }}>
          {getStatusDescription(videoData.status)}
        </p>
      </div>
      
      {isErrorStatus(videoData.status) && (
        <div style={{ 
          backgroundColor: '#fed7d7', 
          color: '#c53030',
          padding: '15px',
          borderRadius: '8px',
          margin: '20px 0'
        }}>
          <p>Une erreur est survenue lors du traitement de votre vidéo.</p>
          <button
            onClick={() => router.push('/record-video')}
            style={{
              backgroundColor: '#e53e3e',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
};

// Fonction helper pour obtenir la description du statut
function getStatusDescription(status) {
  const normalizedStatus = status?.toLowerCase();
  
  const descriptionMap = {
    'draft': 'Votre vidéo a été uploadée avec succès.',
    'uploaded': 'Votre vidéo a été uploadée avec succès.',
    'processing': 'Préparation de votre vidéo pour la transcription.',
    'transcribing': 'Notre IA est en train de transcrire votre vidéo.',
    'transcribed': 'Transcription terminée. Analyse en cours...',
    'analyzing': 'Analyse en cours par notre IA...',
    'published': 'Traitement terminé! Redirection...',
    'analyzed': 'Traitement terminé! Redirection...',
    'failed': 'Une erreur est survenue pendant le traitement.',
    'error': 'Une erreur est survenue pendant le traitement.'
  };
  
  return descriptionMap[normalizedStatus] || 'Statut inconnu';
}

export default VideoStatus;
