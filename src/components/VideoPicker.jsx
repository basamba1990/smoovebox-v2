import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { useVideos } from '../hooks/useVideos.js';

const VideoPicker = ({ onChange, selectedVideo }) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  // ✅ Use React Query hook for videos
  const { data: allVideos = [], isLoading: loading, error: videosError } = useVideos();

  // Filter videos to only show the ones with valid status for picker
  const videos = allVideos.filter(video => 
    ['uploaded', 'processed', 'published', 'completed', 'analyzed'].includes(video.status)
  );

  // Convert query error to string for display
  const error = videosError ? (videosError.message || 'Erreur lors du chargement des vidéos') : null;

  // Show toast error when query fails
  React.useEffect(() => {
    if (videosError) {
      toast.error('Erreur lors du chargement des vidéos');
    }
  }, [videosError]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'uploaded': 'Téléversée',
      'processed': 'Traitée',
      'published': 'Publiée',
      'completed': 'Terminée',
      'processing': 'En traitement'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="mb-4">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Chargement des vidéos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4">
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="text-blue-500 text-sm underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mb-4">
        <p className="text-gray-500 text-sm">Connectez-vous pour voir vos vidéos</p>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <select
        value={selectedVideo || ''}
        onChange={(e) => {
          const videoId = e.target.value;
          onChange(videoId);
        }}
        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        <option value="">
          {videos.length === 0 ? 'Aucune vidéo disponible' : 'Choisir une vidéo (optionnel)'}
        </option>
        {videos.map((video) => (
          <option key={video.id} value={video.id}>
            {video.title || `Vidéo ${video.id.slice(0, 8)}`} - {getStatusLabel(video.status)} ({formatDate(video.created_at)})
          </option>
        ))}
      </select>
      
      {videos.length === 0 && user && (
        <p className="text-gray-500 text-xs mt-2">
          Aucune vidéo disponible. Uploader une vidéo depuis votre tableau de bord.
        </p>
      )}
      
      {selectedVideo && (
        <p className="text-green-600 text-xs mt-2">
          ✓ Vidéo sélectionnée pour cette demande
        </p>
      )}
    </div>
  );
};

export default VideoPicker;
