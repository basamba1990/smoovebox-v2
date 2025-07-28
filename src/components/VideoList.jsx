// src/components/VideoList.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getStatusLabel, getStatusClass } from '../constants/videoStatus.js';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const VideoList = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    
    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        setVideos(data || []);
      } catch (err) {
        console.error('Erreur lors de la récupération des vidéos:', err);
        setError('Impossible de charger vos vidéos. Veuillez réessayer plus tard.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchVideos();
    
    // Abonnement aux changements en temps réel
    const subscription = supabase
      .channel('videos_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'videos',
          filter: `user_id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('Changement détecté:', payload);
          
          // Mettre à jour la liste des vidéos en fonction du type d'événement
          if (payload.eventType === 'INSERT') {
            setVideos(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setVideos(prev => prev.map(video => 
              video.id === payload.new.id ? payload.new : video
            ));
          } else if (payload.eventType === 'DELETE') {
            setVideos(prev => prev.filter(video => video.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  if (loading) {
    return <div className="flex justify-center p-8">Chargement de vos vidéos...</div>;
  }
  
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }
  
  if (videos.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Vous n'avez pas encore uploadé de vidéos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Vos vidéos</h2>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {videos.map(video => (
          <div 
            key={video.id} 
            className="bg-white rounded-lg shadow overflow-hidden border border-gray-200"
          >
            <div className="relative aspect-video bg-gray-100">
              {video.file_path ? (
                <video 
                  src={video.file_path} 
                  className="w-full h-full object-cover" 
                  controls={video.status === 'published'}
                  poster={video.thumbnail_url || undefined}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400">Vidéo en cours de traitement</p>
                </div>
              )}
              
              <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                video.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                video.status === 'published' ? 'bg-green-100 text-green-800' :
                video.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getStatusLabel(video.status)}
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-medium text-lg mb-1 truncate">{video.title}</h3>
              <p className="text-sm text-gray-500 mb-3">
                {video.created_at && formatDistanceToNow(new Date(video.created_at), { 
                  addSuffix: true,
                  locale: fr
                })}
              </p>
              
              {video.status === 'published' && (
                <div className="mt-2">
                  <a 
                    href={`/videos/${video.id}`} 
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Voir les détails
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoList;
