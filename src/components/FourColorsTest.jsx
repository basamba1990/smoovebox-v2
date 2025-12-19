import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button-enhanced.jsx';
import { toast } from 'sonner';
import { DISC_QUESTIONS, DISC_PROFILES, DISC_QUESTION_COUNT } from '../constants/discData';
import { calculateDominantColor } from '../utils/discUtils';
import ProfessionalHeader from './ProfessionalHeader.jsx';

const FourColorsTest = ({ user, profile, onComplete, onSignOut }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(Array(DISC_QUESTION_COUNT).fill(null));
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingAnswers, setExistingAnswers] = useState(null);

  useEffect(() => {
    // Si l'utilisateur a déjà répondu, on charge ses réponses
    if (profile?.dominant_color && !showResults) {
      loadExistingAnswers();
    }
  }, [profile]);

  const loadExistingAnswers = async () => {
    try {
      const { data, error } = await supabase
        .from('questionnaire_responses')
        .select('color_quiz')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setExistingAnswers(data.color_quiz);
        setAnswers(data.color_quiz);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Erreur chargement réponses existantes:', error);
    }
  };

  const handleAnswer = (answerIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
    
    if (currentQuestion < DISC_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateResults();
    }
  };

  const calculateResults = () => {
    const dominantType = calculateDominantColor(answers);
    setShowResults(true);
    saveResults(dominantType, answers);
  };

  const saveResults = async (dominantType, finalAnswers) => {
    setLoading(true);
    try {
      // Sauvegarder dans questionnaire_responses
      const { error } = await supabase
        .from('questionnaire_responses')
        .upsert({
          user_id: user.id,
          dominant_color: dominantType,
          color_quiz: finalAnswers,
          completed_at: new Date().toISOString()
        });

      if (error) throw error;

      // Mettre à jour le profil utilisateur
      await supabase
        .from('profiles')
        .update({
          dominant_color: dominantType,
          onboarding_completed: true
        })
        .eq('id', user.id);

      toast.success('Profil enregistré avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde résultats:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const progress = ((currentQuestion + 1) / DISC_QUESTION_COUNT) * 100;

  if (showResults) {
    const dominantColorKey = calculateDominantColor(answers);
    const profileData = DISC_PROFILES[dominantColorKey];
    
    // Calculer la répartition des réponses
    const answerDistribution = answers.reduce((acc, answerIndex, questionIndex) => {
      if (answerIndex !== null) {
        const question = DISC_QUESTIONS[questionIndex];
        const selectedOption = question.options[answerIndex];
        acc[selectedOption.type] = (acc[selectedOption.type] || 0) + 1;
      }
      return acc;
    }, {});

    const handleRegenerateDISC = async () => {
      if (!window.confirm("Êtes-vous sûr de vouloir relancer le questionnaire ? Votre ancien profil DISC sera supprimé.")) {
        return;
      }
      
      setLoading(true);
      try {
        // 1. Supprimer l'ancien DISC
        const { error: deleteError } = await supabase
          .from('questionnaire_responses')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        // 2. Réinitialiser le profil utilisateur (couleur dominante)
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            dominant_color: null,
          })
          .eq('id', user.id);

        if (profileError) throw profileError;

        toast.success('Ancien DISC supprimé. Redémarrage du questionnaire.');
        
        // 3. Réinitialiser l'état du composant pour relancer le questionnaire
        setAnswers(Array(DISC_QUESTION_COUNT).fill(null));
        setCurrentQuestion(0);
        setShowResults(false);
        setExistingAnswers(null);
      } catch (error) {
        console.error('Erreur régénération DISC:', error);
        toast.error('Erreur lors de la régénération du DISC.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{profileData.emoji}</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Ton profil : {profileData.name}
            </h1>
            <p className="text-xl text-gray-600">
              Découvre ta personnalité unique et comment elle influence ton approche du sport
            </p>
            <a 
              href="/update-disc" 
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 mt-2 inline-block"
            >
              Voir / Mettre à jour le DISC
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Carte profil */}
            <div 
              className="bg-white rounded-2xl shadow-lg p-6 border-2" 
              style={{ borderColor: profileData.color }}
            >
              <h3 className="text-2xl font-bold mb-4" style={{ color: profileData.color }}>
                {profileData.emoji} {profileData.name}
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Tes caractéristiques :</h4>
                  <ul className="space-y-2">
                    {profileData.characteristics.map((char, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <span className="text-green-500">✓</span>
                        <span className="text-gray-700">{char}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Forces principales :</h4>
                  <div className="flex flex-wrap gap-2">
                    {profileData.strengths.map((strength, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 rounded-full text-sm font-medium text-white"
                        style={{ backgroundColor: profileData.color }}
                      >
                        {strength}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Style sportif */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">🎯 Ton style sportif</h3>
              <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                {profileData.sportStyle}
              </p>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">💡 Conseil personnalisé :</h4>
                <p className="text-blue-700 text-sm">
                  {dominantColorKey === 'red' && "Concentre-toi sur le leadership d'équipe et la prise de décision rapide pendant les matchs."}
                  {dominantColorKey === 'blue' && "Développe ta technique et deviens la référence stratégique de ton équipe."}
                  {dominantColorKey === 'green' && "Utilise tes talents de communication pour renforcer la cohésion d'équipe."}
                  {dominantColorKey === 'yellow' && "Apporte ton énergie créative pour surprendre l'adversaire et motiver ton équipe."}
                </p>
              </div>
            </div>
          </div>

          {/* Répartition des réponses */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 Ta répartition de personnalité</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(DISC_PROFILES).map(([type, prof]) => (
                <div key={type} className="text-center">
                  <div className="text-3xl mb-2">{prof.emoji}</div>
                  <div className="text-sm font-semibold text-gray-700 mb-1">{prof.name}</div>
                  <div className="text-2xl font-bold" style={{ color: prof.color }}>
                    {answerDistribution[type] || 0}/{DISC_QUESTIONS.length}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="h-2 rounded-full" 
                      style={{ 
                        backgroundColor: prof.color, 
                        width: `${((answerDistribution[type] || 0) / DISC_QUESTIONS.length) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center space-y-4">
            <Button 
              onClick={onComplete} 
              loading={loading}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8 py-4 text-white font-semibold text-lg"
            >
              🚀 Commencer mon aventure SpotBulle
            </Button>
            <Button 
              onClick={handleRegenerateDISC} 
              loading={loading}
              variant="destructive" 
              className="w-full md:w-auto"
            >
              🔄 Regénérer le DISC
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎭 Test de Personnalité Sportive
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Découvre ton profil unique pour un parcours SpotBulle 100% personnalisé
          </p>

          {/* Barre de progression */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Question {currentQuestion + 1} sur {DISC_QUESTION_COUNT}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-primary-600 h-3 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Question courante */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              {DISC_QUESTIONS[currentQuestion].question}
            </h2>
            <p className="text-gray-500">
              Choisis la réponse qui te correspond le plus naturellement
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DISC_QUESTIONS[currentQuestion].options.map((option, index) => (
              <button
                key={option.id}
                onClick={() => handleAnswer(index)}
                className={`p-6 border-2 rounded-xl text-left transition-all duration-200 hover:shadow-md ${
                  answers[currentQuestion] === index 
                    ? 'border-primary-500 bg-primary-50 shadow-sm' 
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <span className="text-2xl flex-shrink-0">{option.emoji}</span>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">
                      {option.id}. {option.text}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button 
            onClick={() => currentQuestion > 0 ? setCurrentQuestion(prev => prev - 1) : null}
            disabled={currentQuestion === 0}
            variant="outline" 
            className="px-6"
          >
            {currentQuestion > 0 ? '← Question précédente' : 'Question suivante →'}
          </Button>
          
          <div className="text-sm text-gray-500">
            Question {currentQuestion + 1} sur {DISC_QUESTION_COUNT}
          </div>
          
          <Button 
            onClick={() => currentQuestion < DISC_QUESTIONS.length - 1 
              ? setCurrentQuestion(prev => prev + 1) 
              : calculateResults()
            }
            disabled={answers[currentQuestion] === null}
            variant="success" className="px-6"
          >
            {currentQuestion < DISC_QUESTIONS.length - 1 ? 'Question suivante →' : 'Voir mes résultats'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FourColorsTest;
