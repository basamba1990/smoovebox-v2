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

import PitchAssistant from './PitchAssistant.jsx';
import CreativeWorkshops from './CreativeWorkshops.jsx';
import CollectiveMode from './CollectiveMode.jsx';
import VideoAnalysisResults from './VideoAnalysisResults';
import { videoService } from '../services/videoService';
import { supabase } from '../lib/supabase';

const EnhancedVideoUploader = () => {
  // --- STATES ---
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
  const previewVideoRef = useRef(null);

  // --- MODES ---
  const modes = [
    {
      id: 'individual',
      title: 'Pitch Individuel',
      description: "Enregistre ton pitch personnel avec l'aide de notre assistant IA",
      icon: MessageCircle,
      color: 'from-blue-100 to-blue-200',
      borderColor: 'border-blue-300',
      features: ['Assistant de pitch', 'Ateliers créatifs', 'Analyse IA personnalisée']
    },
    {
      id: 'collective',
      title: 'Pitch Collectif',
      description: "Enregistrez votre pitch d'équipe et montrez votre esprit collectif",
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

  // --- CAMERA / RECORDING ---
  const checkCameraSupport = () => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };

  const startCamera = async () => {
    if (!checkCameraSupport()) {
      setCameraError('Votre navigateur ne supporte pas l\'accès à la caméra. Utilisez Chrome, Firefox, Edge ou Safari.');
      return;
    }
    setIsCameraLoading(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      });
      setMediaStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      console.error('Erreur caméra:', error);
      let msg = 'Impossible d\'accéder à la caméra. ';
      if (error.name === 'NotAllowedError') msg += 'Autorisez la caméra/micro dans le navigateur.';
      else if (error.name === 'NotFoundError') msg += 'Aucune caméra détectée.';
      else if (error.name === 'NotReadableError') msg += 'Caméra utilisée par une autre app.';
      else msg += `Erreur technique: ${error.message}`;
      setCameraError(msg);
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

    let mimeType = 'video/webm';
    // Safari iOS fallback
    if (MediaRecorder.isTypeSupported('video/mp4')) mimeType = 'video/mp4';
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) mimeType = 'video/webm;codecs=vp8';

    const recorder = new MediaRecorder(mediaStream, { mimeType });
    const chunks = [];

    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedVideo({ blob, url, duration: recordingTime, name: `video_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}` });
      setCurrentStep('preview');
      stopCamera();
    };

    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
    setRecordingTime(0);

    const timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    setRecordingTimer(timer);
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimer) { clearInterval(recordingTimer); setRecordingTimer(null); }
    }
  };

  // --- EFFECTS CLEANUP ---
  useEffect(() => () => {
    stopCamera();
    if (recordingTimer) clearInterval(recordingTimer);
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
  }, []);

  // --- HANDLE STEPS ---
  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    if (mode.id === 'individual') setCurrentStep('assistant');
    else if (mode.id === 'collective') setCurrentStep('collective_setup');
    else if (mode.id === 'creative') setCurrentStep('creative_workshop');
  };
  const handleAssistantComplete = (data) => { setAssistantData(data); setCurrentStep('creative_workshop'); };
  const handleAssistantSkip = () => setCurrentStep('creative_workshop');
  const handleCreativeSelect = (data) => { setCreativeChallenge(data); setCurrentStep('recording'); startCamera(); };
  const handleCreativeSkip = () => { setCurrentStep('recording'); startCamera(); };
  const handleCollectiveStart = (config) => { setCollectiveConfig(config); setCurrentStep('recording'); startCamera(); };
  const handleCollectiveCancel = () => setCurrentStep('mode_selection');
  const handleRetakeVideo = () => {
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    setRecordedVideo(null);
    setCurrentStep('recording');
    startCamera();
  };

  // --- UPLOAD ---
  const handleAcceptVideo = async () => {
    if (!recordedVideo?.blob) { setUploadError('Aucune vidéo à uploader'); return; }
    setUploading(true); setUploadError(null); setUploadSuccess(null); setUploadProgress(0); setUploadedVideoData(null); setShowResults(false);

    try {
      const metadata = { title: recordedVideo.name.replace(/\.(webm|mp4)/, ''), description: 'Vidéo caméra', duration: recordedVideo.duration, isPublic: false };
      const uploaded = await videoService.uploadVideo(recordedVideo.blob, metadata, e => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      setUploadSuccess('Vidéo uploadée avec succès !');
      setUploadedVideoData(uploaded);

      try { await videoService.transcribeVideo(uploaded.id); setUploadSuccess('Vidéo uploadée et transcription initiée avec succès !'); }
      catch(err) { console.warn(err); setUploadSuccess('Vidéo uploadée, mais transcription échouée'); }

      await refreshStats();
      setShowResults(true); setCurrentStep('results');
    } catch (error) {
      console.error(error);
      setUploadError(`Erreur lors de l'upload: ${error.message}`);
    } finally { setUploading(false); }
  };

  // --- RESET ---
  const resetUploader = () => {
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    setCurrentStep('mode_selection'); setSelectedMode(null); setRecordedVideo(null); setAssistantData(null);
    setCreativeChallenge(null); setCollectiveConfig(null); setRecordingTime(0); stopCamera();
    setUploading(false); setUploadProgress(0); setUploadError(null); setUploadSuccess(null); setUploadedVideoData(null); setShowResults(false); setCameraError(null);
  };

  // --- FORMAT TIME ---
  const formatTime = (seconds) => `${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`;

  // --- REFRESH STATS ---
  const refreshStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-user-video-stats`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) console.error(await res.text());
      else updateDisplayedStats();
    } catch(err) { console.error(err); }
  };

  const updateDisplayedStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('user_video_stats_secure').select('*').eq('user_id', user.id).maybeSingle();
      if (error) console.error(error);
      else console.log('Stats mises à jour:', data);
    } catch(err){ console.error(err); }
  };

  // --- RENDER ---
  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Mode selection */}
      {currentStep === 'mode_selection' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-8">Choisis ton type de pitch</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modes.map(mode => (
              <Card key={mode.id} className={`cursor-pointer transition-all duration-200 hover:shadow-lg bg-gradient-to-br ${mode.color} ${mode.borderColor} border-2 hover:scale-105`} onClick={() => handleModeSelect(mode)}>
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                    <mode.icon className="h-8 w-8 text-gray-700" />
                  </div>
                  <CardTitle className="text-lg text-gray-800">{mode.title}</CardTitle>
                  <p className="text-gray-700 text-sm">{mode.description}</p>
                </CardHeader>
                <CardContent>
                  <h4 className="font-medium text-gray-800 text-sm">Fonctionnalités :</h4>
                  <ul className="space-y-1">
                    {mode.features.map((f, i) => <li key={i} className="text-xs text-gray-700 flex items-start gap-1"><span className="text-green-500 mt-1">•</span><span>{f}</span></li>)}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recording / preview / results components */}
      {currentStep === 'assistant' && <PitchAssistant onComplete={handleAssistantComplete} onSkip={handleAssistantSkip} isVisible />}
      {currentStep === 'creative_workshop' && <CreativeWorkshops onSelectChallenge={handleCreativeSelect} onSkip={handleCreativeSkip} isVisible />}
      {currentStep === 'collective_setup' && <CollectiveMode onStartRecording={handleCollectiveStart} onCancel={handleCollectiveCancel} isVisible />}
      {currentStep === 'recording' && (
        <div className="space-y-6">
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
                  <Camera className="h-5 w-5" /> Enregistrement
                </CardTitle>
                <Badge variant={mediaStream ? "default" : "secondary"}>
                  {mediaStream ? "Caméra active" : "Caméra inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                {!mediaStream && <div className="absolute inset-0 flex items-center justify-center text-white text-center"><Camera className="h-12 w-12 opacity-50 mx-auto mb-2" /><p className="opacity-75 text-sm">Caméra non activée</p></div>}
              </div>
              {cameraError && <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"><AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" /><div><h4 className="font-medium text-red-800">Erreur caméra</h4><p className="text-red-700 text-sm mt-1">{cameraError}</p><Button onClick={startCamera} size="sm" disabled={isCameraLoading} className="bg-red-600 hover:bg-red-700">{isCameraLoading ? "Tentative..." : "Réessayer"}</Button></div></div>}
              <div className="flex justify-center gap-4">{!isRecording ? <Button onClick={startRecording} disabled={!mediaStream || isCameraLoading}><Play className="h-5 w-5 mr-2" />{isCameraLoading ? "Chargement..." : "Démarrer"}</Button> : <Button onClick={stopRecording} variant="destructive"><Square className="h-5 w-5 mr-2" />Arrêter</Button>}</div>
            </CardContent>
          </Card>
        </div>
      )}
      {currentStep === 'preview' && recordedVideo && (
        <div className="space-y-6">
          <Card className="bg-white shadow-lg">
            <CardHeader><CardTitle className="text-lg text-gray-800 flex items-center gap-2"><Eye className="h-5 w-5" />Prévisualisation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <video ref={previewVideoRef} src={recordedVideo.url} controls className="w-full rounded-lg" />
              <div className="flex justify-center gap-4">
                <Button onClick={handleRetakeVideo} variant="outline"><RotateCcw className="h-5 w-5 mr-2" />Refaire</Button>
                <Button onClick={handleAcceptVideo} disabled={uploading}>{uploading ? <> <Upload className="h-5 w-5 mr-2 animate-spin" /> Upload ({uploadProgress}%) </> : <> <CheckCircle className="h-5 w-5 mr-2" />Accepter & Uploader </>}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {currentStep === 'results' && showResults && uploadedVideoData && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600" />Résultats</CardTitle></CardHeader>
          <CardContent>
            {uploadedVideoData.public_url && <video controls src={uploadedVideoData.public_url} className="w-full rounded-lg mb-4"></video>}
            <VideoAnalysisResults video={uploadedVideoData} />
          </CardContent>
        </Card>
      )}
      {(currentStep === 'results' || showResults) && <div className="text-center mt-6"><Button onClick={resetUploader} variant="outline"><RotateCcw className="h-4 w-4 mr-2" />Nouveau Pitch</Button></div>}
      {uploadError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"><strong className="font-bold">Erreur:</strong> <span>{uploadError}</span></div>}
      {uploadSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mt-4"><strong className="font-bold">Succès:</strong> <span>{uploadSuccess}</span></div>}
    </div>
  );
};

export default EnhancedVideoUploader;
