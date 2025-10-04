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
  const [selectedVideos, setSelectedVideos] = useState({});
  const [userVideos, setUserVideos] = useState([]);

  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  // Récupération des données
  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        fetchUsers(),
        user ? fetchExistingConnections() : Promise.resolve(),
        user ? fetchUserVideos() : Promise.resolve()
      ]);
    };

    fetchData();
  }, [filter, searchTerm, user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Récupération des utilisateurs avec filtre:', filter);

      let query = supabase
        .from('profiles')
        .select('id, full_name, bio, location, skills, avatar_url, is_creator, football_interest, is_major, passions, clubs, sex, created_at')
        .neq('id', user?.id) // Exclure l'utilisateur actuel
        .order('created_at', { ascending: false });

      // Appliquer les filtres
      if (filter === 'creators') {
        query = query.eq('is_creator', true);
      } else if (filter === 'football') {
        query = query.eq('football_interest', true);
      } else if (filter === 'adults') {
        query = query.eq('is_major', true);
      }

      // Appliquer la recherche
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%,skills.cs.{${searchTerm}}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erreur fetchUsers:', error);
        throw error;
      }

      console.log(`✅ ${data?.length || 0} utilisateurs trouvés`);
      setUsers(data || []);
    } catch (err) {
      console.error('❌ Erreur fetchUsers:', err);
      setError(`Erreur chargement annuaire: ${err.message}`);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('connections')
        .select('target_id, status')
        .eq('requester_id', user.id);

      if (error) throw error;

      const ids = new Set(data?.map(connection => connection.target_id) || []);
      setExistingConnections(ids);
      console.log(`✅ ${ids.size} connexions existantes chargées`);
    } catch (err) {
      console.error('❌ Erreur fetchExistingConnections:', err.message);
    }
  };

  const fetchUserVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, public_url, storage_path, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'analyzed') // Seulement les vidéos analysées
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ ${data?.length || 0} vidéos utilisateur chargées`);
      setUserVideos(data || []);
    } catch (err) {
      console.error('❌ Erreur fetchUserVideos:', err.message);
      toast.error('Erreur lors du chargement de vos vidéos');
    }
  };

  const handleVideoSelect = (targetUserId, videoId) => {
    setSelectedVideos(prev => ({
      ...prev,
      [targetUserId]: videoId
    }));
    console.log(`🎥 Vidéo ${videoId} sélectionnée pour l'utilisateur ${targetUserId}`);
  };

  const handleConnect = async (targetUserId) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour initier une mise en relation.');
      navigate('/auth');
      return;
    }

    if (existingConnections.has(targetUserId)) {
      toast.info('Demande de connexion déjà envoyée à cet utilisateur');
      return;
    }

    if (connecting) return;

    setConnecting(true);

    try {
      const videoId = selectedVideos[targetUserId] || null;
      const targetUser = users.find(u => u.id === targetUserId);

      console.log('📤 Envoi demande connexion:', {
        requester_id: user.id,
        target_id: targetUserId,
        target_name: targetUser?.full_name,
        video_id: videoId
      });

      const { data, error } = await supabase
        .from('connections')
        .insert({
          requester_id: user.id,
          target_id: targetUserId,
          video_id: videoId,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        
        if (error.code === '23505') { // Violation de contrainte unique
          toast.error('Demande de connexion déjà existante');
          return;
        }
        
        if (error.code === '42P01') {
          toast.error('Table des connexions non disponible');
          return;
        }
        
        throw error;
      }

      console.log('✅ Réponse connexion:', data);

      // Mettre à jour l'état local
      setExistingConnections(prev => new Set([...prev, targetUserId]));
      
      // Réinitialiser la sélection vidéo pour cet utilisateur
      setSelectedVideos(prev => {
        const newSelection = { ...prev };
        delete newSelection[targetUserId];
        return newSelection;
      });

      toast.success(`Demande de connexion envoyée à ${targetUser?.full_name || 'l\'utilisateur'} !`);
      
    } catch (err) {
      console.error('❌ Erreur handleConnect:', err);
      toast.error(`Erreur lors de la demande: ${err.message}`);
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
      return skills.slice(0, 3).map((skill, index) => (
        <span key={index} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">
          {skill}
        </span>
      ));
    }
    return null;
  };

  const renderPassions = (passions) => {
    if (!passions) return null;
    if (Array.isArray(passions)) {
      return passions.slice(0, 3).map((passion, index) => (
        <span key={index} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">
          {passion}
        </span>
      ));
    }
    return null;
  };

  const renderClubs = (clubs) => {
    if (!clubs) return null;
    if (Array.isArray(clubs)) {
      return clubs.slice(0, 2).map((club, index) => (
        <span key={index} className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">
          {club}
        </span>
      ));
    }
    return null;
  };

  // Fonction pour obtenir l'avatar par défaut basé sur le sexe
  const getDefaultAvatar = (sex) => {
    return sex === 'female' 
      ? 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=64&h=64&fit=crop&crop=face'
      : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mt-10">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-blue-700 text-lg">Chargement de l'annuaire...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">❌</div>
            <h3 className="text-red-800 text-xl font-semibold mb-2">Erreur de chargement</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchUsers} className="bg-red-600 hover:bg-red-700 text-white">
              🔄 Réessayer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            📋 Annuaire SpotBulle
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Découvrez la communauté et connectez-vous avec des passionnés partageant vos intérêts
          </p>
        </div>

        {/* Filtres et recherche */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">👥 Tous les membres</option>
              <option value="creators">🎨 Créateurs de contenu</option>
              <option value="football">⚽ Passionnés de football</option>
              <option value="adults">👑 Membres majeurs</option>
            </select>

            <input
              type="text"
              placeholder="🔍 Rechercher par nom, compétences..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 flex-grow focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          
          <Button
            onClick={fetchUsers}
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6"
          >
            🔄 Actualiser
          </Button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{users.length}</div>
            <div className="text-sm text-gray-600">Membres</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.is_creator).length}
            </div>
            <div className="text-sm text-gray-600">Créateurs</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">
              {users.filter(u => u.football_interest).length}
            </div>
            <div className="text-sm text-gray-600">Football</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <div className="text-2xl font-bold text-orange-600">
              {existingConnections.size}
            </div>
            <div className="text-sm text-gray-600">Connexions</div>
          </div>
        </div>

        {/* Liste des utilisateurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((profile) => {
            const connectionStatus = getConnectionStatus(profile.id);
            return (
              <div key={profile.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-300 hover:translate-y-[-2px]">
                <div className="p-6">
                  {/* En-tête profil */}
                  <div className="flex items-start mb-4">
                    <img
                      src={profile.avatar_url || getDefaultAvatar(profile.sex)}
                      alt={profile.full_name}
                      className="w-14 h-14 rounded-full object-cover mr-4 border-2 border-blue-200"
                      onError={(e) => {
                        e.target.src = getDefaultAvatar(profile.sex);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg truncate">
                        {profile.full_name || 'Utilisateur sans nom'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {profile.location || '📍 Localisation non précisée'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Inscrit le {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {profile.bio || 'Aucune biographie fournie.'}
                  </p>

                  {/* Compétences */}
                  {profile.skills && profile.skills.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">🛠️ Compétences</p>
                      <div className="flex flex-wrap">
                        {renderSkills(profile.skills)}
                        {profile.skills.length > 3 && (
                          <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                            +{profile.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Passions */}
                  {profile.passions && profile.passions.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">❤️ Passions</p>
                      <div className="flex flex-wrap">
                        {renderPassions(profile.passions)}
                      </div>
                    </div>
                  )}

                  {/* Clubs */}
                  {profile.clubs && profile.clubs.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">🏆 Clubs</p>
                      <div className="flex flex-wrap">
                        {renderClubs(profile.clubs)}
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {profile.is_creator && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        🎨 Créateur
                      </span>
                    )}
                    {profile.football_interest && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ⚽ Football
                      </span>
                    )}
                    {profile.is_major && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        👑 Majeur
                      </span>
                    )}
                    {profile.sex === 'female' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                        👩 Femme
                      </span>
                    )}
                    {profile.sex === 'male' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        👨 Homme
                      </span>
                    )}
                  </div>

                  {/* Actions de connexion */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                    {connectionStatus === 'can_connect' && (
                      <>
                        <VideoPicker
                          onSelect={(videoId) => handleVideoSelect(profile.id, videoId)}
                          selectedVideo={selectedVideos[profile.id]}
                          userVideos={userVideos}
                        />
                        <Button
                          onClick={() => handleConnect(profile.id)}
                          disabled={connecting}
                          className="bg-blue-600 hover:bg-blue-700 text-white py-2"
                        >
                          {connecting ? (
                            <span className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Envoi...
                            </span>
                          ) : (
                            '🤝 Se connecter'
                          )}
                        </Button>
                      </>
                    )}
                    {connectionStatus === 'pending' && (
                      <Button
                        disabled
                        className="bg-gray-300 text-gray-600 cursor-not-allowed py-2"
                      >
                        ✅ Demande envoyée
                      </Button>
                    )}
                    {connectionStatus === 'not_connected' && (
                      <Button
                        onClick={() => navigate('/auth')}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2"
                      >
                        🔐 Se connecter
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message vide */}
        {users.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-semibold mb-3">Aucun utilisateur trouvé</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              {searchTerm || filter !== 'all' 
                ? "Essayez de modifier vos critères de recherche ou vos filtres pour trouver plus de membres." 
                : "L'annuaire est vide pour le moment. Revenez plus tard !"
              }
            </p>
            {(searchTerm || filter !== 'all') && (
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                🔄 Afficher tous les membres
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Directory;
