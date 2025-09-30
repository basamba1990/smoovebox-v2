import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';

const Directory = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [connecting, setConnecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [existingConnections, setExistingConnections] = useState(new Set());

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
          id,
          user_id,
          username,
          full_name,
          avatar_url,
          bio,
          email,
          skills,
          location,
          linkedin_url,
          github_url,
          is_creator,
          sex,
          is_major,
          passions,
          clubs,
          football_interest,
          created_at
        `);

      // Exclure l'utilisateur courant de la liste
      if (user) {
        query = query.neq('user_id', user.id);
      }

      // Application des filtres
      if (filter !== 'all') {
        if (filter === 'creator') {
          query = query.eq('is_creator', true);
        } else if (filter === 'football') {
          query = query.eq('football_interest', true);
        } else if (filter === 'major') {
          query = query.eq('is_major', true);
        }
      }

      // Application de la recherche
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%,passions.cs.{"${searchTerm}"},clubs.cs.{"${searchTerm}"}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);

    } catch (err) {
      console.error('Erreur fetchUsers:', err);
      setError(`Erreur lors du chargement: ${err.message}`);
      toast.error('Impossible de charger les profils');
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

      // Créer un Set des IDs des utilisateurs déjà connectés
      const connectionsSet = new Set();
      data?.forEach(connection => {
        connectionsSet.add(connection.target_id);
      });
      setExistingConnections(connectionsSet);

    } catch (err) {
      console.error('Erreur fetchExistingConnections:', err);
    }
  };

  const handleConnect = async (targetUserId) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour initier une mise en relation.');
      navigate('/auth');
      return;
    }

    // Vérifier si déjà connecté
    if (existingConnections.has(targetUserId)) {
      toast.info('Vous avez déjà envoyé une demande à cet utilisateur');
      return;
    }

    try {
      setConnecting(true);
      
      // Utilisation de la nouvelle table connections
      const { error } = await supabase
        .from('connections')
        .insert({
          requester_id: user.id,
          target_id: targetUserId,
          status: 'pending'
        });

      if (error) throw error;
      
      // Mettre à jour les connexions existantes
      setExistingConnections(prev => new Set([...prev, targetUserId]));
      toast.success('Demande de connexion envoyée !');
      
    } catch (err) {
      console.error('Erreur handleConnect:', err);
      if (err.code === '23505') {
        toast.error('Vous avez déjà envoyé une demande à cet utilisateur');
        setExistingConnections(prev => new Set([...prev, targetUserId]));
      } else {
        toast.error(`Échec de la connexion: ${err.message}`);
      }
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

        {/* Barre de filtres et de recherche */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label htmlFor="filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filtres
              </label>
              <select
                id="filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">Tous les membres</option>
                <option value="creator">Créateurs de contenu</option>
                <option value="football">Intéressés par le football</option>
                <option value="major">Majeurs</option>
              </select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rechercher
              </label>
              <input
                id="search"
                type="text"
                placeholder="Nom, bio, passions ou clubs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Liste des utilisateurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((userProfile) => {
            const connectionStatus = getConnectionStatus(userProfile.user_id || userProfile.id);
            const isPending = connectionStatus === 'pending';
            
            return (
              <div key={userProfile.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                {/* En-tête du profil */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {userProfile.avatar_url ? (
                      <img 
                        src={userProfile.avatar_url} 
                        alt={userProfile.full_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                        <span className="text-primary-600 dark:text-primary-300 font-semibold">
                          {userProfile.full_name ? userProfile.full_name.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {userProfile.full_name || 'Utilisateur sans nom'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {userProfile.location || 'Localisation non précisée'}
                      </p>
                    </div>
                  </div>
                  {userProfile.is_creator && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      Créateur
                    </span>
                  )}
                </div>
                
                {/* Bio */}
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                  {userProfile.bio || 'Aucune biographie fournie.'}
                </p>
                
                {/* Passions */}
                {userProfile.passions && userProfile.passions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Passions:</p>
                    <div className="flex flex-wrap gap-1">
                      {userProfile.passions.map((passion, index) => (
                        <span 
                          key={index}
                          className="inline-block bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 text-xs px-2 py-1 rounded-full"
                        >
                          {passion}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Clubs */}
                {userProfile.clubs && userProfile.clubs.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Clubs:</p>
                    <div className="flex flex-wrap gap-1">
                      {userProfile.clubs.map((club, index) => (
                        <span 
                          key={index}
                          className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full"
                        >
                          {club}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Compétences */}
                {userProfile.skills && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Compétences:</p>
                    <div className="flex flex-wrap gap-1">
                      {renderSkills(userProfile.skills)}
                    </div>
                  </div>
                )}
                
                {/* Bouton de connexion avec état */}
                <Button
                  onClick={() => handleConnect(userProfile.user_id || userProfile.id)}
                  disabled={connecting || isPending || !user}
                  className={`w-full ${
                    isPending 
                      ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' 
                      : 'bg-primary-600 hover:bg-primary-700'
                  } disabled:opacity-50`}
                >
                  {!user 
                    ? 'Connectez-vous' 
                    : isPending 
                      ? 'Demande envoyée ✓' 
                      : connecting 
                        ? 'Envoi...' 
                        : 'Envoyer une demande'
                  }
                </Button>
              </div>
            );
          })}
        </div>

        {users.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Aucun profil trouvé pour vos critères de recherche.
            </p>
            <Button 
              onClick={() => { setFilter('all'); setSearchTerm(''); }}
              className="mt-4 bg-primary-600 hover:bg-primary-700"
            >
              Voir tous les membres
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Directory;
