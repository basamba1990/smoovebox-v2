import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { 
  Video, 
  Upload, 
  Users, 
  Sparkles, 
  MessageCircle, 
  Play, 
  Square, 
  RotateCcw,
  CheckCircle,
  Camera,
  Mic,
  Settings
} from 'lucide-react';

// Import des nouveaux composants
import PitchAssistant from './PitchAssistant.jsx';
import CreativeWorkshops from './CreativeWorkshops.jsx';
import CollectiveMode from './CollectiveMode.jsx';
import AIFeedbackAnalysis from './AIFeedbackAnalysis.jsx';

const EnhancedVideoUploader = () => {
  const [currentStep, setCurrentStep] = useState('mode_selection');
  const [selectedMode, setSelectedMode] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [assistantData, setAssistantData] = useState(null);
  const [creativeChallenge, setCreativeChallenge] = useState(null);
  const [collectiveConfig, setCollectiveConfig] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const modes = [
    {
      id: 'individual',
      title: 'Pitch Individuel',
      description: 'Enregistre ton pitch personnel avec l\'aide de notre assistant IA',
      icon: MessageCircle,
      color: 'from-blue-100 to-blue-200',
      borderColor: 'border-blue-300',
      features: ['Assistant de pitch', 'Ateliers créatifs', 'Analyse IA personnalisée']
    },
    {
      id: 'collective',
      title: 'Pitch Collectif',
      description: 'Enregistrez votre pitch d\'équipe et montrez votre esprit collectif',
      icon: Users,
      color: 'from-green-100 to-green-200',
      borderColor: 'border-green-300',
      features: ['Mode multi-participants', 'Jeux de rôles', 'Analyse collective']
    },
    {
      id: 'creative',
      title: 'Défi Créatif',
      description: 'Relève un défi créatif pour rendre ton pitch unique',
      icon: Sparkles,
      color: 'from-purple-100 to-purple-200',
      borderColor: 'border-purple-300',
      features: ['Défis originaux', 'Filtres vidéo', 'Approches innovantes']
    }
  ];

  // Gestion de la caméra
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Erreur d\'accès à la caméra:', error);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  };

  // Gestion de l'enregistrement
  const startRecording = () => {
    if (!mediaStream) return;

    const recorder = new MediaRecorder(mediaStream);
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      setRecordedVideo({
        blob,
        url: videoUrl,
        duration: recordingTime
      });
      setCurrentStep('analysis');
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
    setRecordingTime(0);

    // Timer d'enregistrement
    const timer = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    setRecordingTimer(timer);
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
    }
  };

  // Nettoyage
  useEffect(() => {
    return () => {
      stopCamera();
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, []);

  // Gestionnaires d'événements
  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    if (mode.id === 'individual') {
      setCurrentStep('assistant');
    } else if (mode.id === 'collective') {
      setCurrentStep('collective_setup');
    } else if (mode.id === 'creative') {
      setCurrentStep('creative_workshop');
    }
  };

  const handleAssistantComplete = (data) => {
    setAssistantData(data);
    setCurrentStep('creative_workshop');
  };

  const handleAssistantSkip = () => {
    setCurrentStep('creative_workshop');
  };

  const handleCreativeSelect = (data) => {
    setCreativeChallenge(data);
    setCurrentStep('recording');
    startCamera();
  };

  const handleCreativeSkip = () => {
    setCurrentStep('recording');
    startCamera();
  };

  const handleCollectiveStart = (config) => {
    setCollectiveConfig(config);
    setCurrentStep('recording');
    startCamera();
  };

  const handleCollectiveCancel = () => {
    setCurrentStep('mode_selection');
  };

  const handleRetakeVideo = () => {
    setRecordedVideo(null);
    setCurrentStep('recording');
    startCamera();
  };

  const handleAcceptVideo = () => {
    // Ici, on pourrait uploader la vidéo vers Supabase
    console.log('Vidéo acceptée:', recordedVideo);
    // Reset pour un nouveau pitch
    resetUploader();
  };

  const resetUploader = () => {
    setCurrentStep('mode_selection');
    setSelectedMode(null);
    setRecordedVideo(null);
    setAssistantData(null);
    setCreativeChallenge(null);
    setCollectiveConfig(null);
    setRecordingTime(0);
    stopCamera();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <Video className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-blue-800">Nouvel Enregistrement</CardTitle>
              <p className="text-blue-600 mt-1">
                Crée ton pitch vidéo avec l'aide de notre IA
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Étapes du processus */}
      {currentStep === 'mode_selection' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">
            Choisis ton type de pitch
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modes.map((mode) => (
              <Card
                key={mode.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg bg-gradient-to-br ${mode.color} ${mode.borderColor} border-2 hover:scale-105`}
                onClick={() => handleModeSelect(mode)}
              >
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                    <mode.icon className="h-8 w-8 text-gray-700" />
                  </div>
                  <CardTitle className="text-lg text-gray-800">
                    {mode.title}
                  </CardTitle>
                  <p className="text-gray-700 text-sm">
                    {mode.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-800 text-sm">Fonctionnalités :</h4>
                    <ul className="space-y-1">
                      {mode.features.map((feature, index) => (
                        <li key={index} className="text-xs text-gray-700 flex items-start gap-1">
                          <span className="text-green-500 mt-1">•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Assistant de pitch */}
      {currentStep === 'assistant' && (
        <PitchAssistant
          onComplete={handleAssistantComplete}
          onSkip={handleAssistantSkip}
          isVisible={true}
        />
      )}

      {/* Ateliers créatifs */}
      {currentStep === 'creative_workshop' && (
        <CreativeWorkshops
          onSelectChallenge={handleCreativeSelect}
          onSkip={handleCreativeSkip}
          isVisible={true}
        />
      )}

      {/* Configuration collective */}
      {currentStep === 'collective_setup' && (
        <CollectiveMode
          onStartRecording={handleCollectiveStart}
          onCancel={handleCollectiveCancel}
          isVisible={true}
        />
      )}

      {/* Interface d'enregistrement */}
      {currentStep === 'recording' && (
        <div className="space-y-6">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Enregistrement
                </CardTitle>
                <div className="flex items-center gap-4">
                  {isRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-red-600 font-mono">
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                  )}
                  <Badge variant={mediaStream ? "default" : "secondary"}>
                    {mediaStream ? "Caméra active" : "Caméra inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Aperçu vidéo */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!mediaStream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Caméra non activée</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Informations contextuelles */}
              {assistantData && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-blue-800 mb-2">Rappel de tes réponses :</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {Object.entries(assistantData).map(([key, value]) => (
                        <div key={key} className="text-blue-700">
                          <span className="font-medium capitalize">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {creativeChallenge && (
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-purple-800 mb-2">
                      Défi créatif : {creativeChallenge.challenge?.title}
                    </h4>
                    <p className="text-sm text-purple-700">
                      {creativeChallenge.challenge?.description}
                    </p>
                    {creativeChallenge.filter && (
                      <Badge variant="outline" className="mt-2">
                        Filtre : {creativeChallenge.filter.name}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}

              {collectiveConfig && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-green-800 mb-2">
                      Mode collectif : {collectiveConfig.participants?.length} participants
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {collectiveConfig.participants?.map((participant, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {participant.name} {participant.role === 'leader' && '👑'}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contrôles d'enregistrement */}
              <div className="flex justify-center gap-4">
                {!mediaStream ? (
                  <Button
                    onClick={startCamera}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Activer la caméra
                  </Button>
                ) : !isRecording ? (
                  <Button
                    onClick={startRecording}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Commencer l'enregistrement
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Arrêter l'enregistrement
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={resetUploader}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Recommencer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analyse IA */}
      {currentStep === 'analysis' && recordedVideo && (
        <AIFeedbackAnalysis
          videoData={recordedVideo}
          transcription="Simulation de transcription automatique du pitch vidéo..."
          onRetakeVideo={handleRetakeVideo}
          onAcceptVideo={handleAcceptVideo}
          isVisible={true}
        />
      )}
    </div>
  );
};

export default EnhancedVideoUploader;

