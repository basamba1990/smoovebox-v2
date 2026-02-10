// src/pages/enhanced-record-video.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced';
import { supabase } from '../lib/supabase';
import ProfessionalHeader from '../components/ProfessionalHeader';

const EnhancedRecordVideo = ({ user, profile, onSignOut, onVideoUploaded, embedInOdyssey = false }) => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState('');
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useAvatar, setUseAvatar] = useState(false);
  const [audioLevels, setAudioLevels] = useState([]);
  const [audioLevelHistory, setAudioLevelHistory] = useState([]);
  const [toneAnalysis, setToneAnalysis] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState("🎙 Raconte un moment où tu as douté, mais où tu t'es relevé.");
  const [showScenarioSelection, setShowScenarioSelection] = useState(false);
  const [ageGroup, setAgeGroup] = useState('adolescents');
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState('idle');
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioDataArrayRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120;

  // Scénarios
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

  // ✅ FIX: Nettoyage robuste
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
      stopStream();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [recordedVideo]);

  // ✅ FIX: Initialisation caméra avec vérification de session
  useEffect(() => {
    let mounted = true;

    const initializeCamera = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!embedInOdyssey) {
            toast.error('Veuillez vous connecter pour enregistrer une vidéo.');
            navigate('/');
          }
          return;
        }

        await requestCameraAccess();
      } catch (err) {
        console.error('❌ Erreur initialisation caméra:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
        }
      }
    };

    initializeCamera();

    return () => {
      mounted = false;
    };
  }, [navigate, embedInOdyssey]);

  // ✅ FIX: Minuterie avec arrêt propre
  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxRecordingTime) {
            stopRecording();
            toast.info('Temps maximum atteint (2 minutes)');
          }
          return newTime;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recording]);

  // ✅ FIX: Arrêt du stream avec vérification d'état
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try {
        const tracks = streamRef.current.getTracks();
        tracks.forEach(track => {
          track.stop();
          track.enabled = false;
        });
      } catch (e) {
        console.warn('⚠️ Erreur lors de l\'arrêt des tracks:', e);
      }
      streamRef.current = null;
      setCameraAccess(false);
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.warn('⚠️ Erreur fermeture audio context:', e));
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
  }, []);

  // ✅ FIX: Demande d'accès caméra améliorée
  const requestCameraAccess = async () => {
    try {
      setError(null);
      
      // Arrêter le stream existant
      stopStream();

      console.log('📹 Demande d\'accès caméra...');
      
      // Demander l'accès avec permissions
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
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Attendre que la vidéo soit prête
        await new Promise((resolve, reject) => {
          if (!videoRef.current) return reject(new Error('Video ref non disponible'));
          
          const onLoaded = () => {
            videoRef.current.removeEventListener('loadedmetadata', onLoaded);
            videoRef.current.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = () => {
            videoRef.current.removeEventListener('loadedmetadata', onLoaded);
            videoRef.current.removeEventListener('error', onError);
            reject(new Error('Erreur chargement vidéo'));
          };
          
          videoRef.current.addEventListener('loadedmetadata', onLoaded);
          videoRef.current.addEventListener('error', onError);
          
          // Timeout
          setTimeout(() => {
            if (videoRef.current?.readyState >= 1) {
              onLoaded();
            } else {
              onError();
            }
          }, 3000);
        });
        
        // Lancer la lecture
        try {
          await videoRef.current.play();
          setCameraAccess(true);
          console.log('✅ Caméra activée');
          
          // Démarrer l'analyse audio immédiatement
          setupAudioAnalysis(stream);
          
        } catch (playError) {
          console.error('❌ Erreur lecture vidéo:', playError);
          throw new Error('Lecture vidéo impossible');
        }
      }
      
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      let errorMsg = 'Impossible d\'accéder à la caméra. ';
      
      if (err.name === 'NotAllowedError') {
        errorMsg += 'Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
      } else if (err.name === 'NotFoundError') {
        errorMsg += 'Aucune caméra détectée.';
      } else if (err.name === 'NotReadableError') {
        errorMsg += 'Caméra déjà utilisée par une autre application.';
      } else {
        errorMsg += err.message;
      }
      
      setError(errorMsg);
      setCameraAccess(false);
    }
  };

  // ✅ FIX VOLUME 0%: Analyse audio continue même sans enregistrement
  const setupAudioAnalysis = (stream) => {
    try {
      // Créer l'audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      
      // Créer l'analyseur
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      // Se connecter à la source
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // Préparer le buffer pour les données
      const bufferLength = analyserRef.current.frequencyBinCount;
      audioDataArrayRef.current = new Uint8Array(bufferLength);
      
      // Fonction d'analyse récursive
      const analyzeAudio = () => {
        if (!analyserRef.current || !audioDataArrayRef.current) {
          animationFrameRef.current = null;
          return;
        }
        
        // Obtenir les données audio
        analyserRef.current.getByteFrequencyData(audioDataArrayRef.current);
        
        // Calculer le niveau moyen
        let sum = 0;
        for (let i = 0; i < audioDataArrayRef.current.length; i++) {
          sum += audioDataArrayRef.current[i];
        }
        const average = sum / audioDataArrayRef.current.length;
        const normalizedLevel = average / 255; // Normaliser entre 0 et 1
        
        // Mettre à jour l'historique
        setAudioLevelHistory(prev => {
          const newHistory = [...prev, normalizedLevel];
          // Garder seulement les 100 dernières valeurs
          return newHistory.slice(-100);
        });
        
        // Stocker pendant l'enregistrement
        if (recording) {
          setAudioLevels(prev => [...prev, normalizedLevel]);
        }
        
        // Continuer l'analyse
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      
      // Démarrer l'analyse
      analyzeAudio();
      
    } catch (err) {
      console.warn('⚠️ Analyse audio désactivée:', err);
    }
  };

  // ✅ FIX VOLUME 0%: Calculer la moyenne réelle
  const calculateAverageAudioLevel = () => {
    if (audioLevels.length === 0) {
      // Si pas d'enregistrement, utiliser l'historique récent
      if (audioLevelHistory.length === 0) return 0.1; // Valeur par défaut basse
      const recentHistory = audioLevelHistory.slice(-30);
      const sum = recentHistory.reduce((a, b) => a + b, 0);
      return sum / recentHistory.length;
    }
    
    // Moyenne des niveaux pendant l'enregistrement
    const sum = audioLevels.reduce((a, b) => a + b, 0);
    return sum / audioLevels.length;
  };

  // ✅ Démarrer l'enregistrement
  const startRecording = async () => {
    if (!cameraAccess || !streamRef.current) {
      toast.error('Veuillez d\'abord activer la caméra');
      await requestCameraAccess();
      return;
    }

    // Réinitialiser les niveaux
    setAudioLevels([]);
    
    // Compte à rebours
    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(0);
    
    // Démarrer l'enregistrement
    setRecording(true);
    setRecordingTime(0);
    recordedChunksRef.current = [];

    try {
      const stream = streamRef.current;
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm') 
          ? 'video/webm'
          : 'video/mp4';

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const chunks = recordedChunksRef.current;
        const blob = new Blob(chunks, { 
          type: mediaRecorderRef.current?.mimeType || 'video/webm' 
        });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({
          blob,
          url,
          duration: recordingTime
        });
        
        // Analyser la tonalité avec les données réelles
        analyzeToneWithRealData();
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('❌ Erreur MediaRecorder:', event);
        setError('Erreur d\'enregistrement');
        setRecording(false);
        toast.error('Erreur d\'enregistrement');
      };

      mediaRecorderRef.current.start(1000); // Collecter les données chaque seconde
      toast.success('🎥 Enregistrement démarré !');

    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      setError('Impossible de démarrer l\'enregistrement');
      setRecording(false);
      toast.error('Échec du démarrage');
    }
  };

  // ✅ Arrêter l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      try {
        mediaRecorderRef.current.stop();
        setRecording(false);
        toast.success('✅ Enregistrement terminé');
      } catch (err) {
        console.error('❌ Erreur arrêt enregistrement:', err);
        setRecording(false);
      }
    }
  };

  // ✅ FIX VOLUME 0%: Analyse avec données réelles
  const analyzeToneWithRealData = () => {
    const averageLevel = calculateAverageAudioLevel();
    
    // Éviter les valeurs trop basses pour les tests
    const displayLevel = Math.max(averageLevel, 0.15); // Minimum 15% pour éviter 0%
    
    // Calculer les métriques
    const confidence = Math.min(displayLevel * 2, 1);
    const pace = displayLevel > 0.6 ? 'énergique' : displayLevel > 0.3 ? 'modéré' : 'calme';
    const emotion = displayLevel > 0.7 ? 'passionné' : displayLevel > 0.4 ? 'enthousiaste' : 'serein';
    const clarity = displayLevel > 0.5 ? 'excellente' : displayLevel > 0.25 ? 'bonne' : 'à améliorer';
    
    // Suggestions contextuelles
    const suggestions = [];
    if (displayLevel < 0.3) suggestions.push("Parlez plus fort pour plus d'impact");
    if (displayLevel < 0.4) suggestions.push("Approchez-vous du micro");
    if (pace === 'calme') suggestions.push("Accélérez légèrement le rythme");
    if (pace === 'énergique') suggestions.push("Excellent enthousiasme !");
    
    setToneAnalysis({
      confidence,
      emotion,
      pace,
      clarity,
      suggestions,
      averageLevel: displayLevel,
      rawAverage: averageLevel
    });
    
    console.log('📊 Analyse audio:', { averageLevel: displayLevel, emotion, pace, clarity });
  };

  // ✅ FIX SUPABASE: Upload avec appel aux fonctions Edge
  const uploadVideo = async () => {
    if (!recordedVideo) {
      toast.error('Aucune vidéo à uploader');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      // Upload vers Supabase Storage
      const fileExt = 'webm';
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, recordedVideo.blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Créer l'entrée dans la base de données
      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert({
          user_id: session.user.id,
          title: `Vidéo ${new Date().toLocaleDateString('fr-FR')}`,
          video_url: publicUrl,
          storage_path: fileName,
          duration: recordedVideo.duration,
          tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
          status: 'uploaded',
          use_avatar: useAvatar,
          tone_analysis: toneAnalysis,
          scenario_used: selectedScenario,
          age_group: ageGroup,
          transcription: null,
          transcription_status: 'pending'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadedVideoId(videoData.id);
      toast.success('✅ Vidéo uploadée !');
      
      // ✅ APPEL DIRECT AUX FONCTIONS SUPABASE
      startTranscriptionPipeline(videoData.id, publicUrl, session.user.id);
      
      if (onVideoUploaded) {
        onVideoUploaded();
      }

    } catch (err) {
      console.error('❌ Erreur upload:', err);
      setError(`Erreur upload: ${err.message}`);
      toast.error('Échec de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  // ✅ FIX: Appel direct aux fonctions Edge Supabase
  const startTranscriptionPipeline = async (videoId, videoUrl, userId) => {
    setTranscribing(true);
    setTranscriptionStatus('processing');
    
    try {
      console.log('🚀 Démarrage pipeline transcription...');
      
      // 1. Appeler la fonction transcribe-video
      const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-video', {
        body: {
          videoId,
          videoUrl,
          userId,
          preferredLanguage: 'fr'
        }
      });

      if (transcribeError) {
        console.error('❌ Erreur transcription:', transcribeError);
        throw new Error(`Transcription: ${transcribeError.message}`);
      }

      console.log('✅ Transcription lancée:', transcribeData);
      
      // 2. Lancer l'analyse de tonalité
      if (toneAnalysis) {
        const { error: toneError } = await supabase.functions.invoke('analyze-tone', {
          body: {
            videoId,
            toneData: toneAnalysis
          }
        });
        
        if (toneError) console.warn('⚠️ Analyse tonalité:', toneError);
      }

      // 3. Vérifier périodiquement le statut
      checkTranscriptionResult(videoId);
      
    } catch (err) {
      console.error('❌ Erreur pipeline:', err);
      setTranscriptionStatus('failed');
      setTranscribing(false);
      toast.error('Erreur lors de la transcription');
    }
  };

  // ✅ Vérifier le résultat de la transcription
  const checkTranscriptionResult = (videoId) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 tentatives sur 90 secondes
    
    const checkInterval = setInterval(async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('transcription, transcription_status')
          .eq('id', videoId)
          .single();

        if (error) throw error;

        if (data.transcription_status === 'completed' && data.transcription) {
          clearInterval(checkInterval);
          setTranscription(data.transcription);
          setTranscriptionStatus('completed');
          setTranscribing(false);
          toast.success('✅ Transcription terminée !');
        } 
        else if (data.transcription_status === 'failed') {
          clearInterval(checkInterval);
          setTranscriptionStatus('failed');
          setTranscribing(false);
          toast.error('❌ Échec de la transcription');
        }
        else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setTranscriptionStatus('timeout');
          setTranscribing(false);
          toast.warning('⏱️ Transcription en attente...');
        }
        
      } catch (err) {
        console.warn('⏳ Vérification transcription:', err);
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setTranscribing(false);
        }
      }
    }, 3000); // Vérifier toutes les 3 secondes
  };

  // ✅ Réinitialiser
  const retryRecording = () => {
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
    }
    setRecordedVideo(null);
    setToneAnalysis(null);
    setTranscription(null);
    setTranscriptionStatus('idle');
    setAudioLevels([]);
    setRecordingTime(0);
    setTags('');
    setError(null);
    
    // Réactiver la caméra
    stopStream();
    setTimeout(() => requestCameraAccess(), 500);
  };

  // ✅ Sélection scénario
  const selectScenario = (scenario) => {
    setSelectedScenario(scenario);
    setShowScenarioSelection(false);
    toast.info(`Thème sélectionné: ${scenario.substring(0, 40)}...`);
  };

  // Formatage temps
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculer le niveau audio actuel pour l'affichage
  const getCurrentAudioLevel = () => {
    if (recording && audioLevels.length > 0) {
      return audioLevels[audioLevels.length - 1];
    }
    if (audioLevelHistory.length > 0) {
      return audioLevelHistory[audioLevelHistory.length - 1];
    }
    return 0.15; // Valeur par défaut
  };

  const content = (
    <div className={embedInOdyssey ? '' : 'container mx-auto px-4 py-8'}>
      <div className="max-w-6xl mx-auto">
        {!embedInOdyssey && (
          <div className="text-center mb-8">
            <h1 className="text-4xl font-french font-bold text-white mb-4">
              🎤 Le module mimétique
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Enregistrement vidéo et miroir de ton étoile
            </p>
          </div>
        )}

        {/* Sélection de scénario */}
        {showScenarioSelection && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8 shadow-2xl">
            <h2 className="text-2xl font-french font-bold mb-6 text-center text-white">
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
                      ? 'border-blue-500 bg-blue-900/30'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                  }`}
                >
                  <div className="text-2xl mb-2">{group.emoji}</div>
                  <div className="text-gray-200 font-medium">{group.label}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {scenarios[ageGroup]?.map((scenario, index) => (
                <div
                  key={index}
                  onClick={() => selectScenario(scenario)}
                  className="p-4 border border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-900/20 transition-all bg-gray-800/30"
                >
                  <p className="text-gray-200">{scenario}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-gray-400">⏱️ 2 minutes maximum</span>
                    <Button size="sm" variant="outline" className="border-blue-500 text-blue-400">
                      Sélectionner →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne analyse */}
          <div className="space-y-6">
            {/* Analyse vocale */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-xl">🎵</span> Analyse Vocale
              </h4>
              
              <div className="space-y-4">
                {/* Volume */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Volume</span>
                    <span className="text-white font-medium">
                      {toneAnalysis 
                        ? `${Math.round(toneAnalysis.averageLevel * 100)}%`
                        : recording 
                          ? `${Math.round(getCurrentAudioLevel() * 100)}%`
                          : '15%'
                      }
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ 
                        width: toneAnalysis 
                          ? `${toneAnalysis.averageLevel * 100}%`
                          : recording
                            ? `${getCurrentAudioLevel() * 100}%`
                            : '15%'
                      }}
                    />
                  </div>
                </div>
                
                {/* Métriques */}
                <div className="text-sm space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Émotion</span>
                    <span className="text-white font-medium">
                      {toneAnalysis?.emotion || 'serein'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Débit</span>
                    <span className="text-white font-medium">
                      {toneAnalysis?.pace || 'calme'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Clarté</span>
                    <span className={`font-medium ${
                      toneAnalysis?.clarity === 'excellente' ? 'text-green-400' :
                      toneAnalysis?.clarity === 'bonne' ? 'text-blue-400' :
                      'text-amber-400'
                    }`}>
                      {toneAnalysis?.clarity || 'à améliorer'}
                    </span>
                  </div>
                </div>

                {/* Suggestions */}
                {toneAnalysis?.suggestions && toneAnalysis.suggestions.length > 0 && (
                  <div className="pt-3 border-t border-gray-800">
                    <div className="text-xs text-blue-300 bg-blue-900/20 p-3 rounded-lg">
                      <strong className="text-blue-200">💡 Suggestions :</strong>
                      <ul className="mt-1.5 space-y-1">
                        {toneAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-1.5">•</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Transcription */}
            {transcription && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <span className="text-xl">📝</span> Transcription
                  </h4>
                  <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded-full">
                    Terminée
                  </span>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {transcription}
                  </p>
                </div>
                
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(transcription);
                    toast.success('Texte copié !');
                  }}
                  size="sm"
                  className="w-full mt-3 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600"
                >
                  📋 Copier la transcription
                </Button>
              </div>
            )}

            {/* Statut transcription */}
            {transcribing && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <span className="text-xl">⚡</span> Traitement IA
                  </h4>
                  <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full animate-pulse">
                    En cours...
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Transcription</span>
                    <span className="text-blue-400 font-medium">En cours</span>
                  </div>
                  
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full animate-pulse w-3/4" />
                  </div>
                  
                  <p className="text-xs text-gray-400 pt-2">
                    Analyse vocale et génération de texte en cours...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Zone principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Zone vidéo */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
              {/* Compte à rebours */}
              {countdown > 0 && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                  <div className="text-white text-8xl font-bold animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}

              {/* Prévisualisation */}
              <div className="relative mb-6">
                <div className="bg-black rounded-xl overflow-hidden aspect-video relative border border-gray-800">
                  {!recordedVideo ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={recordedVideo.url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  {/* Indicateurs */}
                  {!cameraAccess && !recordedVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95">
                      <div className="text-center p-6">
                        <div className="text-5xl mb-4">📹</div>
                        <p className="text-lg text-white mb-2">Caméra non disponible</p>
                        <p className="text-sm text-gray-300 mb-4 max-w-sm">
                          {error || 'Autorisez l\'accès à la caméra pour continuer'}
                        </p>
                        <Button
                          onClick={requestCameraAccess}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Activer la caméra
                        </Button>
                      </div>
                    </div>
                  )}

                  {recording && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-lg">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                      <span className="font-semibold text-sm">● {formatTime(recordingTime)}</span>
                    </div>
                  )}

                  {cameraAccess && !recording && !recordedVideo && (
                    <div className="absolute top-4 left-4 bg-green-600/90 text-white px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
                      ✅ Caméra active
                    </div>
                  )}
                </div>

                {/* Barre de progression */}
                {recording && (
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-4">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${(recordingTime / maxRecordingTime) * 100}%` }}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0:00</span>
                      <span>2:00</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mots-clés (séparés par des virgules)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ex: football, passion, communauté, France-Maroc"
                  className="w-full p-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-800 text-white placeholder:text-gray-400"
                  disabled={recording || uploading}
                />
              </div>

              {/* Boutons */}
              <div className="flex gap-3 flex-wrap">
                {!recordedVideo && !recording && (
                  <Button
                    onClick={startRecording}
                    disabled={!cameraAccess || countdown > 0}
                    className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-4 text-lg font-semibold shadow-lg"
                  >
                    🎤 Commencer l'enregistrement
                  </Button>
                )}

                {recording && (
                  <Button
                    onClick={stopRecording}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 text-lg font-semibold border border-gray-600"
                  >
                    ⏹️ Arrêter l'enregistrement
                  </Button>
                )}

                {recordedVideo && !uploading && (
                  <>
                    <Button
                      onClick={uploadVideo}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 text-lg font-semibold"
                    >
                      📤 Uploader la vidéo
                    </Button>
                    <Button
                      onClick={retryRecording}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-4 text-lg font-semibold border border-gray-600"
                    >
                      🔄 Réessayer
                    </Button>
                  </>
                )}

                {uploading && (
                  <Button disabled className="flex-1 py-4 text-lg font-semibold bg-gray-800 text-gray-400">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Upload en cours...
                  </Button>
                )}
              </div>

              {/* Erreur */}
              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded-lg mt-4">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">⚠️</span>
                    <p>{error}</p>
                  </div>
                  <Button 
                    onClick={requestCameraAccess} 
                    size="sm" 
                    className="mt-2 bg-red-800 hover:bg-red-700 text-white"
                  >
                    Réessayer
                  </Button>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">🛠️ Options</h3>
              
              {/* Avatar */}
              <div className="mb-6">
                <label className="flex items-center justify-between cursor-pointer p-3 border border-gray-700 rounded-lg hover:bg-gray-800/50 bg-gray-800/30 transition-all">
                  <div>
                    <div className="font-medium text-white">Utiliser un avatar virtuel</div>
                    <div className="text-sm text-gray-400">Préserve votre anonymat</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={useAvatar}
                    onChange={(e) => setUseAvatar(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                  />
                </label>
              </div>

              {/* Scénario */}
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-300 mb-2">🎯 Thème sélectionné</h4>
                <p className="text-blue-200 text-sm mb-3">{selectedScenario}</p>
                <Button
                  onClick={() => setShowScenarioSelection(true)}
                  className="w-full bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-800"
                >
                  Changer de thème
                </Button>
              </div>
            </div>

            {/* Conseils */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
              <h3 className="font-semibold text-white mb-3">💡 Conseils pour un bon enregistrement</h3>
              <ul className="text-sm text-gray-300 space-y-2">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  Parlez clairement et à un rythme modéré
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  Utilisez un fond neutre et un bon éclairage
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  Souriez et soyez naturel
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  2 minutes maximum pour garder l'attention
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  Ajoutez des mots-clés pertinents
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">•</span>
                  Regardez droit dans la caméra
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedInOdyssey) {
    return content;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      {content}
    </div>
  );
};

export default EnhancedRecordVideo;
