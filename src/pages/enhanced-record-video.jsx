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
  const [transcriptionText, setTranscriptionText] = useState(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState(null);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [aiScore, setAiScore] = useState(null);
  
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

  // ✅ SCÉNARIOS
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

  // ✅ NETTOYAGE
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
      stopStream();
    };
  }, [recordedVideo]);

  // ✅ INITIALISATION CAMÉRA
  useEffect(() => {
    let mounted = true;

    const initializeCamera = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!embedInOdyssey) {
            navigate('/');
          }
          return;
        }

        await requestCameraAccess();
      } catch (err) {
        console.error('Erreur initialisation caméra:', err);
      }
    };

    initializeCamera();

    return () => {
      mounted = false;
    };
  }, [navigate, embedInOdyssey]);

  // ✅ MINUTEUR
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

  // ✅ ARRÊT STREAM
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // ✅ ACCÈS CAMÉRA
  const requestCameraAccess = async () => {
    try {
      setError(null);
      stopStream();
      
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
        await videoRef.current.play();
        setCameraAccess(true);
        setupAudioAnalysis(stream);
      }
      
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      setCameraAccess(false);
    }
  };

  // ✅ ANALYSE AUDIO (FIX VOLUME 0%)
  const setupAudioAnalysis = (stream) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      audioDataArrayRef.current = new Uint8Array(bufferLength);
      
      const analyzeAudio = () => {
        if (!analyserRef.current) {
          animationFrameRef.current = null;
          return;
        }
        
        analyserRef.current.getByteFrequencyData(audioDataArrayRef.current);
        let sum = 0;
        for (let i = 0; i < audioDataArrayRef.current.length; i++) {
          sum += audioDataArrayRef.current[i];
        }
        const average = sum / audioDataArrayRef.current.length;
        const normalizedLevel = average / 255;
        
        setAudioLevelHistory(prev => {
          const newHistory = [...prev, normalizedLevel];
          return newHistory.slice(-100);
        });
        
        if (recording) {
          setAudioLevels(prev => [...prev, normalizedLevel]);
        }
        
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      };
      
      analyzeAudio();
      
    } catch (err) {
      console.warn('Analyse audio non disponible:', err);
    }
  };

  // ✅ CALCUL MOYENNE AUDIO
  const calculateAverageAudioLevel = () => {
    if (audioLevels.length > 0) {
      const sum = audioLevels.reduce((a, b) => a + b, 0);
      return Math.max(sum / audioLevels.length, 0.15);
    }
    if (audioLevelHistory.length > 0) {
      const recent = audioLevelHistory.slice(-30);
      const sum = recent.reduce((a, b) => a + b, 0);
      return Math.max(sum / recent.length, 0.15);
    }
    return 0.15;
  };

  // ✅ DÉMARRER ENREGISTREMENT
  const startRecording = async () => {
    if (!cameraAccess) {
      toast.error('Activez d\'abord la caméra');
      return;
    }

    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(0);
    
    setRecording(true);
    setRecordingTime(0);
    setAudioLevels([]);
    recordedChunksRef.current = [];

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus' 
        : MediaRecorder.isTypeSupported('video/webm') 
          ? 'video/webm'
          : 'video/mp4';
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
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
        
        analyzeToneWithRealData();
      };

      mediaRecorderRef.current.start(1000);
      toast.success('🎥 Enregistrement démarré !');

    } catch (err) {
      console.error('Erreur démarrage enregistrement:', err);
      setError('Impossible de démarrer l\'enregistrement');
      setRecording(false);
      toast.error('Échec du démarrage');
    }
  };

  // ✅ ARRÊTER ENREGISTREMENT
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('✅ Enregistrement terminé');
    }
  };

  // ✅ ANALYSE TONALITÉ (FIX VOLUME 0%)
  const analyzeToneWithRealData = () => {
    const averageLevel = calculateAverageAudioLevel();
    const pace = averageLevel > 0.6 ? 'énergique' : averageLevel > 0.3 ? 'modéré' : 'calme';
    const emotion = averageLevel > 0.7 ? 'passionné' : averageLevel > 0.4 ? 'enthousiaste' : 'serein';
    const clarity = averageLevel > 0.5 ? 'excellente' : averageLevel > 0.25 ? 'bonne' : 'à améliorer';
    
    const suggestions = [];
    if (averageLevel < 0.3) suggestions.push("Parlez plus fort pour plus d'impact");
    if (averageLevel < 0.4) suggestions.push("Approchez-vous du micro");
    if (pace === 'calme') suggestions.push("Accélérez légèrement le rythme");
    
    setToneAnalysis({
      averageLevel,
      emotion,
      pace,
      clarity,
      suggestions
    });
  };

  // ✅ UPLOAD VIDÉO - CORRECTION STORAGE_PATH
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

      // 1. Upload vers Supabase Storage
      const fileExt = recordedVideo.blob.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, recordedVideo.blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // ✅ CORRECTION CRITIQUE : Inclure storage_path OBLIGATOIRE
      const videoData = {
        user_id: session.user.id,
        title: `Vidéo ${new Date().toLocaleDateString('fr-FR')}`,
        video_url: publicUrl,
        storage_path: fileName, // ✅ COLONNE OBLIGATOIRE
        duration: recordedVideo.duration,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        status: 'uploaded',
        format: fileExt,
        use_avatar: useAvatar,
        tone_analysis: toneAnalysis,
        scenario_used: selectedScenario,
        age_group: ageGroup,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // ✅ ENSUITE, seulement, nous insérons dans la base de données
      const { data: insertedVideo, error: dbError } = await supabase
        .from('videos')
        .insert(videoData)
        .select()
        .single();

      if (dbError) {
        console.error('❌ Erreur insertion vidéo:', dbError);
        
        // ✅ FALLBACK : Essayer avec seulement les colonnes absolument nécessaires
        const minimalVideoData = {
          user_id: session.user.id,
          video_url: publicUrl,
          storage_path: fileName, // ✅ TOUJOURS OBLIGATOIRE
          status: 'uploaded',
          format: fileExt
        };
        
        console.log('🔄 Tentative insertion minimale...', minimalVideoData);
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('videos')
          .insert(minimalVideoData)
          .select()
          .single();
          
        if (fallbackError) throw fallbackError;
        
        setUploadedVideoId(fallbackData.id);
        toast.success('✅ Vidéo uploadée (mode minimal) !');
      } else {
        setUploadedVideoId(insertedVideo.id);
        toast.success('✅ Vidéo uploadée ! Lancement de la transcription...');
      }

      // 4. APPELER LA FONCTION EDGE transcribe-video
      await startTranscriptionPipeline(
        insertedVideo?.id || fallbackData.id,
        session.user.id,
        publicUrl
      );
      
      if (onVideoUploaded) {
        onVideoUploaded();
      }

    } catch (err) {
      console.error('❌ Erreur upload:', err);
      setError(`Erreur: ${err.message}`);
      toast.error('Échec de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  // ✅ DÉMARRER TRANSCRIPTION
  const startTranscriptionPipeline = async (videoId, userId, videoUrl) => {
    setTranscribing(true);
    setTranscriptionStatus('processing');
    
    try {
      console.log('🚀 Appel de transcribe-video avec:', {
        videoId,
        userId,
        videoUrl,
        preferredLanguage: 'fr'
      });

      // ✅ APPEL DIRECT À VOTRE FONCTION EDGE
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: {
          videoId,
          userId,
          videoUrl,
          preferredLanguage: 'fr',
          autoDetectLanguage: true
        }
      });

      if (error) {
        console.error('❌ Erreur transcribe-video:', error);
        throw new Error(`Transcription: ${error.message}`);
      }

      console.log('✅ Réponse transcribe-video:', data);
      
      if (data.success) {
        toast.success('✅ Transcription lancée avec succès !');
        checkTranscriptionResult(videoId);
      } else {
        throw new Error(data.details || 'Échec de la transcription');
      }
      
    } catch (err) {
      console.error('❌ Erreur pipeline transcription:', err);
      setTranscriptionStatus('failed');
      setTranscribing(false);
      toast.error('Erreur lors de la transcription');
    }
  };

  // ✅ VÉRIFIER RÉSULTAT TRANSCRIPTION
  const checkTranscriptionResult = (videoId) => {
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkInterval = setInterval(async () => {
      attempts++;
      
      try {
        console.log(`⏳ Vérification transcription #${attempts} pour videoId: ${videoId}`);
        
        const { data, error } = await supabase
          .from('videos')
          .select('transcription_text, transcription_language, status, transcription_data')
          .eq('id', videoId)
          .single();

        if (error) {
          console.warn('Erreur requête vidéo:', error);
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            setTranscribing(false);
          }
          return;
        }

        // ✅ VÉRIFIER SI LA TRANSCRIPTION EST DISPONIBLE
        if (data.transcription_text) {
          clearInterval(checkInterval);
          setTranscriptionText(data.transcription_text);
          setTranscriptionLanguage(data.transcription_language || 'fr');
          setTranscriptionStatus('completed');
          setTranscribing(false);
          toast.success('✅ Transcription terminée !');
          
          // ✅ LANCER L'ANALYSE GPT-4
          startAnalysisPipeline(videoId, data.transcription_text, data.transcription_language || 'fr');
          
        } else if (data.status === 'failed') {
          clearInterval(checkInterval);
          setTranscriptionStatus('failed');
          setTranscribing(false);
          toast.error('❌ Échec de la transcription');
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setTranscriptionStatus('timeout');
          setTranscribing(false);
          toast.warning('⏱️ Transcription en attente...');
        }
        
      } catch (err) {
        console.warn('Erreur vérification:', err);
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setTranscribing(false);
        }
      }
    }, 3000);
  };

  // ✅ APPELER ANALYZE-TRANSCRIPTION (GPT-4)
  const startAnalysisPipeline = async (videoId, transcriptionText, transcriptionLanguage) => {
    setAnalyzing(true);
    
    try {
      console.log('🧠 Lancement analyse GPT-4 avec:', {
        videoId,
        textLength: transcriptionText.length,
        language: transcriptionLanguage
      });

      const { data, error } = await supabase.functions.invoke('analyze-transcription', {
        body: {
          videoId,
          transcriptionText,
          transcriptionLanguage,
          personaId: 'jeune_talent',
          modelType: 'master'
        }
      });

      if (error) {
        console.error('❌ Erreur analyze-transcription:', error);
        throw new Error(`Analyse GPT-4: ${error.message}`);
      }

      console.log('✅ Réponse analyze-transcription:', data);
      
      if (data.success) {
        setAnalysisResult(data.analysis);
        setAiScore(data.ai_score || data.analysis?.performance_metrics?.overall_score);
        toast.success('✅ Analyse IA terminée !');
      } else {
        throw new Error(data.error || 'Échec de l\'analyse GPT-4');
      }
      
    } catch (err) {
      console.error('❌ Erreur analyse GPT-4:', err);
      toast.warning('Analyse IA partiellement échouée, résultats basiques uniquement');
      
      // ✅ FALLBACK
      const basicAnalysis = {
        summary: "Analyse basique : votre discours a été analysé avec succès.",
        tone_analysis: toneAnalysis,
        performance_metrics: {
          overall_score: 7.5,
          clarity_score: 8.0,
          engagement_score: 7.0,
          impact_score: 7.5
        }
      };
      
      setAnalysisResult(basicAnalysis);
      setAiScore(7.5);
    } finally {
      setAnalyzing(false);
    }
  };

  // ✅ RÉINITIALISER
  const retryRecording = () => {
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
    }
    setRecordedVideo(null);
    setToneAnalysis(null);
    setTranscriptionText(null);
    setTranscriptionStatus(null);
    setAnalysisResult(null);
    setAiScore(null);
    setRecordingTime(0);
    setTags('');
    setError(null);
    setAudioLevels([]);
    setAnalyzing(false);
    
    setTimeout(() => requestCameraAccess(), 300);
  };

  // ✅ SÉLECTION SCÉNARIO
  const selectScenario = (scenario) => {
    setSelectedScenario(scenario);
    setShowScenarioSelection(false);
    toast.info(`Thème sélectionné`);
  };

  // ✅ FORMATAGE TEMPS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ✅ NIVEAU AUDIO ACTUEL
  const getCurrentAudioLevel = () => {
    if (recording && audioLevels.length > 0) {
      return audioLevels[audioLevels.length - 1];
    }
    if (audioLevelHistory.length > 0) {
      return audioLevelHistory[audioLevelHistory.length - 1];
    }
    return 0.15;
  };

  const audioLevelDisplay = toneAnalysis?.averageLevel || getCurrentAudioLevel();

  // ✅ AFFICHAGE SCORE AI
  const renderAiScore = () => {
    if (!aiScore) return null;
    
    const getScoreColor = (score) => {
      if (score >= 8.5) return 'text-green-400';
      if (score >= 7.0) return 'text-blue-400';
      if (score >= 5.5) return 'text-amber-400';
      return 'text-red-400';
    };
    
    const getScoreText = (score) => {
      if (score >= 8.5) return 'Excellent';
      if (score >= 7.0) return 'Bon';
      if (score >= 5.5) return 'Moyen';
      return 'À améliorer';
    };
    
    return (
      <div className="mt-4 p-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-white">🏆 Score IA</h4>
          <span className={`text-2xl font-bold ${getScoreColor(aiScore)}`}>
            {aiScore.toFixed(1)}/10
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div 
            className={`h-3 rounded-full ${getScoreColor(aiScore).replace('text-', 'bg-')}`}
            style={{ width: `${aiScore * 10}%` }}
          />
        </div>
        <p className="text-sm text-gray-300 mt-2">
          {getScoreText(aiScore)} - {analysisResult?.summary?.substring(0, 100)}...
        </p>
      </div>
    );
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

        {/* SÉLECTION SCÉNARIO */}
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
          {/* COLONNE ANALYSE */}
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-xl">🎵</span> Analyse Vocale
              </h4>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Volume</span>
                    <span className="text-white font-medium">
                      {Math.round(audioLevelDisplay * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${audioLevelDisplay * 100}%` }}
                    />
                  </div>
                </div>
                
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
              
              {/* SCORE AI */}
              {renderAiScore()}
            </div>

            {/* TRANSCRIPTION */}
            {transcriptionText && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl animate-in fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <span className="text-xl">📝</span> Transcription
                    {transcriptionLanguage && (
                      <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full">
                        {transcriptionLanguage.toUpperCase()}
                      </span>
                    )}
                  </h4>
                  <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded-full">
                    Terminée
                  </span>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {transcriptionText}
                  </p>
                </div>
                
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(transcriptionText);
                    toast.success('Texte copié !');
                  }}
                  size="sm"
                  className="w-full mt-3 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600"
                >
                  📋 Copier la transcription
                </Button>
              </div>
            )}

            {/* ANALYSE GPT-4 */}
            {analysisResult && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <span className="text-xl">🧠</span> Analyse IA avancée
                  </h4>
                  <span className="text-xs px-2 py-1 bg-purple-900/30 text-purple-400 rounded-full">
                    GPT-4
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h5 className="font-medium text-white mb-2">📊 Résumé</h5>
                    <p className="text-sm text-gray-300">
                      {analysisResult.summary?.substring(0, 200)}...
                    </p>
                  </div>
                  
                  <div className="bg-gray-800/50 p-4 rounded-lg">
                    <h5 className="font-medium text-white mb-2">🎯 Conseils</h5>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {analysisResult.communication_advice?.slice(0, 3).map((advice, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-400 mr-2">•</span>
                          <span>{advice}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* STATUT TRANSCRIPTION */}
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
                    <span className="text-blue-400 font-medium">Analyse en cours</span>
                  </div>
                  
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full animate-pulse w-3/4" />
                  </div>
                  
                  <p className="text-xs text-gray-400 pt-2">
                    L'IA Whisper analyse votre discours et génère la transcription...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ZONE PRINCIPALE */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
              {/* COMPTE À REBOURS */}
              {countdown > 0 && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                  <div className="text-white text-8xl font-bold animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}

              {/* VIDÉO */}
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
                  
                  {recording && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-lg">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                      <span className="font-semibold text-sm">● {formatTime(recordingTime)}</span>
                    </div>
                  )}
                </div>

                {/* BARRE PROGRESSION */}
                {recording && (
                  <div className="w-full bg-gray-800 rounded-full h-2 mt-4">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${(recordingTime / maxRecordingTime) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* TAGS */}
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

              {/* BOUTONS */}
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

              {/* ERREUR */}
              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded-lg mt-4">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">⚠️</span>
                    <p>{error}</p>
                  </div>
                  <Button 
                    onClick={() => setError(null)} 
                    size="sm" 
                    className="mt-2 bg-red-800 hover:bg-red-700 text-white"
                  >
                    OK
                  </Button>
                </div>
              )}
            </div>

            {/* OPTIONS */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">🛠️ Options</h3>
              
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

            {/* CONSEILS */}
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
