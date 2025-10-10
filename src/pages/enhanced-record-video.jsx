import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced';
import { supabase } from '../lib/supabase';
import ProfessionalHeader from '../components/ProfessionalHeader';

const EnhancedRecordVideo = ({ user, profile, onSignOut, onVideoUploaded }) => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useAvatar, setUseAvatar] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [toneAnalysis, setToneAnalysis] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState("🎙 Raconte un moment où tu as douté, mais où tu t'es relevé.");
  const [showScenarioSelection, setShowScenarioSelection] = useState(false);
  const [ageGroup, setAgeGroup] = useState('adolescents');
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120;

  // ✅ CORRECTION : Scénarios par défaut
  const scenarios = {
    enfants: [
      "🎙 Dis-moi pourquoi tu aimes ton sport préféré.",
      "🎙 Qu'est-ce que tu ressens quand tu marques un but / réussis ton coup ?",
      "🎙 Si tu devais inventer ton club idéal, à quoi ressemblerait-il ?"
    ],
    adolescents: [
      "🎙 Comment le foot (ou ton sport) t'aide à grandir dans la vie ?",
      "🎙 Raconte un moment où tu as douté, mais où tu t'es relevé.",
      "🎙 Où te vois-tu dans 5 ans grâce à ta passion ?",
      "🎙 Quel joueur ou joueuse t'inspire le plus, et pourquoi ?"
    ],
    adultes: [
      "🎙 Comment ton sport reflète ta personnalité ?",
      "🎙 Quel lien fais-tu entre ton sport et ta vie professionnelle ?",
      "🎙 Que t'apprend ton sport sur la gestion de la pression, de l'échec ou du leadership ?"
    ]
  };

  // ✅ CORRECTION : Nettoyage amélioré des ressources
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [recordedVideo]);

  // ✅ CORRECTION : Initialisation robuste de la caméra avec gestion d'erreur étendue
  useEffect(() => {
    let mounted = true;

    const initializeCamera = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Veuillez vous connecter pour enregistrer une vidéo.');
          navigate('/');
          return;
        }

        await requestCameraAccess();
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
          toast.error('Impossible d\'accéder à la caméra.');
        }
      }
    };

    initializeCamera();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // ✅ CORRECTION : Gestion du minuteur d'enregistrement
  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxRecordingTime) {
            stopRecording();
            toast.warning('Temps d\'enregistrement maximum atteint.');
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording]);

  // ✅ CORRECTION : Arrêter le stream vidéo/audio de manière robuste
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // ✅ CORRECTION : Demander l'accès à la caméra/micro avec gestion d'erreur complète
  const requestCameraAccess = async () => {
    try {
      setError(null);
      
      // Arrêter le stream existant s'il y en a un
      stopStream();

      console.log('📹 Demande d\'accès à la caméra...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: { 
          channelCount: 1, 
          sampleRate: 16000, 
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true
        },
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // ✅ CORRECTION : Attendre que la vidéo soit prête
        await new Promise((resolve, reject) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log('✅ Métadonnées vidéo chargées');
              resolve();
            };
            videoRef.current.onerror = () => {
              reject(new Error('Erreur de chargement de la vidéo'));
            };
            
            // Timeout de sécurité
            setTimeout(() => {
              if (videoRef.current?.readyState >= 1) {
                resolve();
              } else {
                reject(new Error('Timeout de chargement vidéo'));
              }
            }, 3000);
          }
        });
        
        // Forcer la lecture avec gestion d'erreur
        try {
          await videoRef.current.play();
          setCameraAccess(true);
          console.log('✅ Caméra activée avec succès');
          toast.success('Caméra activée !');
        } catch (playError) {
          console.error('❌ Erreur lecture vidéo:', playError);
          throw new Error('Impossible de lire le flux vidéo');
        }
      }

      setupAudioAnalysis(stream);
      
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      let errorMessage = 'Impossible d\'accéder à la caméra. ';
      
      // Gestion des erreurs spécifiques
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.';
        toast.error('Autorisation caméra requise');
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Aucune caméra détectée. Vérifiez votre connexion.';
        toast.error('Aucune caméra détectée');
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'La caméra est déjà utilisée par une autre application.';
        toast.error('Caméra indisponible');
      } else {
        errorMessage += `Erreur technique: ${err.message}`;
      }
      
      setError(errorMessage);
      setCameraAccess(false);
      
      // Afficher un état de fallback
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  // ✅ CORRECTION : Analyser le niveau audio en temps réel
  const setupAudioAnalysis = (stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const analyzeAudio = () => {
        if (!analyserRef.current || !recording) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average / 255);
        
        if (recording) {
          requestAnimationFrame(analyzeAudio);
        }
      };

      if (recording) {
        analyzeAudio();
      }
    } catch (err) {
      console.warn('⚠️ Analyse audio non disponible:', err);
    }
  };

  // ✅ CORRECTION : Démarrer l'enregistrement avec gestion d'erreur améliorée
  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
      await requestCameraAccess();
      return;
    }

    if (!streamRef.current) {
      setError('Flux caméra non disponible.');
      toast.error('Problème de flux vidéo.');
      await requestCameraAccess();
      return;
    }

    setCountdown(3);
    
    // Compte à rebours
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setCountdown(0);
    setRecording(true);
    setRecordingTime(0);
    recordedChunksRef.current = [];

    try {
      const stream = streamRef.current;
      
      // ✅ CORRECTION : Options d'enregistrement compatibles
      const options = {
        mimeType: MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus') 
          ? 'video/webm; codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')
          ? 'video/webm; codecs=vp8,opus'
          : 'video/webm',
        videoBitsPerSecond: 2500000
      };

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { 
          type: recordedChunksRef.current.length > 0 ? recordedChunksRef.current[0].type : 'video/webm'
        });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({
          blob,
          url,
          duration: recordingTime
        });
        
        // Analyse basique de la tonalité
        analyzeToneBasic();
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('❌ Erreur MediaRecorder:', event);
        setError('Erreur lors de l\'enregistrement vidéo.');
        setRecording(false);
        toast.error('Erreur d\'enregistrement');
      };

      mediaRecorderRef.current.start(1000); // Collecte des données chaque seconde
      toast.success('🎥 Enregistrement démarré !');

    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      setError('Erreur lors du démarrage de l\'enregistrement.');
      setRecording(false);
      toast.error('Échec du démarrage de l\'enregistrement');
    }
  };

  // ✅ CORRECTION : Arrêter l'enregistrement de manière sécurisée
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      try {
        mediaRecorderRef.current.stop();
        setRecording(false);
        toast.success('✅ Enregistrement terminé !');
      } catch (err) {
        console.error('❌ Erreur arrêt enregistrement:', err);
        setRecording(false);
      }
    }
  };

  // ✅ CORRECTION : Analyse basique de la tonalité
  const analyzeToneBasic = () => {
    const confidence = Math.min(audioLevel * 2, 1);
    const pace = audioLevel > 0.6 ? 'énergique' : audioLevel > 0.3 ? 'modéré' : 'calme';
    const emotion = audioLevel > 0.7 ? 'passionné' : audioLevel > 0.4 ? 'enthousiaste' : 'serein';
    const clarity = audioLevel > 0.5 ? 'excellente' : audioLevel > 0.2 ? 'bonne' : 'à améliorer';
    
    const suggestions = [];
    if (audioLevel < 0.3) suggestions.push("Parlez plus fort pour plus d'impact");
    if (audioLevel > 0.8) suggestions.push("Diminuez légèrement le volume");
    if (pace === 'calme') suggestions.push("Accélérez légèrement le rythme");

    setToneAnalysis({
      confidence,
      emotion,
      pace,
      clarity,
      suggestions
    });
  };

  // ✅ CORRECTION : Uploader la vidéo avec gestion robuste
  const uploadVideo = async () => {
    if (!recordedVideo) {
      setError('Vous devez enregistrer une vidéo.');
      toast.error('Aucune vidéo à uploader.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const fileExt = 'webm';
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      // Upload vers le storage Supabase
      const { error: uploadError, data } = await supabase.storage
        .from('videos')
        .upload(fileName, recordedVideo.blob);

      if (uploadError) throw uploadError;

      // Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Créer l'entrée vidéo dans la base de données
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          user_id: session.user.id,
          title: `Vidéo ${new Date().toLocaleDateString()}`,
          video_url: publicUrl,
          duration: recordedVideo.duration,
          tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          status: 'uploaded',
          use_avatar: useAvatar,
          tone_analysis: toneAnalysis,
          scenario_used: selectedScenario,
          age_group: ageGroup
        })
        .select()
        .single();

      if (videoError) throw videoError;

      setUploadedVideoId(videoData.id);
      toast.success('Vidéo uploadée avec succès !');
      
      // Déclencher le callback parent
      if (onVideoUploaded) {
        onVideoUploaded();
      }
      
      // Naviguer vers la page de succès
      navigate(`/video-success?id=${videoData.id}`);

    } catch (err) {
      console.error('❌ Erreur upload:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      toast.error('Erreur lors de l\'upload de la vidéo.');
    } finally {
      setUploading(false);
    }
  };

  // ✅ CORRECTION : Réinitialiser l'enregistrement
  const retryRecording = () => {
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
    }
    setRecordedVideo(null);
    setError(null);
    setAnalysisProgress(null);
    setUploadedVideoId(null);
    setRecordingTime(0);
    setTags('');
    setToneAnalysis(null);
    setAudioLevel(0);
    
    // Réinitialiser la caméra
    stopStream();
    setTimeout(() => {
      requestCameraAccess();
    }, 500);
  };

  // ✅ CORRECTION : Réessayer la caméra
  const retryCamera = async () => {
    setError(null);
    await requestCameraAccess();
  };

  // Formater le temps d'enregistrement
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sélectionner un scénario
  const selectScenario = (scenario) => {
    setSelectedScenario(scenario);
    setShowScenarioSelection(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* En-tête amélioré */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-french font-bold text-gray-900 mb-4">
              🎤 Expression Orale SpotBulle
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Transformez votre énergie d'immersion en parole authentique
            </p>
          </div>

          {/* Sélection de scénario */}
          {showScenarioSelection && (
            <div className="card-spotbulle p-6 mb-8">
              <h2 className="text-2xl font-french font-bold mb-6 text-center">
                🎬 Choisissez votre thème d'expression
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { id: 'enfants', label: '👦 Enfants (8-12 ans)', emoji: '👦' },
                  { id: 'adolescents', label: '👨‍🎓 Adolescents (13-17 ans)', emoji: '👨‍🎓' },
                  { id: 'adultes', label: '👨‍💼 Adultes (18+)', emoji: '👨‍💼' }
                ].map(group => (
                  <div
                    key={group.id}
                    onClick={() => setAgeGroup(group.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      ageGroup === group.id
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-2xl mb-2">{group.emoji}</div>
                    <div className="text-gray-800 font-medium">{group.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {scenarios[ageGroup]?.map((scenario, index) => (
                  <div
                    key={index}
                    onClick={() => selectScenario(scenario)}
                    className="p-4 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-all"
                  >
                    <p className="text-gray-800">{scenario}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-500">⏱️ 2 minutes maximum</span>
                      <Button size="sm" variant="outline" className="border-blue-500 text-blue-600">
                        Sélectionner →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Options d'enregistrement */}
            <div className="space-y-6">
              <div className="card-spotbulle p-6">
                <h3 className="text-lg font-semibold mb-4">🛠️ Options</h3>
                
                {/* Option Avatar */}
                <div className="mb-6">
                  <label className="flex items-center justify-between cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div>
                      <div className="font-medium">Utiliser un avatar virtuel</div>
                      <div className="text-sm text-gray-600">Préserve votre anonymat</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useAvatar}
                      onChange={(e) => setUseAvatar(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </label>
                </div>

                {/* Scénario sélectionné */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">🎯 Thème sélectionné</h4>
                  <p className="text-blue-700 text-sm mb-3">{selectedScenario}</p>
                  <Button
                    onClick={() => setShowScenarioSelection(true)}
                    variant="outline"
                    size="sm"
                    className="w-full border-blue-300 text-blue-600"
                  >
                    Changer de thème
                  </Button>
                </div>
              </div>

              {/* Analyse de tonalité en temps réel */}
              {toneAnalysis && (
                <div className="card-spotbulle p-6">
                  <h4 className="font-semibold text-purple-800 mb-3">🎵 Analyse Vocale</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Volume</span>
                        <span>{Math.round(audioLevel * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${audioLevel * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="text-sm space-y-2">
                      <div><strong>Émotion :</strong> {toneAnalysis.emotion}</div>
                      <div><strong>Débit :</strong> {toneAnalysis.pace}</div>
                      <div><strong>Clarté :</strong> {toneAnalysis.clarity}</div>
                    </div>

                    {toneAnalysis.suggestions.length > 0 && (
                      <div className="text-xs text-purple-700 bg-purple-50 p-3 rounded-lg">
                        <strong>💡 Suggestions :</strong>
                        <ul className="mt-1 space-y-1">
                          {toneAnalysis.suggestions.map((suggestion, index) => (
                            <li key={index}>• {suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Zone d'enregistrement principale */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card-spotbulle p-6">
                {/* Compte à rebours */}
                {countdown > 0 && (
                  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="text-white text-8xl font-bold animate-pulse">
                      {countdown}
                    </div>
                  </div>
                )}

                {/* Zone vidéo avec gestion d'erreur */}
                <div className="relative mb-6">
                  <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
                    {cameraAccess && !recordedVideo && (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        onError={() => {
                          setError('Erreur de flux vidéo');
                          setCameraAccess(false);
                        }}
                      />
                    )}
                    
                    {recordedVideo && (
                      <video
                        src={recordedVideo.url}
                        controls
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {!cameraAccess && !recordedVideo && (
                      <div className="w-full h-full flex items-center justify-center text-white bg-gray-800">
                        <div className="text-center p-4">
                          <div className="text-4xl mb-4">📹</div>
                          <p className="text-lg mb-2">Caméra non disponible</p>
                          <p className="text-sm text-gray-300 mb-4">
                            {error || 'Veuillez autoriser l\'accès à la caméra'}
                          </p>
                          <Button
                            onClick={retryCamera}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            🔄 Réessayer la caméra
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Indicateur d'enregistrement */}
                    {recording && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                        <span className="font-semibold">● {formatTime(recordingTime)}</span>
                      </div>
                    )}

                    {/* Indicateur de statut caméra */}
                    {cameraAccess && !recording && !recordedVideo && (
                      <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        ✅ Caméra active
                      </div>
                    )}
                  </div>

                  {/* Barre de progression */}
                  {recording && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                      <div 
                        className="bg-red-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${(recordingTime / maxRecordingTime) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mots-clés (séparés par des virgules)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="ex: football, passion, communauté, France-Maroc"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={recording}
                  />
                </div>

                {/* Boutons de contrôle */}
                <div className="flex gap-3 flex-wrap">
                  {!recordedVideo && !recording && (
                    <Button
                      onClick={startRecording}
                      disabled={!cameraAccess || countdown > 0}
                      className="bg-red-600 hover:bg-red-700 text-white flex-1 py-3 text-lg font-semibold"
                    >
                      🎤 Commencer l'enregistrement
                    </Button>
                  )}

                  {recording && (
                    <Button
                      onClick={stopRecording}
                      className="bg-gray-600 hover:bg-gray-700 text-white flex-1 py-3 text-lg font-semibold"
                    >
                      ⏹️ Arrêter l'enregistrement
                    </Button>
                  )}

                  {recordedVideo && !uploading && (
                    <>
                      <Button
                        onClick={uploadVideo}
                        className="bg-green-600 hover:bg-green-700 text-white flex-1 py-3 text-lg font-semibold"
                      >
                        📤 Uploader la vidéo
                      </Button>
                      <Button
                        onClick={retryRecording}
                        variant="outline"
                        className="flex-1 py-3 text-lg font-semibold"
                      >
                        🔄 Réessayer
                      </Button>
                    </>
                  )}

                  {uploading && (
                    <Button disabled className="flex-1 py-3 text-lg font-semibold">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Upload en cours...
                    </Button>
                  )}

                  {!cameraAccess && (
                    <Button
                      onClick={retryCamera}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex-1 py-3"
                    >
                      🔄 Réinitialiser la caméra
                    </Button>
                  )}
                </div>

                {/* Message d'erreur */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">⚠️</span>
                      <p>{error}</p>
                    </div>
                    <Button 
                      onClick={retryCamera} 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 border-red-300 text-red-600"
                    >
                      Réessayer la caméra
                    </Button>
                  </div>
                )}
              </div>

              {/* Barre de progression du parcours */}
              <div className="card-spotbulle p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🗺️ Votre parcours immersion</h3>
                <div className="flex items-center justify-between">
                  {[
                    { step: 1, name: '🎨 Test personnalité', status: 'completed' },
                    { step: 2, name: '⚽ Immersion simulateur', status: 'completed' },
                    { step: 3, name: '🎤 Expression orale', status: 'current' },
                    { step: 4, name: '🏆 Restitution IA', status: 'pending' }
                  ].map((step, index, array) => (
                    <React.Fragment key={step.step}>
                      <div className="text-center flex-1">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg mx-auto mb-2 ${
                          step.status === 'completed' ? 'bg-green-500' :
                          step.status === 'current' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                        }`}>
                          {step.name.split(' ')[0]}
                        </div>
                        <div className={`text-xs ${
                          step.status === 'completed' ? 'text-green-600' :
                          step.status === 'current' ? 'text-blue-600 font-semibold' : 'text-gray-500'
                        }`}>
                          {step.name.split(' ').slice(1).join(' ')}
                        </div>
                      </div>
                      {index < array.length - 1 && (
                        <div className={`flex-1 h-1 mx-2 ${
                          step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                        }`}></div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Conseils */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">💡 Conseils pour un bon enregistrement</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    Parlez clairement et à un rythme modéré
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    Utilisez un fond neutre et un bon éclairage
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    Souriez et soyez naturel
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    2 minutes maximum pour garder l'attention
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    Ajoutez des mots-clés pertinents pour être mieux découvert
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    Regardez droit dans la caméra pour un contact visuel optimal
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedRecordVideo;
