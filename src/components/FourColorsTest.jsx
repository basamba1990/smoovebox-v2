import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button-enhanced.jsx';
import { toast } from 'sonner';
import ProfessionalHeader from './ProfessionalHeader.jsx';

const FourColorsTest = ({ user, profile, onComplete, onSignOut }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(Array(8).fill(null));
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ CORRECTION : Questions sans aucune mention de couleurs
  const questions = [
    {
      id: 1,
      question: "Face à un problème difficile, tu as tendance à :",
      options: [
        { 
          id: 'A', 
          text: "Prendre une décision rapide et agir immédiatement", 
          type: 'red',
          emoji: '⚡'
        },
        { 
          id: 'B', 
          text: "Analyser soigneusement toutes les options avant de décider", 
          type: 'blue',
          emoji: '🧠'
        },
        { 
          id: 'C', 
          text: "Demander l'avis des autres et chercher un consensus", 
          type: 'green',
          emoji: '🤝'
        },
        { 
          id: 'D', 
          text: "Imaginer des solutions créatives et originales", 
          type: 'yellow',
          emoji: '💡'
        }
      ]
    },
    {
      id: 2,
      question: "Dans une équipe, ton rôle naturel est plutôt :",
      options: [
        { 
          id: 'A', 
          text: "Prendre le leadership et diriger le groupe", 
          type: 'red',
          emoji: '👑'
        },
        { 
          id: 'B', 
          text: "Organiser et planifier le travail de l'équipe", 
          type: 'blue',
          emoji: '📋'
        },
        { 
          id: 'C', 
          text: "Faciliter la communication et soutenir les autres", 
          type: 'green',
          emoji: '🌟'
        },
        { 
          id: 'D', 
          text: "Proposer des idées nouvelles et motiver l'équipe", 
          type: 'yellow',
          emoji: '🎯'
        }
      ]
    },
    {
      id: 3,
      question: "Quand tu dois atteindre un objectif important :",
      options: [
        { 
          id: 'A', 
          text: "Tu fonces directement vers le but sans hésiter", 
          type: 'red',
          emoji: '🎯'
        },
        { 
          id: 'B', 
          text: "Tu établis un plan détaillé étape par étape", 
          type: 'blue',
          emoji: '🗓️'
        },
        { 
          id: 'C', 
          text: "Tu t'assures que tout le monde est d'accord et motivé", 
          type: 'green',
          emoji: '👥'
        },
        { 
          id: 'D', 
          text: "Tu explores différentes approches originales", 
          type: 'yellow',
          emoji: '🔍'
        }
      ]
    },
    {
      id: 4,
      question: "Face à une critique sur ton travail :",
      options: [
        { 
          id: 'A', 
          text: "Tu réponds directement et defends ton point de vue", 
          type: 'red',
          emoji: '🛡️'
        },
        { 
          id: 'B', 
          text: "Tu analyses la critique pour en tirer des améliorations", 
          type: 'blue',
          emoji: '🔎'
        },
        { 
          id: 'C', 
          text: "Tu cherches à comprendre le point de vue de l'autre", 
          type: 'green',
          emoji: '💝'
        },
        { 
          id: 'D', 
          text: "Tu vois ça comme une opportunité de changement", 
          type: 'yellow',
          emoji: '🔄'
        }
      ]
    },
    {
      id: 5,
      question: "Quand tu apprends quelque chose de nouveau :",
      options: [
        { 
          id: 'A', 
          text: "Tu aimes passer directement à la pratique", 
          type: 'red',
          emoji: '🏃'
        },
        { 
          id: 'B', 
          text: "Tu préfères étudier la théorie en détail d'abord", 
          type: 'blue',
          emoji: '📚'
        },
        { 
          id: 'C', 
          text: "Tu apprends mieux en groupe avec les autres", 
          type: 'green',
          emoji: '👨‍🏫'
        },
        { 
          id: 'D', 
          text: "Tu imagines comment l'appliquer de façon créative", 
          type: 'yellow',
          emoji: '🎨'
        }
      ]
    },
    {
      id: 6,
      question: "Dans ton sport, ce qui te motive le plus c'est :",
      options: [
        { 
          id: 'A', 
          text: "La compétition et la victoire", 
          type: 'red',
          emoji: '🏆'
        },
        { 
          id: 'B', 
          text: "La maîtrise technique et la précision", 
          type: 'blue',
          emoji: '⚙️'
        },
        { 
          id: 'C', 
          text: "L'esprit d'équipe et les relations", 
          type: 'green',
          emoji: '❤️'
        },
        { 
          id: 'D', 
          text: "L'expression libre et le plaisir du jeu", 
          type: 'yellow',
          emoji: '😄'
        }
      ]
    },
    {
      id: 7,
      question: "Quand tu organises ton temps :",
      options: [
        { 
          id: 'A', 
          text: "Tu priorises les actions qui donnent des résultats rapides", 
          type: 'red',
          emoji: '⏱️'
        },
        { 
          id: 'B', 
          text: "Tu planifies méticuleusement chaque moment de ta journée", 
          type: 'blue',
          emoji: '📅'
        },
        { 
          id: 'C', 
          text: "Tu adaptes ton planning en fonction des besoins des autres", 
          type: 'green',
          emoji: '🔄'
        },
        { 
          id: 'D', 
          text: "Tu laisses de la place à l'imprévu et la spontanéité", 
          type: 'yellow',
          emoji: '🎭'
        }
      ]
    },
    {
      id: 8,
      question: "Face à un échec ou une défaite :",
      options: [
        { 
          id: 'A', 
          text: "Tu veux immédiatement reprendre et te rattraper", 
          type: 'red',
          emoji: '💪'
        },
        { 
          id: 'B', 
          text: "Tu analyses ce qui n'a pas fonctionné pour progresser", 
          type: 'blue',
          emoji: '📊'
        },
        { 
          id: 'C', 
          text: "Tu cherches du soutien auprès de ton entourage", 
          type: 'green',
          emoji: '🤗'
        },
        { 
          id: 'D', 
          text: "Tu relativises et cherches le côté positif", 
          type: 'yellow',
          emoji: '🌈'
        }
      ]
    }
  ];

  const profiles = {
    red: {
      name: "LEADER PASSIONNÉ",
      emoji: "🦁",
      color: "#EF4444",
      characteristics: [
        "Prend des décisions rapides",
        "Aime les défis et la compétition",
        "Direct et orienté résultats",
        "Naturellement confiant et déterminé"
      ],
      strengths: ["Leadership", "Courage", "Décision", "Ambition"],
      challenges: ["Peut être impatient", "Parfois trop direct", "N'aime pas les lenteurs"],
      sportStyle: "Compétiteur né, excelle sous pression, aime mener l'équipe"
    },
    blue: {
      name: "STRATÈGE RIGOUREUX", 
      emoji: "🧠",
      color: "#3B82F6",
      characteristics: [
        "Aime les détails et la précision",
        "Réfléchit avant d'agir",
        "Organisé et méthodique",
        "Fiable et consciencieux"
      ],
      strengths: ["Précision", "Organisation", "Analytique", "Fiabilité"],
      challenges: ["Peut être perfectionniste", "Parfois trop prudent", "N'aime pas l'imprévu"],
      sportStyle: "Technicien précis, excellent en stratégie, maîtrise parfaite des gestes"
    },
    green: {
      name: "ÉQUIPIER EMPATHIQUE",
      emoji: "🤝",
      color: "#10B981",
      characteristics: [
        "Excellent communicateur",
        "Soutient les autres naturellement",
        "Crée l'harmonie dans le groupe",
        "À l'écoute des besoins de chacun"
      ],
      strengths: ["Empathie", "Coopération", "Communication", "Loyauté"],
      challenges: ["Peut éviter les conflits", "Parfois trop conciliant", "Difficile de dire non"],
      sportStyle: "Cœur d'équipe, excellent coéquipier, renforce la cohésion"
    },
    yellow: {
      name: "CRÉATIF ENTHOUSIASTE",
      emoji: "💡",
      color: "#F59E0B",
      characteristics: [
        "Plein d'idées nouvelles",
        "Enthousiaste et énergique",
        "Aime l'innovation et le changement",
        "Excellent pour motiver les autres"
      ],
      strengths: ["Créativité", "Innovation", "Enthousiasme", "Adaptabilité"],
      challenges: ["Peut manquer de suivi", "Parfois trop dispersé", "N'aime pas la routine"],
      sportStyle: "Joueur imprévisible, plein de ressources, apporte la bonne humeur"
    }
  };

  const handleAnswer = (answerIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateResults();
    }
  };

  const calculateResults = () => {
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    
    answers.forEach((answerIndex, questionIndex) => {
      if (answerIndex !== null) {
        const question = questions[questionIndex];
        const selectedOption = question.options[answerIndex];
        counts[selectedOption.type]++;
      }
    });

    let dominantType = 'red';
    let maxCount = 0;

    Object.entries(counts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    });

    setShowResults(true);
    saveResults(dominantType);
  };

  const saveResults = async (dominantType) => {
    setLoading(true);
    try {
      // Sauvegarder dans questionnaire_responses
      const { error } = await supabase
        .from('questionnaire_responses')
        .upsert({
          user_id: user.id,
          dominant_color: dominantType,
          color_quiz: answers,
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

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (showResults) {
    const dominantType = answers.reduce((acc, answerIndex, questionIndex) => {
      if (answerIndex !== null) {
        const question = questions[questionIndex];
        const selectedOption = question.options[answerIndex];
        acc[selectedOption.type] = (acc[selectedOption.type] || 0) + 1;
      }
      return acc;
    }, {});

    const maxType = Object.entries(dominantType).reduce((max, [type, count]) => 
      count > (max.count || 0) ? { type, count } : max, {}
    );

    const profile = profiles[maxType.type];

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
        
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{profile.emoji}</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Ton profil : {profile.name}
            </h1>
            <p className="text-xl text-gray-600">
              Découvre ta personnalité unique et comment elle influence ton approche du sport
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Carte profil */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2" style={{ borderColor: profile.color }}>
              <h3 className="text-2xl font-bold mb-4" style={{ color: profile.color }}>
                {profile.emoji} {profile.name}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Tes caractéristiques :</h4>
                  <ul className="space-y-2">
                    {profile.characteristics.map((char, index) => (
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
                    {profile.strengths.map((strength, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 rounded-full text-sm font-medium text-white"
                        style={{ backgroundColor: profile.color }}
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
                {profile.sportStyle}
              </p>
              
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">💡 Conseil personnalisé :</h4>
                <p className="text-blue-700 text-sm">
                  {maxType.type === 'red' && "Concentre-toi sur le leadership d'équipe et la prise de décision rapide pendant les matchs."}
                  {maxType.type === 'blue' && "Développe ta technique et deviens la référence stratégique de ton équipe."}
                  {maxType.type === 'green' && "Utilise tes talents de communication pour renforcer la cohésion d'équipe."}
                  {maxType.type === 'yellow' && "Apporte ton énergie créative pour surprendre l'adversaire et motiver ton équipe."}
                </p>
              </div>
            </div>
          </div>

          {/* Répartition des réponses */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 Ta répartition de personnalité</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(profiles).map(([type, prof]) => (
                <div key={type} className="text-center">
                  <div className="text-3xl mb-2">{prof.emoji}</div>
                  <div className="text-sm font-semibold text-gray-700 mb-1">{prof.name}</div>
                  <div className="text-2xl font-bold" style={{ color: prof.color }}>
                    {dominantType[type] || 0}/{questions.length}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="h-2 rounded-full"
                      style={{ 
                        backgroundColor: prof.color,
                        width: `${((dominantType[type] || 0) / questions.length) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Button
              onClick={onComplete}
              loading={loading}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8 py-4 text-white font-semibold text-lg"
            >
              🚀 Commencer mon aventure SpotBulle
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
              <span>Question {currentQuestion + 1} sur {questions.length}</span>
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
              {questions[currentQuestion].question}
            </h2>
            <p className="text-gray-500">
              Choisis la réponse qui te correspond le plus naturellement
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions[currentQuestion].options.map((option, index) => (
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
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            variant="outline"
            className="px-6"
          >
            ← Précédent
          </Button>
          
          <div className="text-sm text-gray-500">
            Question {currentQuestion + 1} sur {questions.length}
          </div>

          <Button
            onClick={() => currentQuestion < questions.length - 1 ? setCurrentQuestion(prev => prev + 1) : calculateResults()}
            disabled={answers[currentQuestion] === null}
            className="bg-primary-600 hover:bg-primary-700 px-6"
          >
            {currentQuestion < questions.length - 1 ? 'Suivant →' : 'Voir mes résultats'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FourColorsTest;
