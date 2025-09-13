import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

const Directory = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    fetchVideos();
    fetchAvailableTags();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, user_id, created_at, tags, status')
        .eq('status', 'published') // N'afficher que les vidéos publiées
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data);
    } catch (error) {
      console.error('Erreur récupération vidéos:', error);
      setError('Impossible de charger l\'annuaire.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTags = async () => {
    try {
      // Récupérer tous les tags distincts depuis la table videos
      const { data, error } = await supabase
        .from('videos')
        .select('tags')
        .eq('status', 'published');

      if (error) throw error;
      const tags = [...new Set(data.flatMap(video => video.tags || []))];
      setAvailableTags(tags);
    } catch (error) {
      console.error('Erreur récupération tags:', error);
    }
  };

  const handleFilterChange = async (tag) => {
    setFilter(tag);
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, description, user_id, created_at, tags, status')
        .eq('status', 'published')
        .contains('tags', [tag]);

      if (error) throw error;
      setVideos(data);
    } catch (error) {
      console.error('Erreur filtrage vidéos:', error);
      setError('Erreur lors du filtrage des vidéos.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (videoId, targetUserId) => {
    if (!user) {
      alert('Veuillez vous connecter pour initier une mise en relation.');
      router.push('/auth');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('match-profiles', {
        body: { user_id: user.id, target_user_id: targetUserId, video_id: videoId },
      });

      if (error) throw error;
      alert('Mise en relation initiée avec succès !');
    } catch (error) {
      console.error('Erreur mise en relation:', error);
      alert('Erreur lors de la mise en relation.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#38b2ac' }}>Chargement de l'annuaire...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', minHeight: '100vh' }}>
        <div style={{ backgroundColor: '#fed7d7', color: '#9b2c2c', padding: '15px', borderRadius: '8px' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: '100vh',
    }}>
      <h1 style={{ color: '#38b2ac', fontSize: '28px', marginBottom: '20px' }}>
        Annuaire des Participants
      </h1>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#2d3748', fontSize: '18px' }}>Filtrer par passion :</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
          <button
            onClick={() => { setFilter(''); fetchVideos(); }}
            style={{
              backgroundColor: filter === '' ? '#38b2ac' : '#edf2f7',
              color: filter === '' ? 'white' : '#2d3748',
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Tous
          </button>
          {availableTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleFilterChange(tag)}
              style={{
                backgroundColor: filter === tag ? '#38b2ac' : '#edf2f7',
                color: filter === tag ? 'white' : '#2d3748',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px',
      }}>
        {videos.map(video => (
          <div key={video.id} style={{
            backgroundColor: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '15px',
          }}>
            <h3 style={{ color: '#2d3748', fontSize: '18px', marginBottom: '10px' }}>
              {video.title}
            </h3>
            <p style={{ color: '#718096', fontSize: '14px', marginBottom: '10px' }}>
              {video.description || 'Aucune description'}
            </p>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: '#38b2ac', fontSize: '14px' }}>
                Tags: {video.tags?.join(', ') || 'Aucun tag'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => router.push(`/video/${video.id}`)}
                style={{
                  backgroundColor: '#38b2ac',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Voir la vidéo
              </button>
              <button
                onClick={() => handleConnect(video.id, video.user_id)}
                style={{
                  backgroundColor: '#f6ad55',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Connecter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Directory;
