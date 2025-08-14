import React, { useState, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Input } from './ui/input.jsx';
import { Users, UserPlus, Crown, Clock, Play, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react';

const CollectiveMode = ({ onStartRecording, onCancel, isVisible = true }) => {
  const [participants, setParticipants] = useState([
    { id: 1, name: '', role: 'leader', isReady: false, speakingTime: 30 }
  ]);
  const [currentSpeaker, setCurrentSpeaker] = useState(0);
  const [totalTime, setTotalTime] = useState(120); // 2 minutes par défaut
  const [isConfigured, setIsConfigured] = useState(false);
  const [gameMode, setGameMode] = useState('round_robin'); // round_robin, free_flow, structured

  const gameModes = [
    {
      id: 'round_robin',
      name: 'Tour de Parole',
      description: 'Chaque membre parle à tour de rôle pendant un temps défini',
      icon: RotateCcw,
      minParticipants: 2,
      maxParticipants: 6,
      recommended: true
    },
    {
      id: 'free_flow',
      name: 'Expression Libre',
      description: 'Les membres prennent la parole naturellement selon le sujet',
      icon: Users,
      minParticipants: 2,
      maxParticipants: 8,
      recommended: false
    },
    {
      id: 'structured',
      name: 'Présentation Structurée',
      description: 'Un leader présente, les autres complètent et réagissent',
      icon: Crown,
      minParticipants: 3,
      maxParticipants: 5,
      recommended: false
    }
  ];

  const addParticipant = () => {
    if (participants.length < 8) {
      const newId = Math.max(...participants.map(p => p.id)) + 1;
      setParticipants(prev => [
        ...prev,
        {
          id: newId,
          name: '',
          role: 'member',
          isReady: false,
          speakingTime: Math.floor(totalTime / (participants.length + 1))
        }
      ]);
      redistributeTime();
    }
  };

  const removeParticipant = (id) => {
    if (participants.length > 1) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      redistributeTime();
    }
  };

  const updateParticipant = (id, field, value) => {
    setParticipants(prev =>
      prev.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const redistributeTime = () => {
    const participantCount = participants.length;
    const timePerPerson = Math.floor(totalTime / participantCount);
    
    setParticipants(prev =>
      prev.map(p => ({ ...p, speakingTime: timePerPerson }))
    );
  };

  const toggleReady = (id) => {
    updateParticipant(id, 'isReady', !participants.find(p => p.id === id).isReady);
  };

  const setAsLeader = (id) => {
    setParticipants(prev =>
      prev.map(p => ({
        ...p,
        role: p.id === id ? 'leader' : 'member'
      }))
    );
  };

  const canStart = () => {
    return participants.every(p => p.name.trim() && p.isReady) && 
           participants.length >= gameModes.find(m => m.id === gameMode).minParticipants;
  };

  const handleStart = () => {
    const config = {
      mode: gameMode,
      participants: participants,
      totalTime: totalTime,
      currentSpeaker: 0
    };
    onStartRecording(config);
  };

  useEffect(() => {
    redistributeTime();
  }, [totalTime, participants.length]);

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* En-tête */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-blue-800">Mode Collectif</CardTitle>
              <p className="text-blue-600 mt-1">
                Enregistrez votre pitch d'équipe et montrez votre esprit collectif
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isConfigured ? (
        <div className="space-y-6">
          {/* Sélection du mode de jeu */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-gray-800">Choisissez votre format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {gameModes.map((mode) => (
                  <div
                    key={mode.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      gameMode === mode.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setGameMode(mode.id)}
                  >
                    <div className="flex items-start gap-3">
                      <mode.icon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-800">{mode.name}</h3>
                          {mode.recommended && (
                            <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{mode.description}</p>
                        <p className="text-xs text-gray-500">
                          {mode.minParticipants}-{mode.maxParticipants} participants
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Configuration du temps */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Durée totale de l'enregistrement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTotalTime(Math.max(60, totalTime - 30))}
                  disabled={totalTime <= 60}
                >
                  -30s
                </Button>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
                  </div>
                  <p className="text-sm text-gray-600">minutes</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTotalTime(Math.min(300, totalTime + 30))}
                  disabled={totalTime >= 300}
                >
                  +30s
                </Button>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                Temps par personne : ~{Math.floor(totalTime / participants.length)}s
              </p>
            </CardContent>
          </Card>

          {/* Configuration des participants */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-800">
                  Participants ({participants.length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addParticipant}
                  disabled={participants.length >= 8}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {participants.map((participant, index) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <Input
                      placeholder={`Nom du participant ${index + 1}`}
                      value={participant.name}
                      onChange={(e) => updateParticipant(participant.id, 'name', e.target.value)}
                      className="mb-2"
                    />
                    <div className="flex items-center gap-2">
                      {participant.role === 'leader' && (
                        <Badge variant="default" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Leader
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {participant.speakingTime}s de parole
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {participant.role !== 'leader' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAsLeader(participant.id)}
                        className="text-xs"
                      >
                        Définir leader
                      </Button>
                    )}
                    
                    <Button
                      variant={participant.isReady ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleReady(participant.id)}
                      className="flex items-center gap-1"
                    >
                      {participant.isReady ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      {participant.isReady ? 'Prêt' : 'Pas prêt'}
                    </Button>
                    
                    {participants.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParticipant(participant.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Instructions selon le mode */}
          <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-800">
                Instructions pour "{gameModes.find(m => m.id === gameMode)?.name}"
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gameMode === 'round_robin' && (
                <ul className="space-y-2 text-sm text-yellow-700">
                  <li>• Chaque participant parle pendant son temps alloué</li>
                  <li>• L'ordre de passage sera affiché pendant l'enregistrement</li>
                  <li>• Respectez les transitions entre les intervenants</li>
                  <li>• Le leader peut introduire et conclure</li>
                </ul>
              )}
              {gameMode === 'free_flow' && (
                <ul className="space-y-2 text-sm text-yellow-700">
                  <li>• Prenez la parole naturellement selon le sujet</li>
                  <li>• Écoutez-vous mutuellement pour éviter les chevauchements</li>
                  <li>• Assurez-vous que chacun puisse s'exprimer</li>
                  <li>• Gardez un œil sur le temps total</li>
                </ul>
              )}
              {gameMode === 'structured' && (
                <ul className="space-y-2 text-sm text-yellow-700">
                  <li>• Le leader présente le sujet principal</li>
                  <li>• Les membres complètent avec leurs expériences</li>
                  <li>• Réagissez aux propos des autres de manière constructive</li>
                  <li>• Le leader conclut avec une synthèse</li>
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Boutons d'action */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={onCancel}
              className="text-gray-600 hover:text-gray-800"
            >
              Annuler
            </Button>
            
            <Button
              onClick={() => setIsConfigured(true)}
              disabled={!canStart()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
            >
              Configurer l'enregistrement
            </Button>
          </div>
        </div>
      ) : (
        /* Configuration terminée - Prêt à enregistrer */
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-xl text-green-800 flex items-center gap-2">
              <CheckCircle className="h-6 w-6" />
              Configuration terminée !
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{participants.length}</div>
                <p className="text-sm text-green-700">Participants</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-sm text-green-700">Durée totale</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {gameModes.find(m => m.id === gameMode)?.name}
                </div>
                <p className="text-sm text-green-700">Format choisi</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-4">
              <Button
                variant="outline"
                onClick={() => setIsConfigured(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                Modifier la configuration
              </Button>
              
              <Button
                onClick={handleStart}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Commencer l'enregistrement
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CollectiveMode;

