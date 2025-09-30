// components/SeminarsList.jsx
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const SeminarsList = () => {
  const [seminars, setSeminars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inscriptions, setInscriptions] = useState({});
  const [inscribing, setInscribing] = useState(null);

  const supabase = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    fetchSeminars();
    if (user) {
      fetchUserInscriptions();
    }
  }, [user]);

  const fetchSeminars = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('seminars')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Erreur récupération séminaires:', error);
        setError('Impossible de charger les séminaires.');
        toast.error('Erreur lors du chargement des séminaires.');
        return;
      }

      setSeminars(data || []);
    } catch (err) {
      console.error('Erreur récupération séminaires:', err);
      setError('Impossible de charger les séminaires.');
      toast.error('Erreur lors du chargement des séminaires.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInscriptions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('seminar_inscriptions')
        .select('seminar_id, statut')
        .eq('user_id', user.id);

      if (!error && data) {
        const inscriptionsMap = {};
        data.forEach(inscription => {
          inscriptionsMap[inscription.seminar_id] = inscription.statut;
        });
        setInscriptions(inscriptionsMap);
      }
    } catch (err) {
      console.error('Erreur récupération inscriptions:', err);
    }
  };

  const handleInscription = async (seminarId) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour vous inscrire à un séminaire.');
      return;
    }

    setInscribing(seminarId);

    try {
      // Vérifier si l'utilisateur est déjà inscrit
      if (inscriptions[seminarId]) {
        toast.info('Vous êtes déjà inscrit à ce séminaire.');
        setInscribing(null);
        return;
      }

      // Insérer l'inscription
      const { error } = await supabase
        .from('seminar_inscriptions')
        .insert([
          {
            user_id: user.id,
            seminar_id: seminarId,
            statut: 'confirmé',
            date_inscription: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      // Mettre à jour le compteur de participants
      const seminar = seminars.find(s => s.id === seminarId);
      if (seminar && seminar.current_participants < seminar.max_participants) {
        await supabase
          .from('seminars')
          .update({ 
            current_participants: seminar.current_participants + 1 
          })
          .eq('id', seminarId);
      }

      // Mettre à jour l'état local
      setInscriptions(prev => ({
        ...prev,
        [seminarId]: 'confirmé'
      }));

      toast.success('Inscription au séminaire confirmée !');
      
      // Recharger les séminaires pour avoir les compteurs à jour
      fetchSeminars();

    } catch (err) {
      console.error('Erreur inscription:', err);
      toast.error('Erreur lors de l\'inscription au séminaire.');
    } finally {
      setInscribing(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntil = (dateString) => {
    const now = new Date();
    const seminarDate = new Date(dateString);
    const diffTime = seminarDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadge = (seminar) => {
    const daysUntil = getDaysUntil(seminar.date);
    
    if (seminar.statut === 'annulé') {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Annulé</span>;
    }
    
    if (seminar.statut === 'terminé') {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Terminé</span>;
    }
    
    if (daysUntil < 0) {
      return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">En cours</span>;
    }
    
    if (daysUntil <= 7) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Bientôt</span>;
    }
    
    return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">À venir</span>;
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="mt-3 text-primary-700 dark:text-primary-300">Chargement des séminaires...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchSeminars} className="bg-primary-600 hover:bg-primary-700">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary-900 dark:text-white mb-4">
          🎓 Séminaires SpotBulle
        </h2>
        <p className="text-primary-700 dark:text-primary-300 max-w-2xl mx-auto">
          Participez à nos séminaires exclusifs "Citoyen des Deux Rives" et développez vos compétences 
          avec la communauté France-Maroc.
        </p>
      </div>

      {seminars.length === 0 ? (
        <div className="text-center py-10 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <div className="text-5xl mb-4">📅</div>
          <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-200 mb-2">
            Aucun séminaire programmé pour le moment
          </h3>
          <p className="text-primary-600 dark:text-primary-400">
            Revenez bientôt pour découvrir les prochains séminaires SpotBulle.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {seminars.map((seminar) => (
            <div key={seminar.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-primary-200 dark:border-gray-700">
              {/* En-tête avec image et statut */}
              <div className="h-48 bg-gradient-to-r from-primary-500 to-primary-600 relative">
                <div className="absolute top-4 right-4">
                  {getStatusBadge(seminar)}
                </div>
                <div className="absolute bottom-4 left-4 text-white">
                  <span className="text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                    📍 {seminar.lieu}
                  </span>
                </div>
              </div>

              {/* Contenu */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-primary-900 dark:text-white mb-3">
                  {seminar.titre}
                </h3>
                <p className="text-primary-700 dark:text-primary-300 mb-4 line-clamp-3">
                  {seminar.description}
                </p>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-primary-600 dark:text-primary-400">
                    <span className="mr-2">📅</span>
                    <span>{formatDate(seminar.date)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-primary-600 dark:text-primary-400">
                      <span className="mr-2">👥</span>
                      <span>
                        {seminar.current_participants}/{seminar.max_participants} participants
                      </span>
                    </div>
                    
                    {getDaysUntil(seminar.date) > 0 && (
                      <div className="text-orange-600 dark:text-orange-400">
                        Dans {getDaysUntil(seminar.date)} jour{getDaysUntil(seminar.date) > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Barre de progression des inscriptions */}
                  <div className="w-full bg-primary-200 dark:bg-primary-800 rounded-full h-2">
                    <div 
                      className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(100, (seminar.current_participants / seminar.max_participants) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>

                {/* Bouton d'inscription */}
                {seminar.statut === 'planifié' && (
                  <Button
                    onClick={() => handleInscription(seminar.id)}
                    disabled={
                      inscribing === seminar.id || 
                      inscriptions[seminar.id] || 
                      seminar.current_participants >= seminar.max_participants
                    }
                    className={`w-full ${
                      inscriptions[seminar.id] 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : seminar.current_participants >= seminar.max_participants
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700'
                    } text-white font-semibold py-3 rounded-lg transition-all`}
                  >
                    {inscribing === seminar.id ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Inscription...
                      </span>
                    ) : inscriptions[seminar.id] ? (
                      '✅ Déjà inscrit'
                    ) : seminar.current_participants >= seminar.max_participants ? (
                      '❌ Complet'
                    ) : (
                      '🎫 S\'inscrire au séminaire'
                    )}
                  </Button>
                )}

                {seminar.statut === 'annulé' && (
                  <div className="text-center py-2 text-red-600 dark:text-red-400 font-semibold">
                    Séminaire annulé
                  </div>
                )}

                {seminar.statut === 'terminé' && (
                  <div className="text-center py-2 text-gray-600 dark:text-gray-400 font-semibold">
                    Séminaire terminé
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section d'information */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-6 mt-8 border border-primary-200 dark:border-primary-800">
        <h3 className="font-semibold text-primary-800 dark:text-primary-200 mb-3 flex items-center">
          <span className="text-xl mr-2">💡</span>
          Pourquoi participer aux séminaires SpotBulle ?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start">
            <span className="text-primary-500 mr-2">🎯</span>
            <span className="text-primary-700 dark:text-primary-300">
              Développez des compétences du XXIe siècle
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-primary-500 mr-2">🌍</span>
            <span className="text-primary-700 dark:text-primary-300">
              Rejoignez le réseau France-Maroc
            </span>
          </div>
          <div className="flex items-start">
            <span className="text-primary-500 mr-2">🚀</span>
            <span className="text-primary-700 dark:text-primary-300">
              Boostez votre parcours personnel et professionnel
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeminarsList;
