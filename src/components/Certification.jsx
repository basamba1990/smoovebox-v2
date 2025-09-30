// components/Certification.jsx
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const Certification = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [userVideos, setUserVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingCertificate, setGeneratingCertificate] = useState(false);

  const supabase = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);

      // Récupérer le profil utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Récupérer les vidéos de l'utilisateur
      const { data: videos } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setUserProfile(profile);
      setUserVideos(videos || []);
    } catch (error) {
      console.error('Erreur récupération données:', error);
      toast.error('Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!user || !userProfile) {
      toast.error('Données utilisateur manquantes.');
      return;
    }

    setGeneratingCertificate(true);

    try {
      // Simulation de génération de certificat
      // Dans une version réelle, cela appellerait une fonction serverless
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Créer un certificat PDF fictif
      const certificateData = {
        nom: userProfile.full_name || userProfile.username,
        date: new Date().toLocaleDateString('fr-FR'),
        certification: 'SpotBulle Certified France-Maroc',
        niveau: 'Expert en Expression et Networking'
      };

      // Pour l'instant, nous créons un simple PDF de démonstration
      // En production, utilisez une bibliothèque comme jsPDF ou une fonction serverless
      const pdfBlob = new Blob([JSON.stringify(certificateData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Certificat_SpotBulle_${userProfile.full_name || 'Utilisateur'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Certificat téléchargé avec succès !');

      // Enregistrer le téléchargement dans la base de données
      await supabase
        .from('certifications')
        .insert([
          {
            user_id: user.id,
            type: 'spotbulle_certified',
            date_obtention: new Date().toISOString(),
            statut: 'obtenu'
          }
        ]);

    } catch (error) {
      console.error('Erreur génération certificat:', error);
      toast.error('Erreur lors de la génération du certificat.');
    } finally {
      setGeneratingCertificate(false);
    }
  };

  const isEligibleForCertification = () => {
    // Conditions pour être éligible à la certification
    const hasCompleteProfile = userProfile && 
      userProfile.genre && 
      userProfile.statut && 
      userProfile.centres_interet && 
      userProfile.centres_interet.length > 0;

    const hasAnalyzedVideos = userVideos.some(video => 
      video.status === 'analyzed' || video.analysis_text
    );

    return hasCompleteProfile && hasAnalyzedVideos;
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="mt-3 text-primary-700 dark:text-primary-300">Chargement de vos données de certification...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary-900 dark:text-white mb-4">
          🏆 Certification SpotBulle
        </h2>
        <p className="text-primary-700 dark:text-primary-300">
          Recevez votre diplôme SpotBulle Certified France-Maroc et rejoignez le réseau international
        </p>
      </div>

      {/* Carte de certification */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 border-2 border-primary-200 dark:border-primary-700 rounded-2xl p-8 text-center mb-8">
        <div className="mb-6">
          <div className="text-6xl mb-4">🎓</div>
          <h3 className="text-2xl font-bold text-primary-900 dark:text-white mb-2">
            Certificat SpotBulle France-Maroc
          </h3>
          <p className="text-primary-700 dark:text-primary-300">
            Innovation Éducative et Networking Sportif
          </p>
        </div>

        {/* Visuel du diplôme */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-lg border border-gold-400 max-w-md mx-auto">
          <div className="border-2 border-gold-500 rounded-lg p-6 bg-gradient-to-b from-white to-gold-50 dark:from-gray-800 dark:to-gold-900/20">
            <div className="text-4xl mb-4">🏅</div>
            <h4 className="text-xl font-bold text-primary-900 dark:text-white mb-2">
              SPOTBULLE CERTIFIED
            </h4>
            <p className="text-sm text-primary-700 dark:text-primary-300 mb-4">
              France - Maroc
            </p>
            <div className="border-t border-gold-300 pt-4">
              <p className="font-semibold text-primary-900 dark:text-white">
                {userProfile?.full_name || userProfile?.username || 'Utilisateur SpotBulle'}
              </p>
              <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                A obtenu la certification en Innovation Éducative
              </p>
              <p className="text-xs text-primary-500 dark:text-primary-500 mt-2">
                {new Date().toLocaleDateString('fr-FR', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Bouton de téléchargement */}
        <Button
          onClick={handleDownloadCertificate}
          disabled={!isEligibleForCertification() || generatingCertificate}
          className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold py-3 px-8 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generatingCertificate ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Génération...
            </span>
          ) : (
            '📄 Télécharger mon certificat'
          )}
        </Button>
      </div>

      {/* Conditions d'éligibilité */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-primary-200 dark:border-gray-700">
        <h3 className="font-semibold text-primary-900 dark:text-white mb-4 flex items-center">
          <span className="text-xl mr-2">✅</span>
          Conditions pour obtenir votre certification
        </h3>
        
        <div className="space-y-3">
          <div className={`flex items-center p-3 rounded-lg ${
            userProfile?.genre && userProfile?.statut && userProfile?.centres_interet?.length > 0
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
          }`}>
            <span className="mr-3">
              {userProfile?.genre && userProfile?.statut && userProfile?.centres_interet?.length > 0 ? '✅' : '⏳'}
            </span>
            <span>Profil SpotBulle complété</span>
          </div>

          <div className={`flex items-center p-3 rounded-lg ${
            userVideos.some(video => video.status === 'analyzed' || video.analysis_text)
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400'
          }`}>
            <span className="mr-3">
              {userVideos.some(video => video.status === 'analyzed' || video.analysis_text) ? '✅' : '⏳'}
            </span>
            <span>Au moins une vidéo analysée par l'IA SpotBulle</span>
          </div>

          <div className="flex items-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
            <span className="mr-3">💡</span>
            <span>Participation recommandée à un séminaire SpotBulle</span>
          </div>
        </div>

        {!isEligibleForCertification() && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Pour débloquer votre certification, complétez votre profil et enregistrez au moins une vidéo analysée par notre IA.
            </p>
          </div>
        )}
      </div>

      {/* Avantages de la certification */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-primary-200 dark:border-gray-700 text-center">
          <div className="text-2xl mb-2">🌍</div>
          <h4 className="font-semibold text-primary-900 dark:text-white mb-2">Réseau International</h4>
          <p className="text-sm text-primary-600 dark:text-primary-400">
            Accès à la communauté France-Maroc
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-primary-200 dark:border-gray-700 text-center">
          <div className="text-2xl mb-2">🚀</div>
          <h4 className="font-semibold text-primary-900 dark:text-white mb-2">Opportunités</h4>
          <p className="text-sm text-primary-600 dark:text-primary-400">
            Rencontres avec clubs et entreprises
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-primary-200 dark:border-gray-700 text-center">
          <div className="text-2xl mb-2">🎯</div>
          <h4 className="font-semibold text-primary-900 dark:text-white mb-2">Reconnaissance</h4>
          <p className="text-sm text-primary-600 dark:text-primary-400">
            Certification valorisante pour votre parcours
          </p>
        </div>
      </div>
    </div>
  );
};

export default Certification;
