import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
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
  Settings,
  Download,
  Eye,
  AlertCircle
} from 'lucide-react';

// Import des nouveaux composants
import PitchAssistant from './PitchAssistant.jsx';
import CreativeWorkshops from './CreativeWorkshops.jsx';
import CollectiveMode from './CollectiveMode.jsx';
import { videoService } from '../services/videoService';
import VideoAnalysisResults from './VideoAnalysisResults';
import TranscriptionViewer from './TranscriptionViewer';
import { supabase } from '../lib/supabase';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadedVideoData, setUploadedVideoData] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previewVideoRef = useRef(null);

  // Fonction pour appeler l'Edge Function de rafraîchissement des stats
  const refreshStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        console.error("Impossible de récupérer le token d'authentification");
        return;
      }

      // Utilisation de la nouvelle fonction de rafraîchissement
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-user-video-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erreur lors du rafraîchissement des stats:', errorData);
      } else {
        console.log('Stats rafraîchies avec succès');
        
        // Mettre à jour les données affichées après le rafraîchissement
        updateDisplayedStats();
      }
    } catch (error) {
      console.error('Erreur réseau lors du rafraîchissement des stats:', error);
    }
  };

  // Fonction pour récupérer les statistiques depuis la vue sécurisée
  const updateDisplayedStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      // Utilisation de la vue sécurisée pour récupérer les statistiques
      const { data, error } = await supabase
        .from('user_video_stats_secure')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Erreur lors de la récupération des stats:', error);
        return;
      }
      
      // Ici vous pouvez mettre à jour votre state avec les nouvelles données
      // Par exemple, si vous avez un state pour les stats:
      // setUserStats(data);
      
      console.log('Statistiques mises à jour:', data);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des stats:', error);
    }
  };

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

  const checkCameraSupport = () => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };

  const startCamera = async () => {
    if (!checkCameraSupport()) {
      setCameraError('Votre navigateur ne supporte pas l\'accès à la caméra. Veuillez utiliser un navigateur moderne comme Chrome, Firefox ou Edge.');
      return;
    }

    setIsCameraLoading(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(null);
    } catch (error) {
      console.error('Erreur d\'accès à la caméra:', error);
      
      let errorMessage = 'Impossible d\'accéder à la caméra. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Veuillez autoriser l\'accès à la caméra et au microphone dans les paramètres de votre navigateur.';
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        errorMessage += 'Aucune caméra n\'a été détectée ou la caméra demandée n\'est pas disponible.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'La caméra est déjà utilisée par une autre application. Veuillez fermer les autres applications utilisant la caméra.';
      } else {
        errorMessage += `Erreur technique: ${error.message}`;
      }
      
      setCameraError(errorMessage);
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  };

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
        duration: recordingTime,
        name: `recorded_video_${Date.now()}.webm`
      });
      setCurrentStep('preview');
      stopCamera();
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
    setRecordingTime(0);

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

  useEffect(() => {
    return () => {
      stopCamera();
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
    };
  }, [recordedVideo]);

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
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
    }
    setRecordedVideo(null);
    setCurrentStep('recording');
    startCamera();
  };

  const handleAcceptVideo = async () => {
    if (!recordedVideo?.blob) {
      setUploadError('Aucune vidéo à uploader');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgress(0);
    setUploadedVideoData(null);
    setShowResults(false);

    try {
      const metadata = {
        title: recordedVideo.name?.replace('.webm', '') || `video_${Date.now()}`,
        description: 'Vidéo enregistrée depuis la caméra',
        duration: recordedVideo.duration || 0,
        isPublic: false,
      };

      if (!metadata.title) {
        throw new Error('Le titre de la vidéo est invalide');
      }

      const uploadedVideo = await videoService.uploadVideo(
        recordedVideo.blob, 
        metadata, 
        (progressEvent) => {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(percent);
        }
      );

      console.log('Vidéo uploadée avec succès:', uploadedVideo);
      setUploadSuccess('Vidéo uploadée avec succès !');
      setUploadedVideoData(uploadedVideo);

      try {
        await videoService.transcribeVideo(uploadedVideo.id);
        setUploadSuccess('Vidéo uploadée et transcription initiée avec succès !');
      } catch (transcriptionError) {
        console.warn('Erreur lors du démarrage de la transcription:', transcriptionError);
        setUploadSuccess('Vidéo uploadée avec succès, mais erreur lors du démarrage de la transcription');
      }
      
      // Rafraîchir les statistiques après l'upload réussi
      await refreshStats();
      
      setShowResults(true);
      setCurrentStep('results');

    } catch (error) {
      console.error('Erreur lors de l\'upload de la vidéo:', error);
      
      let errorMessage = `Erreur lors de l'upload: ${error.message}`;
      
      if (error.message.includes('Chemin de stockage invalide')) {
        errorMessage = 'Erreur: Impossible de générer un chemin de stockage valide pour la vidéo';
      } else if (error.message.includes('Le chemin de stockage est null')) {
        errorMessage = 'Erreur: Le système de stockage n\'a pas pu identifier où sauvegarder la vidéo';
      } else if (error.message.includes('Fichier vidéo est empty')) {
        errorMessage = 'Erreur: La vidéo enregistrée est vide ou corrompue';
      }
      
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const resetUploader = () => {
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
    }
    
    setCurrentStep('mode_selection');
    setSelectedMode(null);
    setRecordedVideo(null);
    setAssistantData(null);
    setCreativeChallenge(null);
    setCollectiveConfig(null);
    setRecordingTime(0);
    stopCamera();
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadedVideoData(null);
    setShowResults(false);
    setCameraError(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
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

      {uploadError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Erreur:</strong>
          <span className="block sm:inline"> {uploadError}</span>
        </div>
      )}
      {uploadSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Succès:</strong>
          <span className="block sm:inline"> {uploadSuccess}</span>
        </div>
      )}

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

      {currentStep === 'assistant' && (
        <PitchAssistant
          onComplete={handleAssistantComplete}
          onSkip={handleAssistantSkip}
          isVisible={true}
        />
      )}

      {currentStep === 'creative_workshop' && (
        <CreativeWorkshops
          onSelectChallenge={handleCreativeSelect}
          onSkip={handleCreativeSkip}
          isVisible={true}
        />
      )}

      {currentStep === 'collective_setup' && (
        <CollectiveMode
          onStartRecording={handleCollectiveStart}
          onCancel={handleCollectiveCancel}
          isVisible={true}
        />
      )}

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

              {cameraError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-red-800">Erreur d'accès à la caméra</h4>
                      <p className="text-red-700 text-sm mt-1">{cameraError}</p>
                      <div className="mt-3">
                        <Button 
                          onClick={startCamera} 
                          size="sm" 
                          disabled={isCameraLoading}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isCameraLoading ? "Tentative d'accès..." : "Réessayer"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

              <div className="flex justify-center gap-4">
                {!isRecording ? (
                  <Button 
                    onClick={startRecording} 
                    disabled={!mediaStream || isCameraLoading}
                  >
                    <Play className="h-5 w-5 mr-2" /> 
                    {isCameraLoading ? "Chargement..." : "Démarrer l'enregistrement"}
                  </Button>
                ) : (
                  <Button onClick={stopRecording} variant="destructive">
                    <Square className="h-5 w-5 mr-2" /> Arrêter l'enregistrement
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 'preview' && recordedVideo && (
        <div className="space-y-6">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Prévisualisation de votre enregistrement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={previewVideoRef}
                  src={recordedVideo.url}
                  controls
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Durée :</span>
                    <span className="ml-2 text-gray-600">{formatTime(recordedVideo.duration)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Format :</span>
                    <span className="ml-2 text-gray-600">WebM</span>
                  </div>
                </div>
              </div>

              {assistantData && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-blue-800 mb-2">Contexte de votre pitch :</h4>
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

              <div className="flex justify-center gap-4">
                <Button onClick={handleRetakeVideo} variant="outline">
                  <RotateCcw className="h-5 w-5 mr-2" /> Refaire l'enregistrement
                </Button>
                <Button onClick={handleAcceptVideo} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Upload className="h-5 w-5 mr-2 animate-spin" />
                      Upload en cours... ({uploadProgress}%)
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Accepter et uploader
                    </>
                  )}
                </Button>
              </div>

              {uploading && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 'results' && showResults && uploadedVideoData && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Résultats de la Vidéo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {uploadedVideoData.public_url && (
              <div className="mb-4">
                <video controls src={uploadedVideoData.public_url} className="w-full rounded-lg"></video>
              </div>
            )}
            
            <VideoAnalysisResults video={uploadedVideoData} />
          </CardContent>
        </Card>
      )}

      {(currentStep === 'results' || showResults) && (
        <div className="text-center mt-6">
          <Button onClick={resetUploader} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" /> Nouveau Pitch
          </Button>
        </div>
      )}
    </div>
  );
};

export default EnhancedVideoUploader;
