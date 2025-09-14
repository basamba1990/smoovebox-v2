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
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let query = supabase.from('users').select('id, sex, passions, clubs, football_interest, created_at');

      if (filter === 'football') {
        query = query.or('football_interest.eq.true, passions.cs.{football}');
      } else if (filter === 'passions') {
        query = query.neq('passions', '{}');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erreur récupération utilisateurs:', error);
      setError('Impossible de charger l\'annuaire.');
      toast.error('Erreur lors du chargement de l\'annuaire.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (targetUserId) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour initier une mise en relation.');
      navigate('/auth');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('match-profiles', {
        body: { user_id: user.id, target_user_id: targetUserId },
      });

      if (error) throw error;
      toast.success('Mise en relation initiée avec succès !');
    } catch (error) {
      console.error('Erreur mise en relation:', error);
      toast.error('Erreur lors de la mise en relation.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4 text-center">
        <p className="text-blue-500">Chargement de l'annuaire...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 text-center">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 min-h-screen">
      <h1 className="text-3xl font-bold text-blue-500 mb-6">Annuaire des Participants</h1>

      <div className="mb-6">
        <h3 className="text-lg text-white mb-2">Filtrer par :</h3>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800'}
          >
            Tous
          </Button>
          <Button
            onClick={() => setFilter('football')}
            className={filter === 'football' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800'}
          >
            Football
          </Button>
          <Button
            onClick={() => setFilter('passions')}
            className={filter === 'passions' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800'}
          >
            Par passions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className="bg-white/10 backdrop-blur-md p-4 rounded-lg border border-gray-200">
            <h3 className="text-white font-medium">Utilisateur {u.id.slice(0, 8)}</h3>
            <p className="text-gray-200">Passions : {u.passions?.join(', ') || 'Aucune'}</p>
            <p className="text-gray-200">Clubs : {u.clubs?.join(', ') || 'Aucun'}</p>
            {u.football_interest && <p className="text-blue-400">🎯 Passionné de football</p>}
            <Button
              onClick={() => handleConnect(u.id)}
              className="mt-2 bg-orange-500 hover:bg-orange-600"
            >
              Connecter
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Directory;
