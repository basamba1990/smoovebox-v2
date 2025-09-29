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

  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  // Récupération des profils selon filtre
  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('profiles')
        .select(
          'id, user_id, username, full_name, avatar_url, bio, sex, passions, clubs, football_interest, created_at'
        );

      // Exclure l'utilisateur connecté
      if (user) query = query.neq('user_id', user.id);

      // Appliquer filtres
      if (filter === 'football') {
        query = query.or('football_interest.eq.true,passions.cs.{football}');
      } else if (filter === 'passions') {
        query = query.not('passions', 'is', null).not('passions', 'eq', '{}');
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
    return <div className="text-white text-center mt-10">Chargement de l&apos;annuaire...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500 text-center mt-10">
        {error}
        <Button onClick={fetchUsers} className="ml-4 bg-blue-500">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold mb-6">Annuaire des Participants</h1>

      {/* Sélecteur vidéo */}
      <VideoPicker onChange={setSelectedVideoId} />

      {/* Filtres */}
      <div className="mb-6">
        <h3 className="text-lg text-white mb-2">Filtrer par :</h3>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}
          >
            Tous
          </Button>
          <Button
            onClick={() => setFilter('football')}
            className={filter === 'football' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}
          >
            Football
          </Button>
          <Button
            onClick={() => setFilter('passions')}
            className={filter === 'passions' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}
          >
            Par passions
          </Button>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {users.map((u) => (
          <div key={u.id} className="bg-white/10 backdrop-blur-md p-4 rounded-lg border border-gray-200">
            <h3 className="text-white font-medium">{u.username || `Utilisateur ${String(u.user_id).slice(0, 8)}`}</h3>
            <p className="text-gray-200">Sexe : {u.sex || 'Non spécifié'}</p>
            <p className="text-gray-200">
              Passions : {Array.isArray(u.passions) && u.passions.length > 0 ? u.passions.join(', ') : 'Aucune'}
            </p>
            <p className="text-gray-200">
              Clubs : {Array.isArray(u.clubs) && u.clubs.length > 0 ? u.clubs.join(', ') : 'Aucun'}
            </p>
            {u.football_interest && <p className="text-blue-400">🎯 Passionné de football</p>}

            <Button
              onClick={() => handleConnect(u.user_id)}
              className="mt-2 bg-orange-500 hover:bg-orange-600"
              disabled={!selectedVideoId || connecting}
            >
              {connecting ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Connexion...
                </span>
              ) : (
                'Connecter'
              )}
            </Button>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center mt-10 text-gray-400">Aucun participant trouvé avec ce filtre.</div>
      )}
    </div>
  );
};

export default Directory;
