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
  const [selectedVideoId, setSelectedVideoId] = useState(null); // TODO: renseigner selon votre UI
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('profiles')
        .select('id, sex, passions, clubs, football_interest, created_at');

      if (filter === 'football') {
        // football_interest = true OU passions contient 'football'
        query = query.or('football_interest.eq.true,passions.cs.{football}');
      } else if (filter === 'passions') {
        // passions non vide (par défaut '{}' pour text[])
        query = query.neq('passions', '{}');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setError(null);
    } catch (err) {
      console.error('Erreur récupération utilisateurs:', err);
      setError("Impossible de charger l'annuaire.");
      toast.error("Erreur lors du chargement de l'annuaire.");
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
    if (!selectedVideoId) {
      toast.error('Veuillez sélectionner une vidéo à associer à la mise en relation.');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('match-profiles', {
        body: {
          user_id: user.id,
          target_user_id: targetUserId,
          video_id: selectedVideoId, // requis par la fonction
        },
      });
      if (error) throw error;
      toast.success('Mise en relation initiée avec succès !');
    } catch (err) {
      console.error('Erreur mise en relation:', err);
      toast.error('Erreur lors de la mise en relation.');
    }
  };

  if (loading) return <div className="text-white text-center mt-10">Chargement de l&apos;annuaire...</div>;
  if (error) return <div className="text-red-500 text-center mt-10">{error}</div>;

  return (
    <div className="p-8 min-h-screen bg-black text-white">
      <h1 className="text-3xl font-bold mb-6">Annuaire des Participants</h1>

      {/* TODO: ajoutez un sélecteur de vidéo pour selectedVideoId */}
      {/* <VideoPicker onChange={setSelectedVideoId} /> */}

      <div className="mb-6">
        <h3 className="text-lg text-white mb-2">Filtrer par :</h3>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setFilter('all')} className={filter === 'all' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}>Tous</Button>
          <Button onClick={() => setFilter('football')} className={filter === 'football' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}>Football</Button>
          <Button onClick={() => setFilter('passions')} className={filter === 'passions' ? 'bg-blue-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}>Par passions</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {users.map((u) => (
          <div key={u.id} className="bg-white/10 backdrop-blur-md p-4 rounded-lg border border-gray-200">
            <h3 className="text-white font-medium">Utilisateur {String(u.id).slice(0, 8)}</h3>
            <p className="text-gray-200">
              Passions : {Array.isArray(u.passions) && u.passions.length > 0 ? u.passions.join(', ') : 'Aucune'}
            </p>
            <p className="text-gray-200">
              Clubs : {Array.isArray(u.clubs) && u.clubs.length > 0 ? u.clubs.join(', ') : 'Aucun'}
            </p>
            {u.football_interest && <p className="text-blue-400">🎯 Passionné de football</p>}
            <Button onClick={() => handleConnect(u.id)} className="mt-2 bg-orange-
