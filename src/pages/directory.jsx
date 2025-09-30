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
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  // Récupération des profils selon filtre et recherche
  useEffect(() => {
    fetchUsers();
  }, [filter, searchTerm]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('profiles')
        .select(
          'id, user_id, username, full_name, avatar_url, bio, genre, passions, clubs, centres_interet, jingle, mots_cles, created_at'
        );

      // Exclure l'utilisateur connecté
      if (user) query = query.neq('user_id', user.id);

      // Appliquer filtres
      if (filter === 'football') {
        query = query.or('centres_interet.cs.{metier_du_foot},passions.cs.{football}');
      } else if (filter === 'passions') {
        query = query.not('passions', 'is', null).not('passions', 'eq', '{}');
      } else if (filter === 'clubs') {
        query = query.not('clubs', 'is', null).not('clubs', 'eq', '{}');
      }

      // Appliquer la recherche par mots-clés ou nom
      if (searchTerm) {
        query = query.or(`mots_cles.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,passions.cs.{${searchTerm}}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur récupération profils:', error);
        setError('Impossible de charger l\'annuaire.');
        toast.error('Erreur lors du chargement de l\'annuaire.');
        return;
      }

      setUsers(data || []);
    } catch (err) {
      console.error('Erreur récupération profils:', err);
      setError('Impossible de charger l\'annuaire.');
      toast.error('Erreur lors du chargement de l\'annuaire.');
    } finally {
      setLoading(false);
    }
  };

  // Gestion du bouton Connecter
  const handleConnect = async (targetUserId) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour initier une mise en relation.');
      navigate('/auth');
      return;
    }

    if (!selectedVideoId) {
      toast.error('Veuillez sélectionner une vidéo avant de connecter un utilisateur.');
      return;
    }

    setConnecting(true);

    try {
      // Récupérer la session pour le JWT
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Erreur session:', sessionError);
        toast.error('Session invalide. Veuillez vous reconnecter.');
        navigate('/auth');
        return;
      }

      console.log('Tentative de connexion avec:', {
        user_id: user.id,
        target_user_id: targetUserId,
        video_id: selectedVideoId
      });

      // CORRECTION : Utiliser l'URL correcte pour la fonction Edge
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-profiles`;
      
      // Appel de la fonction Edge
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          target_user_id: targetUserId,
          video_id: selectedVideoId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur invocation match-profiles:', errorText);
        
        let errorMessage = 'Impossible de lancer la mise en relation.';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
          errorMessage = `Erreur ${response.status}: ${errorText}`;
        }
        
        toast.error(errorMessage);
        return;
      }

      const data = await response.json();
      console.log('Réponse match-profiles:', data);
      
      toast.success('Mise en relation initiée avec succès !');
      
      // Réinitialiser la sélection vidéo
      setSelectedVideoId(null);
      
    } catch (err) {
      console.error('Erreur mise en relation:', err);
      toast.error(`Erreur lors de la mise en relation: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  // Affichage loading / erreur
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

        {/* Sélecteur vidéo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h3 className="text-lg font-semibold text-primary-900 dark:text-white mb-4">
            🎥 Sélectionnez une vidéo pour connecter
          </h3>
          <VideoPicker onChange={setSelectedVideoId} />
          {selectedVideoId && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              ✓ Vidéo sélectionnée pour la mise en relation
            </p>
          )}
        </div>

        {/* Barre de recherche et filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Barre de recherche */}
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-white mb-2">
                🔍 Rechercher par mots-clés
              </label>
              <input
                type="text"
                placeholder="Football, passion, club, France, Maroc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-primary-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-primary-900 dark:text-white placeholder-primary-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filtres */}
            <div>
              <label className="block text-sm font-medium text-primary-900 dark:text-white mb-2">
                🎯 Filtrer par centre d'intérêt
              </label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    filter === 'all' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  Tous
                </Button>
                <Button
                  onClick={() => setFilter('football')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    filter === 'football' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  ⚽ Football
                </Button>
                <Button
                  onClick={() => setFilter('passions')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    filter === 'passions' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  ❤️ Passions
                </Button>
                <Button
                  onClick={() => setFilter('clubs')}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    filter === 'clubs' 
                      ? 'bg-primary-600 text-white' 
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  🏛️ Clubs
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des utilisateurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((profile) => (
            <div key={profile.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-primary-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
              {/* En-tête du profil */}
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                  {profile.full_name?.charAt(0) || profile.username?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-semibold text-primary-900 dark:text-white">
                    {profile.full_name || profile.username || `Utilisateur ${String(profile.user_id).slice(0, 8)}`}
                  </h3>
                  <p className="text-sm text-primary-600 dark:text-primary-400">
                    {profile.genre ? `Genre: ${profile.genre}` : 'SpotBulle Member'}
                  </p>
                </div>
              </div>

              {/* Informations du profil */}
              <div className="space-y-3 mb-4">
                {profile.centres_interet && profile.centres_interet.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Centres d'intérêt:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile.centres_interet.map((interest, index) => (
                        <span key={index} className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.passions && profile.passions.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Passions:</span>
                    <p className="text-sm text-primary-900 dark:text-white mt-1">
                      {profile.passions.join(', ')}
                    </p>
                  </div>
                )}

                {profile.clubs && profile.clubs.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Clubs:</span>
                    <p className="text-sm text-primary-900 dark:text-white mt-1">
                      {profile.clubs.join(', ')}
                    </p>
                  </div>
                )}

                {profile.mots_cles && (
                  <div>
                    <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Mots-clés:</span>
                    <p className="text-sm text-primary-900 dark:text-white mt-1">
                      {profile.mots_cles}
                    </p>
                  </div>
                )}
              </div>

              {/* Bouton de connexion */}
              <Button
                onClick={() => handleConnect(profile.user_id)}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!selectedVideoId || connecting}
              >
                {connecting ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connexion...
                  </span>
                ) : (
                  '🤝 Connecter avec SpotBulle'
                )}
              </Button>
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-primary-900 dark:text-white mb-2">
              Aucun participant trouvé
            </h3>
            <p className="text-primary-700 dark:text-primary-300">
              {searchTerm 
                ? `Aucun résultat pour "${searchTerm}". Essayez d'autres mots-clés.`
                : 'Aucun participant ne correspond aux filtres sélectionnés.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Directory;
