import { useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const Questionnaire = ({ onComplete, showSkip = true }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState({
    // Partie DISC
    discGroupPreference: '',
    challengeApproach: '',
    
    // Intelligences multiples
    favoriteActivities: [],
    workPreferences: [],
    
    // Talent & Projection
    currentTalent: '',
    improvementAreas: '',
    dreamDescription: '',
    fiveYearVision: '',
    inspirationPerson: '',
    spotbulleNeeds: []
  });

  const [loading, setLoading] = useState(false);
  const supabase = useSupabaseClient();
  const user = useUser();

  const handleAnswer = (question, value) => {
    setAnswers(prev => ({
      ...prev,
      [question]: value
    }));
  };

  const handleArrayAnswer = (question, value, checked) => {
    setAnswers(prev => ({
      ...prev,
      [question]: checked 
        ? [...prev[question], value]
        : prev[question].filter(item => item !== value)
    }));
  };

  const submitQuestionnaire = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour sauvegarder le questionnaire');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('questionnaire_responses')
        .insert({
          user_id: user.id,
          disc_color: answers.discGroupPreference,
          challenge_approach: answers.challengeApproach,
          preferred_activities: answers.favoriteActivities,
          work_preferences: answers.workPreferences,
          current_talent: answers.currentTalent,
          improvement_areas: answers.improvementAreas,
          dream_description: answers.dreamDescription,
          five_year_vision: answers.fiveYearVision,
          inspiration_person: answers.inspirationPerson,
          spotbulle_needs: answers.spotbulleNeeds,
          completed_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Questionnaire sauvegardé avec succès !');
      if (onComplete) onComplete();
      
    } catch (error) {
      console.error('Erreur sauvegarde questionnaire:', error);
      toast.error('Erreur lors de la sauvegarde du questionnaire');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  // Écrans du questionnaire
  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-primary-900 mb-4">
              Partie 1 – DISC (4 couleurs)
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-3">1. Quand je fais partie d'un groupe, je préfère :</p>
                <div className="space-y-2">
                  {[
                    { value: 'red', label: 'Décider vite et diriger les autres', emoji: '🔴' },
                    { value: 'yellow', label: 'Motiver et inspirer par mon énergie', emoji: '🟡' },
                    { value: 'green', label: 'Écouter et aider chacun à se sentir bien', emoji: '🟢' },
                    { value: 'blue', label: 'Vérifier les détails et organiser les choses', emoji: '🔵' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="groupPreference"
                        value={option.value}
                        checked={answers.discGroupPreference === option.value}
                        onChange={(e) => handleAnswer('discGroupPreference', e.target.value)}
                        className="text-primary-600"
                      />
                      <span className="text-lg">{option.emoji}</span>
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-medium mb-3">2. Face à un défi, je réagis en général en :</p>
                <div className="space-y-2">
                  {[
                    { value: 'direct', label: 'Agissant directement et rapidement' },
                    { value: 'creative', label: 'Imaginant des solutions créatives' },
                    { value: 'collaborative', label: 'Demandant de l\'aide ou en travaillant avec les autres' },
                    { value: 'analytical', label: 'Analysant calmement avant d\'agir' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="radio"
                        name="challengeApproach"
                        value={option.value}
                        checked={answers.challengeApproach === option.value}
                        onChange={(e) => handleAnswer('challengeApproach', e.target.value)}
                        className="text-primary-600"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-primary-900 mb-4">
              Partie 2 – Intelligences multiples
            </h3>

            <div className="space-y-6">
              <div>
                <p className="font-medium mb-3">3. Ce que j'aime le plus faire :</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { value: 'kinesthetic', label: 'Bouger, courir, manipuler des objets' },
                    { value: 'musical', label: 'Chanter, écouter de la musique' },
                    { value: 'linguistic', label: 'Lire, écrire, raconter des histoires' },
                    { value: 'logical', label: 'Résoudre des problèmes, calculer' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={answers.favoriteActivities.includes(option.value)}
                        onChange={(e) => handleArrayAnswer('favoriteActivities', option.value, e.target.checked)}
                        className="text-primary-600"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-medium mb-3">4. Quand je travaille, je préfère :</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { value: 'naturalist', label: 'Être dehors, observer la nature' },
                    { value: 'interpersonal', label: 'Être avec des amis, discuter' },
                    { value: 'intrapersonal', label: 'Être seul pour réfléchir' },
                    { value: 'visual', label: 'Dessiner, construire, imaginer des images' }
                  ].map(option => (
                    <label key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={answers.workPreferences.includes(option.value)}
                        onChange={(e) => handleArrayAnswer('workPreferences', option.value, e.target.checked)}
                        className="text-primary-600"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-primary-900 mb-4">
              Partie 3 – Talent & Projection
            </h3>

            <div className="space-y-4">
              {[
                { key: 'currentTalent', label: '5. Mon plus grand talent aujourd\'hui est :' },
                { key: 'improvementAreas', label: '6. Ce que je voudrais améliorer chez moi :' },
                { key: 'dreamDescription', label: '7. Si je devais décrire mon rêve en une phrase :' },
                { key: 'fiveYearVision', label: '8. Dans 5 ans, je voudrais que les gens disent de moi :' },
                { key: 'inspirationPerson', label: '9. La personne qui m\'inspire le plus est :' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block font-medium mb-2">{field.label}</label>
                  <textarea
                    value={answers[field.key]}
                    onChange={(e) => handleAnswer(field.key, e.target.value)}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                    placeholder="Votre réponse..."
                  />
                </div>
              ))}

              <div>
                <p className="font-medium mb-3">10. Si SpotBulle devait m'aider, j'aimerais que ce soit pour :</p>
                <div className="space-y-2">
                  {[
                    'M\'exprimer mieux à l\'oral',
                    'Être plus sûr de moi',
                    'Trouver un mentor ou un modèle',
                    'Construire mon futur métier'
                  ].map(need => (
                    <label key={need} className="flex items-center space-x-3 p-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={answers.spotbulleNeeds.includes(need)}
                        onChange={(e) => handleArrayAnswer('spotbulleNeeds', need, e.target.checked)}
                        className="text-primary-600"
                      />
                      <span>{need}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary-900 mb-2">
          📝 Questionnaire SpotBulle
        </h2>
        <p className="text-gray-600">
          Complétez votre profil pour mieux vous connecter avec la communauté
        </p>
        
        {/* Indicateur de progression */}
        <div className="flex justify-center space-x-2 mt-4">
          {[1, 2, 3].map(step => (
            <div
              key={step}
              className={`w-3 h-3 rounded-full ${
                step === currentStep 
                  ? 'bg-primary-600' 
                  : step < currentStep 
                    ? 'bg-primary-300' 
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {renderStep()}

      <div className="flex justify-between mt-8 pt-6 border-t">
        <Button
          onClick={prevStep}
          disabled={currentStep === 1}
          variant="outline"
        >
          ← Précédent
        </Button>

        <div className="space-x-3">
          {showSkip && (
            <Button
              onClick={onComplete}
              variant="outline"
            >
              Passer
            </Button>
          )}
          
          {currentStep < 3 ? (
            <Button
              onClick={nextStep}
              className="bg-primary-600 hover:bg-primary-700"
            >
              Suivant →
            </Button>
          ) : (
            <Button
              onClick={submitQuestionnaire}
              loading={loading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {loading ? 'Sauvegarde...' : 'Terminer le questionnaire'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
