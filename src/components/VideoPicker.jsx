// src/components/VideoPicker.jsx
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';

const VideoPicker = ({ onChange }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        if (!user) {
          toast.error('Veuillez vous connecter pour voir vos vidéos.');
          return;
        }

        const { data, error } = await supabase
          .from('videos')
          .select('id, title, created_at')
          .eq('user_id', user.id)
          .eq('status', 'uploaded')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setVideos(data || []);
      } catch (err) {
        console.error('Erreur récupération vidéos:', err);
        toast.error('Erreur lors du chargement des vidéos.');
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [supabase, user]);

  return (
    <div className="mb-6">
      <label className="text-lg text-white mb-2 block">Sélectionner une vidéo :</label>
      {loading ? (
        <p className="text-gray-400">Chargement des vidéos...</p>
      ) : videos.length === 0 ? (
        <p className="text-gray-400">Aucune vidéo disponible.</p>
      ) : (
        <select
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border rounded bg-white/10 text-white"
          defaultValue=""
        >
          <option value="" disabled>
            Choisir une vidéo
          </option>
          {videos.map((video) => (
            <option key={video.id} value={video.id}>
              {video.title} ({new Date(video.created_at).toLocaleDateString()})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default VideoPicker;
