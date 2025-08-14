import React, { useState, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Palette, Sparkles, Camera, Shuffle, Play, RefreshCw, Star } from 'lucide-react';

const CreativeWorkshops = ({ onSelectChallenge, onSkip, isVisible = true }) => {
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [currentFilter, setCurrentFilter] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const challenges = [
    {
      id: 'symbol_object',
      title: 'Objet Symbole',
      description: 'Choisis un objet qui représente ton parcours sportif et raconte son histoire',
      icon: Star,
      difficulty: 'Facile',
      duration: '2-3 min',
      examples: [
        'Tes premières chaussures de sport',
        'Un trophée ou une médaille',
        'Un ballon ou équipement favori',
        'Une photo d\'équipe marquante'
      ],
      tips: [
        'Explique pourquoi cet objet est important',
        'Raconte l\'histoire derrière cet objet',
        'Connecte-le à tes émotions sportives'
      ],
      color: 'from-amber-100 to-orange-100',
      borderColor: 'border-amber-200'
    },
    {
      id: 'sport_mime',
      title: 'Action Sportive',
      description: 'Mime une action sportive emblématique et explique sa signification',
      icon: Play,
      difficulty: 'Moyen',
      duration: '1-2 min',
      examples: [
        'Un geste technique de ton sport',
        'La célébration d\'une victoire',
        'Un mouvement d\'échauffement',
        'Une action défensive ou offensive'
      ],
      tips: [
        'Sois expressif dans tes gestes',
        'Explique la technique après l\'avoir mimée',
        'Raconte quand tu utilises cette action'
      ],
      color: 'from-green-100 to-emerald-100',
      borderColor: 'border-green-200'
    },
    {
      id: 'story_twist',
      title: 'Histoire Inversée',
      description: 'Raconte ton parcours sportif en commençant par la fin',
      icon: RefreshCw,
      difficulty: 'Avancé',
      duration: '3-4 min',
      examples: [
        'Commence par ton objectif futur',
        'Remonte jusqu\'à tes débuts',
        'Révèle les étapes importantes',
        'Termine par ta motivation initiale'
      ],
      tips: [
        'Crée du suspense avec cette structure',
        'Utilise des transitions fluides',
        'Garde le spectateur en haleine'
      ],
      color: 'from-purple-100 to-violet-100',
      borderColor: 'border-purple-200'
    },
    {
      id: 'team_spirit',
      title: 'Esprit d\'Équipe',
      description: 'Présente ton équipe ou club de manière créative',
      icon: Sparkles,
      difficulty: 'Moyen',
      duration: '2-3 min',
      examples: [
        'Imite les caractéristiques de tes coéquipiers',
        'Raconte une anecdote d\'équipe drôle',
        'Explique votre cri de guerre ou rituel',
        'Présente votre philosophie de jeu'
      ],
      tips: [
        'Montre la complicité de l\'équipe',
        'Utilise l\'humour avec bienveillance',
        'Valorise chaque membre du groupe'
      ],
      color: 'from-blue-100 to-cyan-100',
      borderColor: 'border-blue-200'
    }
  ];

  const videoFilters = [
    { id: 'sport_energy', name: 'Énergie Sportive', emoji: '⚡', description: 'Effet dynamique et énergique' },
    { id: 'team_spirit', name: 'Esprit Équipe', emoji: '🤝', description: 'Couleurs de ton équipe' },
    { id: 'champion', name: 'Champion', emoji: '🏆', description: 'Effet doré et brillant' },
    { id: 'passion', name: 'Passion', emoji: '❤️', description: 'Effet chaleureux et passionné' },
    { id: 'focus', name: 'Concentration', emoji: '🎯', description: 'Effet de focus et précision' },
    { id: 'celebration', name: 'Célébration', emoji: '🎉', description: 'Effet festif et coloré' }
  ];

  const handleChallengeSelect = (challenge) => {
    setSelectedChallenge(challenge);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const handleFilterSelect = (filter) => {
    setCurrentFilter(filter);
  };

  const handleStart = () => {
    onSelectChallenge({
      challenge: selectedChallenge,
      filter: currentFilter
    });
  };

  const getRandomChallenge = () => {
    const randomIndex = Math.floor(Math.random() * challenges.length);
    handleChallengeSelect(challenges[randomIndex]);
  };

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* En-tête */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
              <Palette className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-purple-800">Ateliers Créatifs</CardTitle>
              <p className="text-purple-600 mt-1">
                Choisis un défi créatif pour rendre ton pitch unique et mémorable
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sélection du défi */}
      {!selectedChallenge ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Choisis ton défi créatif</h3>
            <Button
              variant="outline"
              onClick={getRandomChallenge}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Défi aléatoire
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((challenge) => (
              <Card
                key={challenge.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg bg-gradient-to-br ${challenge.color} ${challenge.borderColor} hover:scale-105`}
                onClick={() => handleChallengeSelect(challenge)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <challenge.icon className="h-6 w-6 text-gray-700" />
                      <div>
                        <CardTitle className="text-lg text-gray-800">
                          {challenge.title}
                        </CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {challenge.difficulty}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {challenge.duration}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 text-sm mb-3">
                    {challenge.description}
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-800 text-xs">Exemples d'idées :</h4>
                    <ul className="space-y-1">
                      {challenge.examples.slice(0, 2).map((example, index) => (
                        <li key={index} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="text-gray-400 mt-1">•</span>
                          <span>{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Button
              variant="outline"
              onClick={onSkip}
              className="text-gray-600 hover:text-gray-800"
            >
              Passer les ateliers créatifs
            </Button>
          </div>
        </div>
      ) : (
        /* Défi sélectionné */
        <div className="space-y-6">
          <Card className={`bg-gradient-to-br ${selectedChallenge.color} ${selectedChallenge.borderColor} ${isAnimating ? 'animate-pulse' : ''}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <selectedChallenge.icon className="h-8 w-8 text-gray-700" />
                  <div>
                    <CardTitle className="text-xl text-gray-800">
                      {selectedChallenge.title}
                    </CardTitle>
                    <p className="text-gray-700 mt-1">
                      {selectedChallenge.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChallenge(null)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  Changer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Conseils pour réussir :</h4>
                <ul className="space-y-1">
                  {selectedChallenge.tips.map((tip, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Idées d'inspiration :</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedChallenge.examples.map((example, index) => (
                    <div key={index} className="bg-white/50 rounded-lg p-2">
                      <p className="text-sm text-gray-700">{example}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sélection du filtre vidéo */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Camera className="h-6 w-6 text-blue-600" />
                <CardTitle className="text-lg text-gray-800">
                  Choisis ton style vidéo (optionnel)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {videoFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      currentFilter?.id === filter.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handleFilterSelect(filter)}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{filter.emoji}</div>
                      <h4 className="font-medium text-sm text-gray-800">{filter.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{filter.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Boutons d'action */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={onSkip}
              className="text-gray-600 hover:text-gray-800"
            >
              Passer les ateliers
            </Button>
            
            <Button
              onClick={handleStart}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Commencer l'enregistrement
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreativeWorkshops;

