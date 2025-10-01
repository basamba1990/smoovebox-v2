// components/ProfileForm.jsx - VERSION COMPLÈTEMENT CORRIGÉE
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const ProfileForm = ({ onProfileUpdated = () => {} }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    sex: '',
    is_major: null,
    passions: [],
    skills: ''
  });

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  const passionsOptions = [
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
        .maybeSingle(); // Utiliser maybeSingle() pour éviter les 406

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur chargement profil:', error);
        toast.error('Erreur lors du chargement du profil');
        return;
      }

      if (data) {
        setFormData({
          sex: data.sex || '',
          is_major: data.is_major,
          passions: data.passions || [],
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || '')
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

  const handlePassionsChange = (value) => {
    setFormData(prev => ({
      ...prev,
      passions: prev.passions.includes(value)
        ? prev.passions.filter(item => item !== value)
        : [...prev.passions, value]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('Vous devez être connecté pour sauvegarder votre profil');
      return;
    }

    // Validation
    if (!formData.sex || formData.is_major === null || formData.passions.length === 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);

    try {
      const profileData = {
        id: currentUser.id,
        sex: formData.sex,
        is_major: formData.is_major,
        passions: formData.passions,
        skills: formData.skills.split(',').map(skill => skill.trim()).filter(skill => skill),
        updated_at: new Date().toISOString()
      };

      console.log('Données à sauvegarder:', profileData);

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
                  name="sex"
                  value={genre.toLowerCase()}
                  checked={formData.sex === genre.toLowerCase()}
                  onChange={(e) => handleInputChange('sex', e.target.value)}
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
            <label className="flex items-center">
              <input
                type="radio"
                name="is_major"
                value="true"
                checked={formData.is_major === true}
                onChange={(e) => handleInputChange('is_major', true)}
                className="mr-2"
                required
              />
              <span className="text-gray-700 dark:text-gray-300">Majeur</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="is_major"
                value="false"
                checked={formData.is_major === false}
                onChange={(e) => handleInputChange('is_major', false)}
                className="mr-2"
                required
              />
              <span className="text-gray-700 dark:text-gray-300">Mineur</span>
            </label>
          </div>
        </div>

        {/* Centres d'intérêt */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Centres d'intérêt *
          </label>
          <div className="space-y-2">
            {passionsOptions.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  value={option.value}
                  checked={formData.passions.includes(option.value)}
                  onChange={(e) => handlePassionsChange(e.target.value)}
                  className="mr-3"
                />
                <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
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
            value={formData.skills}
            onChange={(e) => handleInputChange('skills', e.target.value)}
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
