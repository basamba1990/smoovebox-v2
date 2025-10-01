import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import VideoPicker from '../components/VideoPicker.jsx';

const Directory = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [connecting, setConnecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [existingConnections, setExistingConnections] = useState(new Set());
  const [selectedVideos, setSelectedVideos] = useState({}); // { userId: videoId }

  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  // Récupération des profils ET des connexions existantes
  useEffect(() => {
    fetchUsers();
    if (user) {
      fetchExistingConnections();
    }
  }, [filter, searchTerm, user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('profiles')
        .select(`
          id, full_name, bio, location, skills, avatar_url, age, interests, 
          is_creator, is_football_fan, is_adult,
          questionnaire_responses (
            disc_color, preferred_activities, work_preferences, current_talent,
            dream_description, spotbulle_needs
          )
        `);

      // Appliquer les filtres
      if (filter === 'creators') {
        query = query.eq('is_creator', true);
      } else if (filter === 'football') {
        query = query.eq('is_football_fan', true);
      } else if (filter === 'adults') {
        query = query.eq('is_adult', true);
      }

      // Appliquer la recherche
      if (searchTerm) {
        query = query.ilike('full_name', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError(`Erreur chargement annuaire : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingConnections = async () => {
    try {
      // Récupérer les connexions existantes de l'utilisateur
      const { data, error } = await supabase
        .from('connections')
        .select('target_id, status')
        .eq('requester_id', user.id);

      if (error) throw error;

      const ids = new Set(data.map(connection => connection.target_id));
      setExistingConnections(ids);
    } catch (err) {
      console.error('Erreur fetchExistingConnections:', err.message);
    }
  };

  const handleVideoSelect = (targetUserId, videoId) => {
    setSelectedVideos(prev => ({
      ...prev,
      [targetUserId]: videoId
    }));
  };

  const handleConnect = async (targetUserId) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour initier une mise en relation.');
      navigate('/auth');
      return;
    }

    if (existingConnections.has(targetUserId)) {
      toast.info('Demande déjà envoyée');
      return;
    }

    if (connecting) return;

    setConnecting(true);

    try {
      const videoId = selectedVideos[targetUserId] || null;

      const { error } = await supabase
        .from('connections')
        .insert({
          requester_id: user.id,
          target_id: targetUserId,
          video_id: videoId,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Mettre à jour l'état des connexions existantes
      setExistingConnections(prev => new Set([...prev, targetUserId]));
      toast.success('Demande de mise en relation envoyée !');
    } catch (err) {
      console.error('Erreur:', err);
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const getConnectionStatus = (targetUserId) => {
    if (!user) return 'not_connected';
    if (existingConnections.has(targetUserId)) return 'pending';
    return 'can_connect';
  };

  const renderSkills = (skills) => {
    if (!skills) return null;
    if (Array.isArray(skills)) {
      return skills.map((skill, index) => (
        <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">
          {skill}
        </span>
      ));
    }
    return null;
  };

  const getDiscColorLabel = (color) => {
    const colors = {
      red: { label: 'Leader', emoji: '🔴', color: 'bg-red-100 text-red-800' },
      yellow: { label: 'Energique', emoji: '🟡', color: 'bg-yellow-100 text-yellow-800' },
      green: { label: 'Écoute', emoji: '🟢', color: 'bg-green-100 text-green-800' },
      blue: { label: 'Organisé', emoji: '🔵', color: 'bg-blue-100 text-blue-800' }
    };
    return colors[color] || { label: color, emoji: '⚪', color: 'bg-gray-100 text-gray-800' };
  };

  const getActivityLabel = (activity) => {
    const activities = {
      kinesthetic: '🏃 Kinesthésique',
      musical: '🎵 Musicale',
      linguistic: '📚 Linguistique',
      logical: '🧮 Logico-mathématique',
      naturalist: '🌳 Naturaliste',
      interpersonal: '👥 Interpersonnelle',
      intrapersonal: '🧘 Intrapersonnelle',
      visual: '🎨 Visuo-spatiale'
    };
    return activities[activity] || activity;
  };

  // Affichage loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-center mt-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-3 text-primary-700 dark:text-primary-300">Chargement de l'annuaire...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="text-red-500 text-center mt-10">
          {error}
          <Button onClick={fetchUsers} className="ml-4 bg-primary-600 hover:bg-primary-700">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-primary-900 dark:text-white mb-2">
          📋 Annuaire SpotBulle
        </h1>
        <p className="text-primary-700 dark:text-primary-300 mb-6">
          Découvrez la communauté France-Maroc et connectez-vous avec des passionnés
        </p>

        {/* Filtres et recherche */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">Tous les membres</option>
            <option value="creators">Créateurs de contenu</option>
            <option value="football">Intéressés par le football</option>
            <option value="adults">Majeurs</option>
          </select>

          <input
            type="text"
            placeholder="Rechercher un membre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-grow focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Liste des utilisateurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((profile) => {
            const connectionStatus = getConnectionStatus(profile.id);
            const questionnaire = profile.questionnaire_responses?.[0];
            
            return (
              <div key={profile.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <img
                      src={profile.avatar_url || '/default-avatar.png'}
                      alt={profile.full_name}
                      className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-gray-200"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {profile.full_name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {profile.location || 'Localisation non précisée'}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                    {profile.bio || 'Aucune biographie fournie.'}
                  </p>

                  {/* Affichage des traits de personnalité */}
                  {questionnaire && (
                    <div className="mb-4 space-y-2">
                      {/* Couleur DISC */}
                      {questionnaire.disc_color && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-gray-500">Profil:</span>
                          {(() => {
                            const disc = getDiscColorLabel(questionnaire.disc_color);
                            return (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${disc.color}`}>
                                {disc.emoji} {disc.label}
                              </span>
                            );
                          })()}
                        </div>
                      )}

                      {/* Intelligences principales */}
                      {questionnaire.preferred_activities && questionnaire.preferred_activities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {questionnaire.preferred_activities.slice(0, 2).map((activity, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {getActivityLabel(activity)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Talents */}
                      {questionnaire.current_talent && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Talent:</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                            "{questionnaire.current_talent}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {profile.skills && (
                    <div className="mb-4">
                      {renderSkills(profile.skills)}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div>
                      {connectionStatus === 'can_connect' && (
                        <VideoPicker
                          onSelect={(videoId) => handleVideoSelect(profile.id, videoId)}
                          selectedVideo={selectedVideos[profile.id]}
                        />
                      )}
                    </div>

                    <div>
                      {connectionStatus === 'not_connected' && (
                        <Button
                          onClick={() => navigate('/auth')}
                          className="bg-primary-600 hover:bg-primary-700 text-white"
                          size="sm"
                        >
                          Se connecter
                        </Button>
                      )}
                      {connectionStatus === 'pending' && (
                        <Button
                          disabled
                          className="bg-gray-300 text-gray-600 cursor-not-allowed"
                          size="sm"
                        >
                          Demande envoyée ✓
                        </Button>
                      )}
                      {connectionStatus === 'can_connect' && (
                        <Button
                          onClick={() => handleConnect(profile.id)}
                          disabled={connecting}
                          className="bg-primary-600 hover:bg-primary-700 text-white"
                          size="sm"
                        >
                          {connecting ? 'Envoi...' : 'Se connecter'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {users.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10 py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">Aucun utilisateur trouvé</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Essayez de modifier vos critères de recherche ou de filtres.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Directory;
