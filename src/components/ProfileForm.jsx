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
  const [validationErrors, setValidationErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const supabase = useSupabaseClient();
  const currentUser = useUser();

  // ✅ CORRECTION : Centres d'intérêt football clarifiés selon Estelle
  const passionsOptions = [
    {
      value: 'club_football',
      label: 'J\'admire un club de football',
      description: 'Supporteur d\'un club spécifique'
    },
    {
      value: 'passion_football', 
      label: 'Passionné(e) de football',
      description: 'Amour du jeu et de la compétition'
    },
    {
      value: 'metiers_football',
      label: 'Intéressé(e) par les métiers du football',
      description: 'Carrières professionnelles dans le foot'
    }
  ];

  // ✅ CORRECTION : Chargement du profil avec gestion d'erreur améliorée
  useEffect(() => {
    if (currentUser) {
      loadProfile();
    }
  }, [currentUser]);

  const loadProfile = async () => {
    try {
      console.log('📥 Chargement du profil pour:', currentUser?.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ Aucun profil existant, création d\'un nouveau');
          return;
        }
        console.error('❌ Erreur chargement profil:', error);
        toast.error('Erreur lors du chargement du profil');
        return;
      }

      if (data) {
        console.log('✅ Profil chargé:', data);
        setFormData({
          sex: data.sex || '',
          is_major: data.is_major,
          passions: data.passions || [],
          skills: Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || '')
        });
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement du profil:', error);
      toast.error('Erreur lors du chargement du profil');
    }
  };

  // ✅ CORRECTION : Validation en temps réel
  const validateForm = () => {
    const errors = {};

    if (!formData.sex) {
      errors.sex = 'Le genre est obligatoire';
    }
    if (formData.is_major === null) {
      errors.is_major = 'Le statut est obligatoire';
    }
    if (formData.passions.length === 0) {
      errors.passions = 'Veuillez sélectionner au moins un centre d\'intérêt';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // ✅ Effacer l'erreur de validation quand l'utilisateur corrige
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePassionsChange = (value) => {
    const newPassions = formData.passions.includes(value)
      ? formData.passions.filter(item => item !== value)
      : [...formData.passions, value];

    setFormData(prev => ({ ...prev, passions: newPassions }));
    
    // ✅ Effacer l'erreur de validation des passions
    if (validationErrors.passions && newPassions.length > 0) {
      setValidationErrors(prev => ({ ...prev, passions: '' }));
    }
  };

  // ✅ CORRECTION : Soumission avec validation robuste
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);

    if (!currentUser) {
      toast.error('Vous devez être connecté pour sauvegarder votre profil');
      return;
    }

    // Validation
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    setLoading(true);
    
    // ✅ CORRECTION : Feedback visuel immédiat
    toast.info('⏳ Sauvegarde en cours...');

    try {
      const profileData = {
        id: currentUser.id,
        sex: formData.sex,
        is_major: formData.is_major,
        passions: formData.passions,
        skills: formData.skills.split(',').map(skill => skill.trim()).filter(skill => skill),
        updated_at: new Date().toISOString()
      };

      console.log('💾 Sauvegarde du profil:', profileData);

      // ✅ CORRECTION : Utilisation de upsert avec gestion de conflit
      const { error } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'id',
          returning: 'minimal'
        });

      if (error) {
        console.error('❌ Erreur Supabase:', error);
        if (error.code === '23505') {
          throw new Error('Un profil existe déjà pour cet utilisateur');
        } else if (error.code === '42501') {
          throw new Error('Permissions insuffisantes pour sauvegarder le profil');
        } else {
          throw error;
        }
      }

      console.log('✅ Profil sauvegardé avec succès');
      toast.success('✅ Profil sauvegardé avec succès !');

      // ✅ Callback pour informer le parent
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde profil:', error);
      toast.error(`❌ Erreur lors de la sauvegarde: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-french font-bold text-gray-900 dark:text-white mb-2">
          👤 Compléter mon profil SpotBulle
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Remplissez votre profil pour une expérience personnalisée
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Genre avec validation */}
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
          {validationErrors.sex && (
            <p className="text-red-600 text-sm mt-1">{validationErrors.sex}</p>
          )}
        </div>

        {/* Statut avec validation */}
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
          {validationErrors.is_major && (
            <p className="text-red-600 text-sm mt-1">{validationErrors.is_major}</p>
          )}
        </div>

        {/* ✅ CORRECTION : Centres d'intérêt FOOTBALL avec validation */}
        <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            🎯 Centres d'intérêt FOOTBALL *
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Sélectionnez vos domaines d'intérêt dans le football selon les suggestions d'Estelle
          </p>
          <div className="space-y-3">
            {passionsOptions.map((option) => (
              <label key={option.value} className="flex items-start space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  value={option.value}
                  checked={formData.passions.includes(option.value)}
                  onChange={(e) => handlePassionsChange(e.target.value)}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {option.label}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {option.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {validationErrors.passions && (
            <p className="text-red-600 text-sm mt-2">{validationErrors.passions}</p>
          )}
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

        {/* ✅ CORRECTION : Bouton de soumission avec meilleur feedback */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                Sauvegarde en cours...
              </span>
            ) : (
              <span className="flex items-center">
                💾 Sauvegarder mon profil
              </span>
            )}
          </Button>
        </div>

        {/* ✅ Indication des champs obligatoires */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          * Champs obligatoires
        </div>
      </form>

      {/* Instructions améliorées */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
          ℹ️ À propos de votre profil SpotBulle
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-200">
          Votre profil vous identifie dans la communauté SpotBulle France-Maroc. Remplissez-le soigneusement pour bénéficier d'une expérience personnalisée et pour être correctement référencé dans l'annuaire des participants.
        </p>
      </div>

      {/* ✅ Debug info (à retirer en production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs">
          <p><strong>Debug:</strong> User: {currentUser?.id} | Passions: {formData.passions.join(', ')}</p>
        </div>
      )}
    </div>
  );
};

export default ProfileForm;
