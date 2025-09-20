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
          console.log('Utilisateur non authentifié, pas de vidéos à charger');
          toast.error('Veuillez vous connecter pour voir vos vidéos.');
          return;
        }

        console.log('Récupération des vidéos pour:', user.id);
        const { data, error } = await supabase
          .from('videos')
          .select('id, title, created_at, status')
          .eq('user_id', user.id)
          .in('status', ['uploaded', 'processed', 'published'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Erreur récupération vidéos:', error);
          throw error;
        }

        console.log("Vidéos trouvées :", data);
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
        <p className="text-gray-400">Aucune vidéo disponible. <button onClick={() => window.location.reload()} className="text-blue-400 underline">Recharger</button></p>
      ) : (
        <select
          onChange={(e) => {
            const value = e.target.value;
            console.log('Vidéo sélectionnée:', value);
            onChange(value);
          }}
          className="w-full p-2 border rounded bg-white/10 text-white"
          defaultValue=""
        >
          <option value="" disabled>
            Choisir une vidéo
          </option>
          {videos.map((video) => (
            <option key={video.id} value={video.id}>
              {video.title || `Vidéo ${video.id.slice(0, 6)}`} – {video.status} ({new Date(video.created_at).toLocaleDateString()})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default VideoPicker;
