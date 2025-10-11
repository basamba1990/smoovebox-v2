// components/Questionnaire.jsx
import { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const Questionnaire = ({ onComplete, showSkip = true, isModal = false }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [answers, setAnswers] = useState({
    colorQuiz: Array(8).fill(''),
    favoriteActivities: [],
    workPreferences: [],
    currentTalent: '',
    improvementAreas: '',
    dreamDescription: '',
    fiveYearVision: '',
    inspirationPerson: '',
    spotbulleNeeds: []
  });

  const [loading, setLoading] = useState(false);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const supabase = useSupabaseClient();
  const user = useUser();

  // Questions avec valeurs sécurisées
  const colorQuizQuestions = [
    {
      question: "Quand un défi se présente, tu :",
      options: [
        { value: 'red', label: 'fonces sans hésiter', emoji: '⚡' },
        { value: 'blue', label: 'réfléchis avant d\'agir', emoji: '🧠' },
        { value: 'green', label: 'encourages ton équipe', emoji: '🤝' },
        { value: 'yellow', label: 'imagines une autre solution', emoji: '💡' }
      ]
    },
    {
      question: "Dans ton équipe, tu préfères :",
      options: [
        { value: 'red', label: 'être capitaine', emoji: '👑' },
        { value: 'blue', label: 'observer la stratégie', emoji: '📊' },
        { value: 'green', label: 'soutenir les autres', emoji: '🌟' },
        { value: 'yellow', label: 'créer l\'ambiance', emoji: '🎉' }
      ]
    },
    {
      question: "Ce que ton sport t'apprend le plus :",
      options: [
        { value: 'red', label: 'le courage', emoji: '🦁' },
        { value: 'blue', label: 'la discipline', emoji: '⏰' },
        { value: 'green', label: 'la solidarité', emoji: '👥' },
        { value: 'yellow', label: 'la créativité', emoji: '🎨' }
      ]
    },
    {
      question: "Quand tu perds un match :",
      options: [
        { value: 'red', label: 'tu veux rejouer tout de suite', emoji: '🔄' },
        { value: 'blue', label: 'tu analyses ton erreur', emoji: '🔍' },
        { value: 'green', label: 'tu consoles ton coéquipier', emoji: '💝' },
        { value: 'yellow', label: 'tu en rigoles pour relativiser', emoji: '😄' }
      ]
    },
    {
      question: "Quand tu dois prendre une décision importante :",
      options: [
        { value: 'red', label: 'tu décides vite', emoji: '🎯' },
        { value: 'blue', label: 'tu listes les pour/contre', emoji: '📝' },
        { value: 'green', label: 'tu demandes leur avis aux autres', emoji: '🗣️' },
        { value: 'yellow', label: 'tu suis ton intuition', emoji: '🔮' }
      ]
    },
    {
      question: "Face à une nouvelle règle ou consigne :",
      options: [
        { value: 'red', label: 'tu l\'appliques directement', emoji: '✅' },
        { value: 'blue', label: 'tu vérifies chaque détail', emoji: '🔎' },
        { value: 'green', label: 'tu aides les autres à comprendre', emoji: '👨‍🏫' },
        { value: 'yellow', label: 'tu cherches à l\'améliorer', emoji: '🚀' }
      ]
    },
    {
      question: "Quand tu travailles en groupe :",
      options: [
        { value: 'red', label: 'tu prends le leadership', emoji: '👑' },
        { value: 'blue', label: 'tu organises le travail', emoji: '📋' },
        { value: 'green', label: 'tu facilites la communication', emoji: '📞' },
        { value: 'yellow', label: 'tu proposes des idées innovantes', emoji: '💡' }
      ]
    },
    {
      question: "Quand tu veux atteindre un objectif :",
      options: [
        { value: 'red', label: 'tu fonces tête baissée', emoji: '💨' },
        { value: 'blue', label: 'tu planifies étape par étape', emoji: '🗓️' },
        { value: 'green', label: 'tu t\'entoures des bonnes personnes', emoji: '👥' },
        { value: 'yellow', label: 'tu trouves des moyens originaux', emoji: '🎭' }
      ]
    }
  ];

  const colorProfiles = {
    red: { 
      name: 'Leader passionné', 
      emoji: '🦁',
      description: 'Décideur rapide, orienté action et résultats',
      traits: ['Leadership', 'Courage', 'Détermination'],
      color: 'red',
      characteristics: [
        'Prend des décisions rapidement',
        'Aime les défis et la compétition',
        'Direct et orienté résultats',
        'Naturellement confiant'
      ]
    },
    blue: { 
      name: 'Stratège rigoureux', 
      emoji: '🧠',
      description: 'Analytique, organisé et soucieux des détails',
      traits: ['Rigueur', 'Discipline', 'Précision'],
      color: 'blue',
      characteristics: [
        'Aime les détails et la précision',
        'Réfléchit avant d\'agir',
        'Organisé et méthodique',
        'Fiable et consciencieux'
      ]
    },
    green: { 
      name: 'Équipier empathique', 
      emoji: '🤝',
      description: 'Coopératif, à l\'écoute et solidaire',
      traits: ['Empathie', 'Coopération', 'Soutien'],
      color: 'green',
      characteristics: [
        'Excellent communicateur',
        'Soutient les autres naturellement',
        'Crée l\'harmonie dans le groupe',
        'À l\'écoute des besoins'
      ]
    },
    yellow: { 
      name: 'Créatif enthousiaste', 
      emoji: '💡',
      description: 'Innovant, optimiste et plein d\'idées',
      traits: ['Créativité', 'Innovation', 'Enthousiasme'],
      color: 'yellow',
      characteristics: [
        'Plein d\'idées nouvelles',
        'Enthousiaste et énergique',
        'Aime l\'innovation et le changement',
        'Excellent pour motiver les autres'
      ]
    }
  };

  // Vérification renforcée de la connexion
  useEffect(() => {
    const checkConnection = async () => {
      if (!user) {
        console.log('❌ Utilisateur non connecté, questionnaire en attente');
        return;
      }
      
      try {
        // Test de connexion à la table questionnaire_responses
        const { error } = await supabase
          .from('questionnaire_responses')
          .select('id')
          .limit(1);
          
        if (error) {
          console.error('❌ Erreur connexion table questionnaire:', error);
          toast.error('Service temporairement indisponible');
          return;
        }
        
        console.log('✅ Connexion questionnaire validée');
        setConnectionChecked(true);
        loadExistingResponses();
      } catch (error) {
        console.error('❌ Erreur critique questionnaire:', error);
        toast.error('Erreur de connexion au service');
      }
    };
    
    if (user) {
      checkConnection();
    }
  }, [user, supabase]);

  // Chargement sécurisé des réponses existantes
  const loadExistingResponses = async () => {
    if (!user) return;
    
    try {
      console.log('📥 Chargement des réponses existantes pour:', user.id);
      
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (error.code === '406' || error.message?.includes('406')) {
          console.log('ℹ️ Aucune réponse existante trouvée (erreur 406 normale)');
          return;
        }
        console.error('❌ Erreur chargement réponses:', error);
        toast.error('Erreur lors du chargement des réponses existantes');
        return;
      }

      if (data) {
        console.log('✅ Réponses existantes chargées:', data.id);
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
          console.log('📝 Questionnaire déjà complété, passage à l\'étape 4');
          setCurrentStep(4);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des réponses:', error);
      toast.error('Erreur lors du chargement de vos données');
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
        ? [...(prev[question] || []), value]
        : (prev[question] || []).filter(item => item !== value)
    }));
  };

  // CORRECTION CRITIQUE : Sauvegarde robuste avec validation des données
  const submitQuestionnaire = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour sauvegarder le questionnaire');
      return;
    }

    // Validation des données avant envoi
    if (!answers.colorQuiz.every(answer => answer !== '')) {
      toast.error('Veuillez répondre à toutes les questions de couleur');
      return;
    }

    setLoading(true);
    
    try {
      console.log('💾 Sauvegarde du questionnaire pour:', user.id);
      
      const dominantColor = calculateDominantColor();
      
      // Préparation des données avec validation
      const questionnaireData = {
        color_quiz: answers.colorQuiz,
        dominant_color: dominantColor,
        preferred_activities: Array.isArray(answers.favoriteActivities) ? answers.favoriteActivities : [],
        work_preferences: Array.isArray(answers.workPreferences) ? answers.workPreferences : [],
        current_talent: answers.currentTalent || '',
        improvement_areas: answers.improvementAreas || '',
        dream_description: answers.dreamDescription || '',
        five_year_vision: answers.fiveYearVision || '',
        inspiration_person: answers.inspirationPerson || '',
        spotbulle_needs: Array.isArray(answers.spotbulleNeeds) ? answers.spotbulleNeeds : [],
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📤 Données à sauvegarder:', questionnaireData);

      // CORRECTION : Utilisation de upsert au lieu de insert/update séparés
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .upsert({
          user_id: user.id,
          ...questionnaireData
        }, {
          onConflict: 'user_id',
          returning: 'minimal'
        });

      if (error) {
        console.error('❌ Erreur détaillée sauvegarde questionnaire:', error);
        
        // Gestion spécifique des erreurs courantes
        if (error.code === '23505') {
          toast.error('Un questionnaire existe déjà pour cet utilisateur');
        } else if (error.code === '42501') {
          toast.error('Permissions insuffisantes pour sauvegarder');
        } else if (error.code === '406' || error.message?.includes('406')) {
          toast.error('Format de données invalide');
        } else if (error.code === '400') {
          toast.error('Données invalides - vérifiez les champs requis');
        } else {
          toast.error(`Erreur technique: ${error.message}`);
        }
        return;
      }

      // Mise à jour du profil utilisateur avec gestion d'erreur
      try {
        await supabase
          .from('profiles')
          .update({ 
            dominant_color: dominantColor,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } catch (profileError) {
        console.warn('⚠️ Impossible de mettre à jour le profil:', profileError);
        // Continuer même si la mise à jour du profil échoue
      }

      // Afficher le résultat du profil
      const profile = colorProfiles[dominantColor];
      console.log('🎉 Questionnaire sauvegardé avec profil:', profile.name);
      toast.success(`Profil ${profile.name} identifié !`);
      
      // Passer à l'étape des résultats
      setCurrentStep(4);
      
    } catch (error) {
      console.error('❌ Erreur inattendue sauvegarde questionnaire:', error);
      toast.error('Erreur inattendue lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteQuestionnaire = () => {
    if (onComplete) {
      onComplete();
    }
  };

  const nextStep = () => setCurrentStep(prev => prev + 1);
  const prevStep = () => setCurrentStep(prev => prev - 1);

  // Rendu des étapes
  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🎭</div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">
                Découvre ton profil émotionnel
              </h3>
              <p className="text-gray-600">
                Réponds naturellement à ces 8 questions pour révéler ta personnalité unique
              </p>
            </div>
            
            <div className="space-y-6">
              {colorQuizQuestions.map((quiz, index) => (
                <div key={index} className="p-6 border-2 border-gray-200 rounded-xl bg-white hover:border-primary-200 transition-all duration-300">
                  <p className="font-medium mb-4 text-lg text-gray-800">
                    {index + 1}. {quiz.question}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quiz.options.map(option => (
                      <label 
                        key={option.value} 
                        className={`flex items-start space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                          answers.colorQuiz[index] === option.value
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`colorQuiz-${index}`}
                          value={option.value}
                          checked={answers.colorQuiz[index] === option.value}
                          onChange={() => handleColorQuizAnswer(index, option.value)}
                          className="mt-1 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{option.emoji}</span>
                          <span className="text-gray-700 font-medium">{option.label}</span>
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
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🌟</div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">
                Tes super-pouvoirs naturels
              </h3>
              <p className="text-gray-600">
                Identifie tes intelligences multiples pour mieux les développer
              </p>
            </div>

            <div className="space-y-8">
              <div className="p-6 border-2 border-gray-200 rounded-xl bg-white">
                <p className="font-medium mb-4 text-lg text-gray-800">9. Ce que j'aime le plus faire :</p>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { value: 'kinesthetic', label: '🏃 Bouger, courir, manipuler des objets', description: 'Intelligence Kinesthésique' },
                    { value: 'musical', label: '🎵 Chanter, écouter de la musique', description: 'Intelligence Musicale' },
                    { value: 'linguistic', label: '📚 Lire, écrire, raconter des histoires', description: 'Intelligence Linguistique' },
                    { value: 'logical', label: '🧮 Résoudre des problèmes, calculer', description: 'Intelligence Logico-mathématique' }
                  ].map(option => (
                    <label key={option.value} className={`flex items-start space-x-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      (answers.favoriteActivities || []).includes(option.value)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={(answers.favoriteActivities || []).includes(option.value)}
                        onChange={(e) => handleArrayAnswer('favoriteActivities', option.value, e.target.checked)}
                        className="mt-1 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{option.label}</div>
                        <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-6 border-2 border-gray-200 rounded-xl bg-white">
                <p className="font-medium mb-4 text-lg text-gray-800">10. Quand je travaille, je préfère :</p>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { value: 'naturalist', label: '🌳 Être dehors, observer la nature', description: 'Intelligence Naturaliste' },
                    { value: 'interpersonal', label: '👥 Être avec des amis, discuter', description: 'Intelligence Interpersonnelle' },
                    { value: 'intrapersonal', label: '🧘 Être seul pour réfléchir', description: 'Intelligence Intrapersonnelle' },
                    { value: 'visual', label: '🎨 Dessiner, construire, imaginer', description: 'Intelligence Visuo-spatiale' }
                  ].map(option => (
                    <label key={option.value} className={`flex items-start space-x-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      (answers.workPreferences || []).includes(option.value)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={(answers.workPreferences || []).includes(option.value)}
                        onChange={(e) => handleArrayAnswer('workPreferences', option.value, e.target.checked)}
                        className="mt-1 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{option.label}</div>
                        <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                      </div>
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
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold text-primary-900 mb-2">
                Ton avenir commence ici
              </h3>
              <p className="text-gray-600">
                Partage tes rêves et construisons ensemble ton parcours
              </p>
            </div>

            <div className="space-y-6">
              {[
                { key: 'currentTalent', label: '11. Mon plus grand talent aujourd\'hui est :', placeholder: 'Décris ce que tu fais le mieux naturellement...', emoji: '💎' },
                { key: 'improvementAreas', label: '12. Ce que je voudrais améliorer chez moi :', placeholder: 'Quelles compétences souhaiterais-tu développer ?', emoji: '📈' },
                { key: 'dreamDescription', label: '13. Si je devais décrire mon rêve en une phrase :', placeholder: 'Ton plus grand rêve, même le plus fou...', emoji: '🌈' },
                { key: 'fiveYearVision', label: '14. Dans 5 ans, je voudrais que les gens disent de moi :', placeholder: 'Comment aimerais-tu être perçu dans 5 ans ?', emoji: '🔮' },
                { key: 'inspirationPerson', label: '15. La personne qui m\'inspire le plus est :', placeholder: 'Qui t\'inspire dans la vie, le sport ou ailleurs ?', emoji: '👑' }
              ].map(field => (
                <div key={field.key} className="p-4 border-2 border-gray-200 rounded-xl bg-white">
                  <label className="block font-medium mb-3 text-gray-800 flex items-center space-x-2">
                    <span>{field.emoji}</span>
                    <span>{field.label}</span>
                  </label>
                  <textarea
                    value={answers[field.key] || ''}
                    onChange={(e) => handleAnswer(field.key, e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                    rows={3}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              <div className="p-6 border-2 border-gray-200 rounded-xl bg-white">
                <p className="font-medium mb-4 text-lg text-gray-800 flex items-center space-x-2">
                  <span>🎯</span>
                  <span>16. Si SpotBulle devait m'aider, j'aimerais que ce soit pour :</span>
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    'M\'exprimer mieux à l\'oral',
                    'Être plus sûr de moi',
                    'Trouver un mentor ou un modèle',
                    'Construire mon futur métier',
                    'Améliorer mes gestes techniques',
                    'Préparer des compétitions importantes'
                  ].map(need => (
                    <label key={need} className={`flex items-center space-x-4 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      (answers.spotbulleNeeds || []).includes(need)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={(answers.spotbulleNeeds || []).includes(need)}
                        onChange={(e) => handleArrayAnswer('spotbulleNeeds', need, e.target.checked)}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-gray-700 font-medium">{need}</span>
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
          <div className="text-center space-y-8">
            <div className={`p-8 rounded-2xl bg-gradient-to-br border-4 ${
              dominantColor === 'red' ? 'from-red-50 to-red-100 border-red-200' :
              dominantColor === 'blue' ? 'from-blue-50 to-blue-100 border-blue-200' :
              dominantColor === 'green' ? 'from-green-50 to-green-100 border-green-200' :
              'from-yellow-50 to-yellow-100 border-yellow-200'
            }`}>
              <div className="text-6xl mb-4">{profile.emoji}</div>
              <h3 className="text-3xl font-bold text-gray-900 mb-3">{profile.name}</h3>
              <p className="text-lg text-gray-700 mb-6">{profile.description}</p>
              
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-3">Tes caractéristiques principales :</h4>
                <div className="space-y-2">
                  {profile.characteristics.map((trait, index) => (
                    <div key={index} className="flex items-center justify-center space-x-2">
                      <span className="text-green-500">✓</span>
                      <span className="text-gray-700">{trait}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-center gap-3 mb-6">
                {profile.traits.map((trait, index) => (
                  <span key={index} className="px-4 py-2 bg-white/80 rounded-full text-sm font-semibold shadow-sm">
                    {trait}
                  </span>
                ))}
              </div>
              
              <div className="bg-white/80 rounded-lg p-4 border">
                <p className="text-sm text-gray-600">
                  <strong>🎯 Ton QR code de restitution</strong> est disponible dans ton tableau de bord personnel
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center justify-center space-x-3 mb-3">
                <span className="text-2xl">✨</span>
                <h4 className="text-lg font-semibold text-blue-800">Parcours personnalisé activé !</h4>
              </div>
              <p className="text-blue-700">
                Accède maintenant aux <strong>simulateurs et scénarios adaptés</strong> à ton profil unique.<br/>
                Ton aventure SpotBulle Immersion commence ici !
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const allColorQuestionsAnswered = answers.colorQuiz.every(answer => answer !== '');
  const canProceed = currentStep === 1 ? allColorQuestionsAnswered : true;

  if (!connectionChecked && user) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h3 className="text-xl font-semibold text-primary-900 mb-2">
          Vérification de la connexion
        </h3>
        <p className="text-gray-600 mb-4">
          Nous vérifions que le service questionnaire est disponible...
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-xl ${isModal ? '' : 'p-8 max-w-4xl mx-auto'}`}>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary-900 mb-3">
          {currentStep === 4 ? '🎉 Profil Identifié !' : '📝 Questionnaire SpotBulle Immersion'}
        </h2>
        <p className="text-gray-600 text-lg">
          {currentStep === 4 ? 'Découvre ta personnalité unique et commence ton aventure' : 'Complète ton profil pour un parcours 100% personnalisé'}
        </p>
        
        {currentStep < 4 && (
          <div className="flex justify-center space-x-3 mt-6">
            {[1, 2, 3].map(step => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step === currentStep 
                      ? 'bg-primary-600 text-white' 
                      : step < currentStep 
                        ? 'bg-primary-100 text-primary-600 border-2 border-primary-600' 
                        : 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                  }`}
                >
                  {step}
                </div>
                <span className={`text-xs mt-2 font-medium ${
                  step === currentStep ? 'text-primary-600' : 'text-gray-500'
                }`}>
                  {step === 1 ? 'Profil' : step === 2 ? 'Talents' : 'Rêves'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderStep()}

      {currentStep < 4 && (
        <div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-200">
          <Button
            onClick={prevStep}
            disabled={currentStep === 1}
            variant="outline"
            className="px-8 py-3 border-2"
          >
            ← Précédent
          </Button>

          <div className="flex items-center space-x-4">
            {showSkip && (
              <Button
                onClick={onComplete}
                variant="outline"
                className="px-6 py-3 border-2 text-gray-600"
              >
                Passer pour plus tard
              </Button>
            )}
            
            {currentStep < 3 ? (
              <Button
                onClick={nextStep}
                disabled={!canProceed}
                className="bg-primary-600 hover:bg-primary-700 px-8 py-3 text-white font-semibold"
              >
                Continuer →
              </Button>
            ) : (
              <Button
                onClick={submitQuestionnaire}
                loading={loading}
                disabled={!canProceed || loading}
                className="bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 px-8 py-3 text-white font-semibold shadow-lg"
              >
                {loading ? '🔄 Sauvegarde...' : '🎯 Découvrir mon profil'}
              </Button>
            )}
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="flex justify-center mt-8 pt-6 border-t border-gray-200">
          <Button
            onClick={handleCompleteQuestionnaire}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-10 py-4 text-white font-semibold text-lg shadow-xl"
          >
            🚀 Commencer l'aventure SpotBulle →
          </Button>
        </div>
      )}
    </div>
  );
};

export default Questionnaire;
