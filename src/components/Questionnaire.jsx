import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const Questionnaire = ({ onComplete, showSkip = true, isModal = false }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState({
    // Test 4 couleurs - 8 questions comme suggéré par Estelle
    colorQuiz: Array(8).fill(''),
    
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

  // Questions du test 4 couleurs
  const colorQuizQuestions = [
    {
      question: "Quand un défi se présente, tu :",
      options: [
        { value: 'red', label: 'fonces sans hésiter', emoji: '🔴' },
        { value: 'blue', label: 'réfléchis avant d\'agir', emoji: '🔵' },
        { value: 'green', label: 'encourages ton équipe', emoji: '🟢' },
        { value: 'yellow', label: 'imagines une autre solution', emoji: '🟡' }
      ]
    },
    {
      question: "Dans ton équipe, tu préfères :",
      options: [
        { value: 'red', label: 'être capitaine', emoji: '🔴' },
        { value: 'blue', label: 'observer la stratégie', emoji: '🔵' },
        { value: 'green', label: 'soutenir les autres', emoji: '🟢' },
        { value: 'yellow', label: 'créer l\'ambiance', emoji: '🟡' }
      ]
    },
    {
      question: "Ce que ton sport t'apprend le plus :",
      options: [
        { value: 'red', label: 'le courage', emoji: '🔴' },
        { value: 'blue', label: 'la discipline', emoji: '🔵' },
        { value: 'green', label: 'la solidarité', emoji: '🟢' },
        { value: 'yellow', label: 'la créativité', emoji: '🟡' }
      ]
    },
    {
      question: "Quand tu perds un match :",
      options: [
        { value: 'red', label: 'tu veux rejouer tout de suite', emoji: '🔴' },
        { value: 'blue', label: 'tu analyses ton erreur', emoji: '🔵' },
        { value: 'green', label: 'tu consoles ton coéquipier', emoji: '🟢' },
        { value: 'yellow', label: 'tu en rigoles pour relativiser', emoji: '🟡' }
      ]
    },
    {
      question: "Quand tu dois prendre une décision importante :",
      options: [
        { value: 'red', label: 'tu décides vite', emoji: '🔴' },
        { value: 'blue', label: 'tu listes les pour/contre', emoji: '🔵' },
        { value: 'green', label: 'tu demandes leur avis aux autres', emoji: '🟢' },
        { value: 'yellow', label: 'tu su ton intuition', emoji: '🟡' }
      ]
    },
    {
      question: "Face à une nouvelle règle ou consigne :",
      options: [
        { value: 'red', label: 'tu l\'appliques directement', emoji: '🔴' },
        { value: 'blue', label: 'tu vérifies chaque détail', emoji: '🔵' },
        { value: 'green', label: 'tu aides les autres à comprendre', emoji: '🟢' },
        { value: 'yellow', label: 'tu cherches à l\'améliorer', emoji: '🟡' }
      ]
    },
    {
      question: "Quand tu travailles en groupe :",
      options: [
        { value: 'red', label: 'tu prends le leadership', emoji: '🔴' },
        { value: 'blue', label: 'tu organises le travail', emoji: '🔵' },
        { value: 'green', label: 'tu facilites la communication', emoji: '🟢' },
        { value: 'yellow', label: 'tu proposes des idées innovantes', emoji: '🟡' }
      ]
    },
    {
      question: "Quand tu veux atteindre un objectif :",
      options: [
        { value: 'red', label: 'tu fonces tête baissée', emoji: '🔴' },
        { value: 'blue', label: 'tu planifies étape par étape', emoji: '🔵' },
        { value: 'green', label: 'tu t'entoures des bonnes personnes', emoji: '🟢' },
        { value: 'yellow', label: 'tu trouves des moyens originaux', emoji: '🟡' }
      ]
    }
  ];

  const colorProfiles = {
    red: { 
      name: 'Rouge - Leader passionné', 
      description: 'Décideur rapide, orienté action et résultats',
      traits: ['Leadership', 'Courage', 'Détermination']
    },
    blue: { 
      name: 'Bleu - Stratège rigoureux', 
      description: 'Analytique, organisé et soucieux des détails',
      traits: ['Rigueur', 'Discipline', 'Précision']
    },
    green: { 
      name: 'Vert - Équipier empathique', 
      description: 'Coopératif, à l\'écoute et solidaire',
      traits: ['Empathie', 'Coopération', 'Soutien']
    },
    yellow: { 
      name: 'Jaune - Créatif enthousiaste', 
      description: 'Innovant, optimiste et plein d\'idées',
      traits: ['Créativité', 'Innovation', 'Enthousiasme']
    }
  };

  useEffect(() => {
    if (user) {
      loadExistingResponses();
    }
  }, [user]);

  const loadExistingResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur chargement réponses:', error);
        return;
      }

      if (data) {
        setAnswers({
          colorQuiz: data.color_quiz || Array(8).fill(''),
          favoriteActivities: data.preferred_activities || [],
          workPreferences: data.work_preferences || [],
          currentTalent: data.current_talent || '',
          improvementAreas: data.improvement_areas || '',
          dreamDescription: data.dream_description || '',
          fiveYearVision: data.five_year_vision || '',
          inspirationPerson: data.inspiration_person || '',
          spotbulleNeeds: data.spotbulle_needs || []
        });
        
        if (data.completed_at) {
          setCurrentStep(4);
        }
      }
    } catch (error) {
      console.log('Aucune réponse existante trouvée');
    }
  };

  const handleColorQuizAnswer = (questionIndex, value) => {
    const newColorQuiz = [...answers.colorQuiz];
    newColorQuiz[questionIndex] = value;
    setAnswers(prev => ({
      ...prev,
      colorQuiz: newColorQuiz
    }));
  };

  const calculateDominantColor = () => {
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    answers.colorQuiz.forEach(answer => {
      if (answer && counts[answer] !== undefined) {
        counts[answer]++;
      }
    });
    
    let dominantColor = 'red';
    let maxCount = 0;
    
    Object.entries(counts).forEach(([color, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    });
    
    return dominantColor;
  };

  const handleArrayAnswer = (question, value, checked) => {
    setAnswers(prev => ({
      ...prev,
      [question]: checked 
        ? [...(prev[question] || []), value]
        : (prev[question] || []).filter(item => item !== value)
    }));
  };

  const submitQuestionnaire = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour sauvegarder le questionnaire');
      return;
    }

    setLoading(true);
    try {
      const dominantColor = calculateDominantColor();
      
      const { data: existingResponse, error: checkError } = await supabase
        .from('questionnaire_responses')
        .select('id, completed_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      let error;
      if (existingResponse) {
        ({ error } = await supabase
          .from('questionnaire_responses')
          .update({
            color_quiz: answers.colorQuiz,
            dominant_color: dominantColor,
            preferred_activities: answers.favoriteActivities,
            work_preferences: answers.workPreferences,
            current_talent: answers.currentTalent,
            improvement_areas: answers.improvementAreas,
            dream_description: answers.dreamDescription,
            five_year_vision: answers.fiveYearVision,
            inspiration_person: answers.inspirationPerson,
            spotbulle_needs: answers.spotbulleNeeds,
            completed_at: new Date().toISOString()
          })
          .eq('id', existingResponse.id));
      } else {
        ({ error } = await supabase
          .from('questionnaire_responses')
          .insert({
            user_id: user.id,
            color_quiz: answers.colorQuiz,
            dominant_color: dominantColor,
            preferred_activities: answers.favoriteActivities,
            work_preferences: answers.workPreferences,
            current_talent: answers.currentTalent,
            improvement_areas: answers.improvementAreas,
            dream_description: answers.dreamDescription,
            five_year_vision: answers.fiveYearVision,
            inspiration_person: answers.inspirationPerson,
            spotbulle_needs: answers.spotbulleNeeds,
            completed_at: new Date().toISOString()
          }));
      }

      if (error) throw error;

      // Afficher le résultat du profil
      const profile = colorProfiles[dominantColor];
      toast.success(`Profil ${profile.name} identifié !`);
      
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
              Partie 1 – Test de personnalité 4 couleurs
            </h3>
            <p className="text-gray-600 mb-6">
              Répondez à ces 8 questions pour découvrir votre profil émotionnel dominant
            </p>
            
            <div className="space-y-6">
              {colorQuizQuestions.map((quiz, index) => (
                <div key={index} className="p-4 border rounded-lg bg-white">
                  <p className="font-medium mb-3">{index + 1}. {quiz.question}</p>
                  <div className="space-y-3">
                    {quiz.options.map(option => (
                      <label key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name={`colorQuiz-${index}`}
                          value={option.value}
                          checked={answers.colorQuiz[index] === option.value}
                          onChange={() => handleColorQuizAnswer(index, option.value)}
                          className="mt-1 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <span className="text-lg mr-2">{option.emoji}</span>
                          <span className="text-gray-700">{option.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
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
                <p className="font-medium mb-3">9. Ce que j'aime le plus faire :</p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { value: 'kinesthetic', label: '🏃 Bouger, courir, manipuler des objets (Kinesthésique)' },
                    { value: 'musical', label: '🎵 Chanter, écouter de la musique (Musicale)' },
                    { value: 'linguistic', label: '📚 Lire, écrire, raconter des histoires (Linguistique)' },
                    { value: 'logical', label: '🧮 Résoudre des problèmes, calculer (Logico-mathématique)' }
                  ].map(option => (
                    <label key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={(answers.favoriteActivities || []).includes(option.value)}
                        onChange={(e) => handleArrayAnswer('favoriteActivities', option.value, e.target.checked)}
                        className="mt-1 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-medium mb-3">10. Quand je travaille, je préfère :</p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { value: 'naturalist', label: '🌳 Être dehors, observer la nature (Naturaliste)' },
                    { value: 'interpersonal', label: '👥 Être avec des amis, discuter (Interpersonnelle)' },
                    { value: 'intrapersonal', label: '🧘 Être seul pour réfléchir (Intrapersonnelle)' },
                    { value: 'visual', label: '🎨 Dessiner, construire, imaginer des images (Visuo-spatiale)' }
                  ].map(option => (
                    <label key={option.value} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={(answers.workPreferences || []).includes(option.value)}
                        onChange={(e) => handleArrayAnswer('workPreferences', option.value, e.target.checked)}
                        className="mt-1 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-gray-700">{option.label}</span>
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
                { key: 'currentTalent', label: '11. Mon plus grand talent aujourd\'hui est :', placeholder: 'Décrivez votre talent principal...' },
                { key: 'improvementAreas', label: '12. Ce que je voudrais améliorer chez moi :', placeholder: 'Quelles compétences souhaitez-vous développer ?' },
                { key: 'dreamDescription', label: '13. Si je devais décrire mon rêve en une phrase :', placeholder: 'Votre plus grand rêve...' },
                { key: 'fiveYearVision', label: '14. Dans 5 ans, je voudrais que les gens disent de moi :', placeholder: 'Comment souhaitez-vous être perçu ?' },
                { key: 'inspirationPerson', label: '15. La personne qui m\'inspire le plus est :', placeholder: 'Qui vous inspire dans la vie ?' }
              ].map(field => (
                <div key={field.key}>
                  <label className="block font-medium mb-2 text-gray-700">{field.label}</label>
                  <textarea
                    value={answers[field.key] || ''}
                    onChange={(e) => handleAnswer(field.key, e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    rows={3}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              <div>
                <p className="font-medium mb-3 text-gray-700">16. Si SpotBulle devait m'aider, j'aimerais que ce soit pour :</p>
                <div className="space-y-2">
                  {[
                    'M\'exprimer mieux à l\'oral',
                    'Être plus sûr de moi',
                    'Trouver un mentor ou un modèle',
                    'Construire mon futur métier'
                  ].map(need => (
                    <label key={need} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={(answers.spotbulleNeeds || []).includes(need)}
                        onChange={(e) => handleArrayAnswer('spotbulleNeeds', need, e.target.checked)}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-gray-700">{need}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        const dominantColor = calculateDominantColor();
        const profile = colorProfiles[dominantColor];
        
        return (
          <div className="text-center space-y-6">
            <div className={`p-8 rounded-2xl bg-gradient-to-br ${
              dominantColor === 'red' ? 'from-red-100 to-red-200 border-red-300' :
              dominantColor === 'blue' ? 'from-blue-100 to-blue-200 border-blue-300' :
              dominantColor === 'green' ? 'from-green-100 to-green-200 border-green-300' :
              'from-yellow-100 to-yellow-200 border-yellow-300'
            } border-2`}>
              <div className="text-6xl mb-4">
                {dominantColor === 'red' ? '🔴' :
                 dominantColor === 'blue' ? '🔵' :
                 dominantColor === 'green' ? '🟢' : '🟡'}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{profile.name}</h3>
              <p className="text-gray-700 mb-4">{profile.description}</p>
              
              <div className="flex justify-center gap-2 mb-4">
                {profile.traits.map((trait, index) => (
                  <span key={index} className="px-3 py-1 bg-white/80 rounded-full text-sm font-medium">
                    {trait}
                  </span>
                ))}
              </div>
              
              <p className="text-sm text-gray-600">
                Votre QR code de restitution est disponible dans votre tableau de bord
              </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-700 text-sm">
                🎯 <strong>Votre parcours SpotBulle Immersion est maintenant personnalisé</strong><br/>
                Accédez aux simulateurs et scénarios adaptés à votre profil
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const handleAnswer = (question, value) => {
    setAnswers(prev => ({
      ...prev,
      [question]: value
    }));
  };

  const allColorQuestionsAnswered = answers.colorQuiz.every(answer => answer !== '');
  const canProceed = currentStep === 1 ? allColorQuestionsAnswered : true;

  return (
    <div className={`bg-white rounded-xl shadow-lg ${isModal ? '' : 'p-6 max-w-2xl mx-auto'}`}>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-primary-900 mb-2">
          {currentStep === 4 ? '🎉 Profil Identifié !' : '📝 Questionnaire SpotBulle Immersion'}
        </h2>
        <p className="text-gray-600">
          {currentStep === 4 ? 'Découvrez votre profil personnalité' : 'Complétez votre profil pour mieux vous connecter avec la communauté'}
        </p>
        
        {/* Indicateur de progression */}
        {currentStep < 4 && (
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
        )}
      </div>

      {renderStep()}

      {currentStep < 4 && (
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1}
            variant="outline"
            className="px-6"
          >
            ← Précédent
          </Button>

          <div className="space-x-3">
            {showSkip && (
              <Button
                onClick={onComplete}
                variant="outline"
                className="px-6"
              >
                Passer
              </Button>
            )}
            
            {currentStep < 3 ? (
              <Button
                onClick={nextStep}
                disabled={!canProceed}
                className="bg-primary-600 hover:bg-primary-700 px-6"
              >
                Suivant →
              </Button>
            ) : (
              <Button
                onClick={submitQuestionnaire}
                loading={loading}
                disabled={!canProceed}
                className="bg-primary-600 hover:bg-primary-700 px-6"
              >
                {loading ? 'Sauvegarde...' : 'Terminer le questionnaire'}
              </Button>
            )}
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="flex justify-center mt-8 pt-6 border-t border-gray-200">
          <Button
            onClick={onComplete}
            className="bg-primary-600 hover:bg-primary-700 px-8"
          >
            Commencer l'aventure →
          </Button>
        </div>
      )}
    </div>
  );
};

export default Questionnaire;
