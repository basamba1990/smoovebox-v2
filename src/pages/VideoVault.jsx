import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button-enhanced.jsx';
import { toast } from 'sonner';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';

const VideoVault = ({ user, profile, onSignOut }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
  const [filter, setFilter] = useState('all'); // 'all', 'spotbulle', 'external', 'technical'

  useEffect(() => {
    loadVideos();
  }, [user]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      
      // Charger les vidéos SpotBulle
      const { data: spotbulleVideos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // ✅ SIMULATION : Vidéos externes (à intégrer avec la table external_videos plus tard)
      const externalVideos = [
        {
          id: 'external-1',
          title: 'But incroyable - Match du 15/10',
          type: 'external',
          category: 'technical',
          thumbnail_url: '/placeholder-technical.jpg',
          duration: 45,
          file_size: 15728640,
          created_at: '2024-01-15T10:30:00Z',
          source: 'phone_upload',
          tags: ['football', 'but', 'technique'],
          performance_score: 85
        },
        {
          id: 'external-2', 
          title: 'Entraînement parcours technique',
          type: 'external',
          category: 'technical',
          thumbnail_url: '/placeholder-training.jpg',
          duration: 120,
          file_size: 31457280,
          created_at: '2024-01-10T16:45:00Z',
          source: 'phone_upload',
          tags: ['entraînement', 'parcours', 'dribble'],
          performance_score: 72
        }
      ];

      const allVideos = [
        ...(spotbulleVideos || []).map(v => ({ ...v, type: 'spotbulle' })),
        ...externalVideos
      ];

      setVideos(allVideos);
    } catch (error) {
      console.error('Erreur chargement vidéos:', error);
      toast.error('Erreur lors du chargement des vidéos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setUploading(true);
    
    try {
      for (const file of files) {
        // Vérifier le type de fichier
        if (!file.type.startsWith('video/')) {
          toast.error(`Le fichier ${file.name} n'est pas une vidéo`);
          continue;
        }

        // Vérifier la taille (max 100MB)
        if (file.size > 100 * 1024 * 1024) {
          toast.error(`La vidéo ${file.name} est trop volumineuse (max 100MB)`);
          continue;
        }

        // Upload vers Supabase Storage
        const fileName = `external-${Date.now()}-${file.name}`;
        const filePath = `${user.id}/external/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Récupérer l'URL publique
        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(filePath);

        // ✅ À IMPLÉMENTER : Insérer dans la table external_videos
        toast.success(`Vidéo ${file.name} uploadée avec succès !`);
      }

      // Recharger la liste
      await loadVideos();
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error('Erreur lors de l\'upload de la vidéo');
    } finally {
      setUploading(false);
      // Reset l'input file
      event.target.value = '';
    }
  };

  const toggleVideoSelection = (videoId) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const compareVideos = () => {
    if (selectedVideos.length !== 2) {
      toast.error('Sélectionnez exactement 2 vidéos pour comparer');
      return;
    }
    // ✅ À IMPLÉMENTER : Ouvrir une modal de comparaison
    toast.info('Fonctionnalité de comparaison à venir !');
  };

  const filteredVideos = videos.filter(video => {
    if (filter === 'all') return true;
    if (filter === 'spotbulle') return video.type === 'spotbulle';
    if (filter === 'external') return video.type === 'external';
    if (filter === 'technical') return video.category === 'technical';
    return true;
  });

  const getVideoStats = () => {
    const spotbulleCount = videos.filter(v => v.type === 'spotbulle').length;
    const externalCount = videos.filter(v => v.type === 'external').length;
    const totalDuration = videos.reduce((sum, video) => sum + (video.duration || 0), 0);
    
    return { spotbulleCount, externalCount, totalDuration };
  };

  const stats = getVideoStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement de votre coffre-fort...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        {/* En-tête du coffre-fort */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">📁 Mon Coffre-fort Vidéo</h1>
              <p className="text-gray-600">
                Gère toutes tes vidéos SpotBulle et imports externes en un seul endroit
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Bouton d'upload */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  disabled={uploading}
                  className="bg-green-600 hover:bg-green-700 px-6 py-3"
                >
                  {uploading ? '📤 Upload...' : '📱 Importer vidéo'}
                </Button>
              </label>
            </div>
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-primary-600">{videos.length}</div>
              <div className="text-gray-600">Total vidéos</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">{stats.spotbulleCount}</div>
              <div className="text-gray-600">Vidéos SpotBulle</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-green-600">{stats.externalCount}</div>
              <div className="text-gray-600">Vidéos externes</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(stats.totalDuration / 60)}min
              </div>
              <div className="text-gray-600">Durée totale</div>
            </div>
          </div>
        </div>

        {/* Contrôles */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              {/* Filtres */}
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">Toutes les vidéos</option>
                <option value="spotbulle">SpotBulle</option>
                <option value="external">Vidéos externes</option>
                <option value="technical">Gestes techniques</option>
              </select>

              {/* Mode d'affichage */}
              <div className="flex border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'bg-white'}`}
                >
                  ⬜ Grille
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'bg-white'}`}
                >
                  ☰ Liste
                </button>
              </div>
            </div>

            {/* Actions de comparaison */}
            {selectedVideos.length > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  {selectedVideos.length} vidéo(s) sélectionnée(s)
                </span>
                <Button
                  onClick={compareVideos}
                  disabled={selectedVideos.length !== 2}
                  variant="outline"
                  className="border-blue-500 text-blue-600"
                >
                  📊 Comparer
                </Button>
                <Button
                  onClick={() => setSelectedVideos([])}
                  variant="outline"
                  className="border-gray-500 text-gray-600"
                >
                  ✕ Annuler
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Liste des vidéos */}
        {filteredVideos.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">🎥</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Votre coffre-fort est vide</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' 
                ? "Commencez par enregistrer votre première vidéo ou importer des vidéos externes"
                : "Aucune vidéo ne correspond à ce filtre"}
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button className="bg-primary-600 hover:bg-primary-700 px-6 py-3">
                📱 Importer ma première vidéo
              </Button>
            </label>
          </div>
        ) : viewMode === 'grid' ? (
          // Affichage Grille
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map(video => (
              <div
                key={video.id}
                className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all duration-200 ${
                  selectedVideos.includes(video.id) ? 'ring-2 ring-primary-500 shadow-md' : 'hover:shadow-md'
                }`}
              >
                <div className="aspect-video bg-gray-200 relative">
                  {video.thumbnail_url ? (
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-4xl">
                        {video.type === 'spotbulle' ? '🎤' : '📹'}
                      </span>
                    </div>
                  )}
                  
                  {/* Badge type */}
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${
                    video.type === 'spotbulle' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-green-500 text-white'
                  }`}>
                    {video.type === 'spotbulle' ? 'SpotBulle' : 'Externe'}
                  </div>

                  {/* Checkbox sélection */}
                  <div className="absolute top-2 right-2">
                    <input
                      type="checkbox"
                      checked={selectedVideos.includes(video.id)}
                      onChange={() => toggleVideoSelection(video.id)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>

                  {/* Durée */}
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-sm">
                      {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {video.title}
                  </h3>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <span>
                      {new Date(video.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    {video.performance_score && (
                      <span className={`px-2 py-1 rounded-full ${
                        video.performance_score >= 80 ? 'bg-green-100 text-green-800' :
                        video.performance_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        Score: {video.performance_score}%
                      </span>
                    )}
                  </div>

                  {video.tags && video.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {video.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex space-x-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      👁️ Voir
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      📊 Analyser
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Affichage Liste
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vidéo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durée
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredVideos.map(video => (
                  <tr key={video.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedVideos.includes(video.id)}
                          onChange={() => toggleVideoSelection(video.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-3"
                        />
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            {video.type === 'spotbulle' ? '🎤' : '📹'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{video.title}</div>
                            {video.tags && (
                              <div className="flex space-x-1 mt-1">
                                {video.tags.slice(0, 2).map(tag => (
                                  <span key={tag} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        video.type === 'spotbulle' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {video.type === 'spotbulle' ? 'SpotBulle' : 'Externe'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {video.performance_score ? (
                        <div className={`w-16 text-center px-2 py-1 rounded-full text-xs font-medium ${
                          video.performance_score >= 80 ? 'bg-green-100 text-green-800' :
                          video.performance_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {video.performance_score}%
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(video.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          👁️
                        </Button>
                        <Button size="sm" variant="outline">
                          📊
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section d'aide */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-3">💡</span>
            Comment utiliser votre coffre-fort ?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 p-4 rounded-lg border">
              <div className="text-2xl mb-2">📱</div>
              <h4 className="font-semibold mb-2">Importez vos vidéos</h4>
              <p className="text-sm text-gray-600">
                Téléchargez vos vidéos de matchs, gestes techniques ou entraînements depuis votre téléphone
              </p>
            </div>
            <div className="bg-white/80 p-4 rounded-lg border">
              <div className="text-2xl mb-2">📊</div>
              <h4 className="font-semibold mb-2">Suivez votre progression</h4>
              <p className="text-sm text-gray-600">
                Comparez vos performances dans le temps et identifiez vos axes d'amélioration
              </p>
            </div>
            <div className="bg-white/80 p-4 rounded-lg border">
              <div className="text-2xl mb-2">👥</div>
              <h4 className="font-semibold mb-2">Partagez avec votre club</h4>
              <p className="text-sm text-gray-600">
                Montrez vos meilleures actions à vos coachs et coéquipiers (optionnel)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoVault;
