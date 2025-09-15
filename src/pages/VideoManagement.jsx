import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import './VideoManagement.css';

const VideoManagement = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur lors de la récupération des vidéos:', error);
        setError('Impossible de récupérer les vidéos.');
        return;
      }

      setVideos(data || []);
    } catch (err) {
      console.error('Exception inattendue:', err);
      setError('Une erreur inattendue s\'est produite.');
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_video_stats', { _user_id: user.id })
        .single();

      if (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        setError('Impossible de récupérer les statistiques.');
        return;
      }

      setStats(data);
    } catch (err) {
      console.error('Exception inattendue:', err);
      setError('Une erreur inattendue s\'est produite.');
    }
  };

  const refreshStats = async () => {
    try {
      const response = await fetch('https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/refresh-user-video-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      setStats(result.stats);
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des statistiques:', err);
      setError('Impossible de rafraîchir les statistiques.');
    }
  };

  const handleTranscribe = async (videoId) => {
    try {
      const response = await fetch('https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/transcribe-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ video_id: videoId }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('Transcription réussie:', result);
      await refreshStats();
      await fetchVideos();
    } catch (err) {
      console.error('Erreur lors de la transcription:', err);
      setError('Impossible de transcrire la vidéo.');
    }
  };

  const handleDelete = async (videoId) => {
    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Erreur lors de la suppression de la vidéo:', error);
        setError('Impossible de supprimer la vidéo.');
        return;
      }

      await supabase.storage
        .from('videos')
        .remove([`${user.id}/${videoId}.mp4`]);

      await refreshStats();
      await fetchVideos();
    } catch (err) {
      console.error('Erreur inattendue lors de la suppression:', err);
      setError('Une erreur inattendue s\'est produite.');
    }
  };

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([fetchVideos(), fetchStats()])
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (!user) {
    return <div>Veuillez vous connecter pour gérer vos vidéos.</div>;
  }

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="video-management">
      <h2>Gestion des vidéos</h2>
      {error && <div className="error">{error}</div>}
      {stats && (
        <div className="stats">
          <h3>Statistiques</h3>
          <p>Total des vidéos: {stats.total_videos}</p>
          <p>Durée totale: {stats.total_duration} secondes</p>
          <p>Dernier upload: {stats.last_upload ? new Date(stats.last_upload).toLocaleString() : 'N/A'}</p>
          <p>Total des vues: {stats.total_views}</p>
          <p>Total des likes: {stats.total_likes}</p>
          <p>Vidéos transcrites: {stats.transcribed_videos}</p>
          <button onClick={refreshStats}>Rafraîchir les statistiques</button>
        </div>
      )}
      <h3>Vos vidéos</h3>
      {videos.length === 0 ? (
        <p>Aucune vidéo disponible.</p>
      ) : (
        <ul>
          {videos.map((video) => (
            <li key={video.id}>
              <p>{video.title || 'Sans titre'}</p>
              <p>Statut: {video.status}</p>
              <button onClick={() => handleTranscribe(video.id)} disabled={video.status === 'transcribed'}>
                {video.status === 'transcribed' ? 'Transcrite' : 'Transcrire'}
              </button>
              <button onClick={() => handleDelete(video.id)}>Supprimer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default VideoManagement;
