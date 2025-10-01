// components/ProfileForm.jsx - VERSION CORRIGÉE
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const ProfileForm = ({ user, profile, onProfileUpdated = () => {} }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    genre: '',
    statut: '',
    centres_interet: [],
    jingle: '',
    mots_cles: ''
  });
  
  const [availableJingles, setAvailableJingles] = useState([
    { id: 'jingle1', name: 'Jingle Sportif Energique', preview: '/jingles/jingle1.mp3' },
    { id: 'jingle2', name: 'Jingle Inspirant Doux', preview: '/jingles/jingle2.mp3' },
    { id: 'jingle3', name: 'Jingle France-Maroc', preview: '/jingles/jingle3.mp3' },
    { id: 'jingle4', name: 'Jingle Moderne', preview: '/jingles/jingle4.mp3' }
  ]);

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  // Centres d'intérêt prédéfinis - CORRIGÉ pour matcher votre base
  const centresInteretOptions = [
    { value: 'club', label: 'Club' },
    { value: 'passion', label: 'Passion' },
    { value: 'metier_du_foot', label: 'Métier du foot' }
  ];

  // Charger le profil existant
  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
  }, [currentUser]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur chargement profil:', error);
        toast.error('Erreur lors du chargement du profil');
        return;
      }

      if (data) {
        setFormData({
          genre: data.sex || '', // Votre colonne s'appelle 'sex' pas 'genre'
          statut: data.is_major ? 'majeur' : 'mineur', // Conversion booléen -> texte
          centres_interet: data.passions || [], // Votre colonne s'appelle 'passions'
          jingle: data.jingle || '',
          mots_cles: Array.isArray(data.skills) ? data.skills.join(', ') : '' // Conversion array -> string
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      toast.error('Erreur lors du chargement du profil');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCentresInteretChange = (value) => {
    setFormData(prev => ({
      ...prev,
      centres_interet: prev.centres_interet.includes(value)
        ? prev.centres_interet.filter(item => item !== value)
        : [...prev.centres_interet, value]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('Vous devez être connecté pour sauvegarder votre profil');
      return;
    }

    // Validation
    if (!formData.genre || !formData.statut || formData.centres_interet.length === 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);

    try {
      // Préparation des données pour Supabase
      const profileData = {
        id: currentUser.id, // Clé primaire
        sex: formData.genre, // Votre colonne s'appelle 'sex'
        is_major: formData.statut === 'majeur', // Conversion texte -> booléen
        passions: formData.centres_interet, // Votre colonne s'appelle 'passions'
        jingle: formData.jingle,
        skills: formData.mots_cles.split(',').map(skill => skill.trim()).filter(skill => skill), // Conversion string -> array
        updated_at: new Date().toISOString()
      };

      console.log('Données à sauvegarder:', profileData);

      // Upsert du profil
      const { error } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      toast.success('Profil sauvegardé avec succès !');
      onProfileUpdated();
      
    } catch (error) {
      console.error('Erreur sauvegarde profil:', error);
      toast.error(`Erreur lors de la sauvegarde: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const previewJingle = (jingleUrl) => {
    const audio = new Audio(jingleUrl);
    audio.play().catch(e => console.log('Lecture audio impossible:', e));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        👤 Compléter mon profil SpotBulle
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Genre */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Genre *
          </label>
          <div className="flex gap-4">
            {['Masculin', 'Féminin', 'Neutre'].map((genre) => (
              <label key={genre} className="flex items-center">
                <input
                  type="radio"
                  name="genre"
                  value={genre.toLowerCase()}
                  checked={formData.genre === genre.toLowerCase()}
                  onChange={(e) => handleInputChange('genre', e.target.value)}
                  className="mr-2"
                  required
                />
                <span className="text-gray-700 dark:text-gray-300">{genre}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Statut */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Statut *
          </label>
          <div className="flex gap-4">
            {['majeur', 'mineur'].map((statut) => (
              <label key={statut} className="flex items-center">
                <input
                  type="radio"
                  name="statut"
                  value={statut}
                  checked={formData.statut === statut}
                  onChange={(e) => handleInputChange('statut', e.target.value)}
                  className="mr-2"
                  required
                />
                <span className="text-gray-700 dark:text-gray-300 capitalize">{statut}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Centres d'intérêt */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Centres d'intérêt *
          </label>
          <div className="space-y-2">
            {centresInteretOptions.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  value={option.value}
                  checked={formData.centres_interet.includes(option.value)}
                  onChange={(e) => handleCentresInteretChange(e.target.value)}
                  className="mr-3"
                />
                <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sélection du jingle */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sélectionnez votre jingle vidéo *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableJingles.map((jingle) => (
              <div
                key={jingle.id}
                className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.jingle === jingle.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                }`}
                onClick={() => handleInputChange('jingle', jingle.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {jingle.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      previewJingle(jingle.preview);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    Écouter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mots-clés */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mots-clés (séparés par des virgules)
          </label>
          <input
            type="text"
            value={formData.mots_cles}
            onChange={(e) => handleInputChange('mots_cles', e.target.value)}
            placeholder="ex: football, sport, passion, France, Maroc"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ces mots-clés vous aideront à être trouvé dans l'annuaire SpotBulle
          </p>
        </div>

        {/* Bouton de soumission */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
          >
            {loading ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sauvegarde...
              </span>
            ) : (
              '💾 Sauvegarder mon profil'
            )}
          </Button>
        </div>
      </form>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
          ℹ️ À propos de votre profil SpotBulle
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-200">
          Votre profil vous identifie dans la communauté SpotBulle France-Maroc. 
          Remplissez-le soigneusement pour bénéficier d'une expérience personnalisée 
          et pour être correctement référencé dans l'annuaire des participants.
        </p>
      </div>
    </div>
  );
};

export default ProfileForm;
