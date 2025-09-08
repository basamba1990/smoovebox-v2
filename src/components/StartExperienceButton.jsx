import { useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

const StartExperienceButton = () => {
  const [loading, setLoading] = useState(false);
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  const handleStartExperience = async () => {
    if (!user) {
      alert('Veuillez vous connecter pour démarrer l\'expérience');
      router.push('/auth');
      return;
    }

    setLoading(true);
    
    try {
      // Vérifier si l'utilisateur a déjà une vidéo en cours
      const { data: existingVideos, error } = await supabase
        .from('videos')
        .select('id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (existingVideos && existingVideos.length > 0) {
        const latestVideo = existingVideos[0];
        
        // Rediriger vers la page appropriée selon le statut
        if (['uploaded', 'processing', 'transcribing'].includes(latestVideo.status)) {
          router.push(`/video-status?id=${latestVideo.id}`);
        } else if (['transcribed', 'analyzed'].includes(latestVideo.status)) {
          router.push(`/video-success?id=${latestVideo.id}`);
        } else {
          router.push('/record-video');
        }
      } else {
        // Aucune vidéo existante, démarrer une nouvelle expérience
        router.push('/record-video');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue lors du démarrage de l\'expérience');
      router.push('/record-video');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleStartExperience}
      disabled={loading}
      className="start-experience-btn"
      style={{
        backgroundColor: '#38b2ac',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '8px',
        border: 'none',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}
    >
      {loading ? (
        <>
          <span>Chargement...</span>
          <div className="spinner"></div>
        </>
      ) : (
        <>
          <span>🎤</span>
          <span>Démarrer l'expérience</span>
        </>
      )}
    </button>
  );
};

export default StartExperienceButton;
