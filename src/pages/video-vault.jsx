import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button-enhanced.jsx';
import { toast } from 'sonner';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';

const VideoVault = ({ user, profile, onSignOut, onVideoAdded }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  // ✅ CORRECTION : Utilisation de useCallback pour éviter les re-rendus infinis
  const loadVideos = useCallback(async () => {
    if (!user) {
      console.log('❌ Aucun utilisateur connecté');
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Chargement des vidéos pour:', user.id);
      
      // Charger les vidéos SpotBulle
      const { data: spotbulleVideos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        throw error;
      }

      console.log('✅ Vidéos SpotBulle chargées:', spotbulleVideos?.length || 0);

      // ✅ SIMULATION : Vidéos externes
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
        ...(spotbulleVideos || []).map(v => ({ 
          ...v, 
          type: 'spotbulle',
          // ✅ Assurer que toutes les vidéos ont un URL pour l'affichage
          video_url: v.video_url || v.public_url || `/api/videos/${v.id}`
        })),
        ...externalVideos
      ];

      setVideos(allVideos);
      setDebugInfo(`Chargé: ${allVideos.length} vidéos (${spotbulleVideos?.length || 0} SpotBulle, ${externalVideos.length} externes)`);
      
    } catch (error) {
      console.error('❌ Erreur chargement vidéos:', error);
      setDebugInfo(`Erreur: ${error.message}`);
      toast.error('Erreur lors du chargement des vidéos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('🎯 Initialisation VideoVault - User:', user?.id);
    loadVideos();
  }, [loadVideos]);

  // ✅ CORRECTION : Gestion robuste de l'upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length || !user) {
      toast.error('Aucun fichier sélectionné ou utilisateur non connecté');
      return;
    }

    setUploading(true);
    
    try {
      // Vérifier la session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Utilisateur non authentifié');
      }

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

        console.log('📤 Upload du fichier:', file.name, file.size);

        // Upload vers Supabase Storage
        const fileName = `external-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        const filePath = `${user.id}/external/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Erreur upload storage:', uploadError);
          throw new Error(`Erreur upload: ${uploadError.message}`);
        }

        // Récupérer l'URL publique
        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(filePath);

        console.log('✅ Fichier uploadé:', urlData.publicUrl);

        // ✅ CRÉATION du enregistrement vidéo dans la table videos
        const videoInsertData = {
          title: file.name,
          description: `Vidéo importée - ${file.name}`,
          file_path: filePath,
          storage_path: filePath,
          file_size: file.size,
          duration: null, // À déterminer si possible
          user_id: user.id,
          status: 'uploaded',
          type: 'external',
          public_url: urlData.publicUrl,
          video_url: urlData.publicUrl,
          format: file.type.split('/')[1],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: videoData, error: insertError } = await supabase
          .from('videos')
          .insert(videoInsertData)
          .select()
          .single();

        if (insertError) {
          console.error('❌ Erreur insertion vidéo:', insertError);
          throw new Error(`Erreur création vidéo: ${insertError.message}`);
        }

        console.log('✅ Vidéo créée en base:', videoData.id);
        toast.success(`Vidéo ${file.name} uploadée avec succès !`);
      }

      // Recharger la liste
      await loadVideos();
      
      // Notifier le parent
      if (onVideoAdded) {
        onVideoAdded();
      }

    } catch (error) {
      console.error('❌ Erreur upload complète:', error);
      toast.error(`Échec de l'upload: ${error.message}`);
    } finally {
      setUploading(false);
      // Reset l'input file
      event.target.value = '';
    }
  };

  // ✅ CORRECTION : Fonctions pour les boutons qui étaient manquantes
  const handleViewVideo = (video) => {
    console.log('👁️ Voir vidéo:', video);
    
    if (video.video_url || video.public_url) {
      // Ouvrir dans un nouvel onglet ou modal
      const videoUrl = video.video_url || video.public_url;
      window.open(videoUrl, '_blank');
      toast.info(`Ouverture de: ${video.title}`);
    } else {
      toast.error('URL vidéo non disponible');
    }
  };

  const handleAnalyzeVideo = (video) => {
    console.log('📊 Analyser vidéo:', video);
    setActionLoading(video.id);
    
    // Simuler une analyse
    setTimeout(() => {
      setActionLoading(null);
      toast.success(`Analyse démarrée pour: ${video.title}`);
      
      // ✅ Redirection vers la page d'analyse si disponible
      if (video.id && !video.id.startsWith('external-')) {
        // navigate(`/video-analysis/${video.id}`);
        toast.info('Redirection vers analyse...');
      }
    }, 1000);
  };

  const toggleVideoSelection = (videoId) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  // ✅ CORRECTION : Fonction de comparaison améliorée
  const compareVideos = () => {
    if (selectedVideos.length !== 2) {
      toast.error('Sélectionnez exactement 2 vidéos pour comparer');
      return;
    }
    
    setActionLoading('comparison');
    try {
      const video1 = videos.find(v => v.id === selectedVideos[0]);
      const video2 = videos.find(v => v.id === selectedVideos[1]);
      
      console.log('🔍 Comparaison entre:', video1?.title, 'et', video2?.title);
      toast.success(`Comparaison lancée entre "${video1?.title}" et "${video2?.title}"`);
      
      // Ici vous pouvez ouvrir un modal de comparaison
      // setShowComparisonModal(true);
      
    } catch (error) {
      console.error('Erreur comparaison:', error);
      toast.error('Erreur lors de la comparaison');
    } finally {
      setActionLoading(null);
    }
  };

  // ✅ CORRECTION : Fonction pour réinitialiser la sélection
  const clearSelection = () => {
    setSelectedVideos([]);
    toast.info('Sélection annulée');
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
            {debugInfo && <p className="mt-2 text-sm text-gray-500">{debugInfo}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Debug info */}
        {debugInfo && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">🔍 {debugInfo}</p>
          </div>
        )}

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
                  {uploading ? '📤 Upload en cours...' : '📱 Importer vidéo'}
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
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  className={`p-2 px-4 text-sm font-medium ${
                    viewMode === 'grid' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition-colors`}
                >
                  ⬜ Grille
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 px-4 text-sm font-medium ${
                    viewMode === 'list' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  } transition-colors`}
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
                  disabled={selectedVideos.length !== 2 || actionLoading === 'comparison'}
                  variant="outline"
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                >
                  {actionLoading === 'comparison' ? '🔄...' : '📊 Comparer'}
                </Button>
                <Button
                  onClick={clearSelection}
                  variant="outline"
                  className="border-gray-500 text-gray-600 hover:bg-gray-50"
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
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleViewVideo(video)}
                      disabled={actionLoading === video.id}
                    >
                      {actionLoading === video.id ? '🔄' : '👁️ Voir'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleAnalyzeVideo(video)}
                      disabled={actionLoading === video.id || video.id.startsWith('external-')}
                    >
                      {actionLoading === video.id ? '🔄' : '📊 Analyser'}
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
                    Sélection
                  </th>
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
                      <input
                        type="checkbox"
                        checked={selectedVideos.includes(video.id)}
                        onChange={() => toggleVideoSelection(video.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
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
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewVideo(video)}
                          disabled={actionLoading === video.id}
                        >
                          {actionLoading === video.id ? '🔄' : '👁️'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAnalyzeVideo(video)}
                          disabled={actionLoading === video.id || video.id.startsWith('external-')}
                        >
                          {actionLoading === video.id ? '🔄' : '📊'}
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
