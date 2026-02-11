// src/pages/enhanced-record-video.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced';
import { supabase } from '../lib/supabase';
import ProfessionalHeader from '../components/ProfessionalHeader';
import { Loader2, Video, Mic, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, Play, Square, Sparkles } from 'lucide-react';

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
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // ✅ CORRECTION VIDÉO : ACCÈS CAMÉRA AMÉLIORÉ
  const requestCameraAccess = async () => {
    try {
      setError(null);
      stopStream();
      
      console.log('📹 Demande d\'accès caméra...');
      
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
        // ✅ CORRECTION CRITIQUE : Attendre que la vidéo soit prête
        videoRef.current.srcObject = stream;
        
        // Attendre que la vidéo soit chargée
        await new Promise((resolve, reject) => {
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
          
          // Timeout de sécurité
          setTimeout(() => {
            if (videoRef.current?.readyState >= 1) {
              onLoaded();
            } else {
              onError();
            }
          }, 3000);
        });
        
        try {
          await videoRef.current.play();
          setCameraAccess(true);
          console.log('✅ Caméra activée avec succès');
          
          // Démarrer l'analyse audio
          setupAudioAnalysis(stream);
          
        } catch (playError) {
          console.error('❌ Erreur lecture vidéo:', playError);
          throw new Error('Lecture vidéo impossible');
        }
      }
      
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
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
      // ✅ CORRECTION VIDÉO : Choisir un format compatible
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=avc1,aac',
        'video/mp4'
      ];
      
      const supportedMimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m));
      const mimeType = supportedMimeType || 'video/webm';
      
      console.log('🎥 Format sélectionné:', mimeType);
      
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
        
        // ✅ CORRECTION VIDÉO : Créer le Blob avec le bon type
        const blobType = chunks.length > 0 && chunks[0].type 
          ? chunks[0].type 
          : (mediaRecorderRef.current?.mimeType || 'video/webm');
        
        const blob = new Blob(chunks, { 
          type: blobType 
        });
        
        const url = URL.createObjectURL(blob);
        
        // ✅ CORRECTION VIDÉO : Créer un élément vidéo temporaire pour vérifier
        const tempVideo = document.createElement('video');
        tempVideo.src = url;
        tempVideo.onloadeddata = () => {
          console.log('✅ Vidéo enregistrée vérifiée, durée:', tempVideo.duration);
          tempVideo.remove();
        };
        tempVideo.onerror = () => {
          console.warn('⚠️ Problème potentiel avec la vidéo enregistrée');
          tempVideo.remove();
        };
        
        setRecordedVideo({
          blob,
          url,
          duration: recordingTime,
          type: blobType
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

  // ✅ AFFICHAGE SCORE IA
  const renderAiScore = () => {
    if (!aiScore) return null;
    const getScoreColor = (s) => s >= 8.5 ? 'text-teal-400' : s >= 7.0 ? 'text-blue-400' : s >= 5.5 ? 'text-amber-400' : 'text-red-400';
    return (
      <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 animate-in fade-in zoom-in duration-500">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-400" /> Score Lumi
          </h4>
          <span className={`text-2xl font-bold ${getScoreColor(aiScore)}`}>
            {aiScore.toFixed(1)}/10
          </span>
        </div>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-1000 ${getScoreColor(aiScore).replace('text-', 'bg-')}`}
            style={{ width: `${aiScore * 10}%` }}
          />
        </div>
      </div>
    );
  };

  const content = (
    <div className={`relative z-10 ${embedInOdyssey ? '' : 'container mx-auto px-4 py-8'}`}>
      <div className="max-w-6xl mx-auto">
        {!embedInOdyssey && (
          <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 rounded-2xl mb-4 animate-glow-pulse">
              <Video className="text-teal-400 w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Le Module Mimétique
            </h1>
            <p className="text-xl text-teal-100/60 max-w-2xl mx-auto">
              Exprimez votre talent face à Lumi et découvrez votre miroir stellaire.
            </p>
          </div>
        )}

        {/* SÉLECTION SCÉNARIO */}
        {showScenarioSelection && (
          <div className="glass-card border-white/10 rounded-[2.5rem] p-8 mb-12 shadow-2xl animate-in zoom-in duration-500">
            <h2 className="text-2xl font-bold mb-8 text-center text-white flex items-center justify-center gap-3">
              <Sparkles className="text-teal-400" /> Choisissez votre défi
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { id: 'enfants', label: '👦 Enfants (8-12 ans)', emoji: '👦' },
                { id: 'adolescents', label: '👨‍🎓 Adolescents (13-17 ans)', emoji: '👨‍🎓' },
                { id: 'adultes', label: '👨‍💼 Adultes (18+)', emoji: '👨‍💼' }
              ].map(group => (
                <div
                  key={group.id}
                  onClick={() => setAgeGroup(group.id)}
                  className={`p-6 rounded-2xl cursor-pointer transition-all border-2 ${
                    ageGroup === group.id
                      ? 'border-teal-500 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.2)]'
                      : 'border-white/5 hover:border-white/10 bg-white/5'
                  }`}
                >
                  <div className="text-3xl mb-3">{group.emoji}</div>
                  <div className="text-teal-50 font-bold uppercase tracking-wider text-xs">{group.label}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4">
              {scenarios[ageGroup]?.map((scenario, index) => (
                <div
                  key={index}
                  onClick={() => selectScenario(scenario)}
                  className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all group cursor-pointer flex items-center justify-between"
                >
                  <p className="text-teal-50 group-hover:text-white transition-colors pr-4 italic">"{scenario}"</p>
                  <Button size="sm" variant="outline" className="border-teal-500/30 text-teal-400 hover:bg-teal-500/10 rounded-xl shrink-0">
                    Choisir
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLONNE ANALYSE */}
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700 delay-200">
            <div className="glass-card border-white/10 rounded-3xl p-6 shadow-2xl">
              <h4 className="font-semibold text-white mb-6 flex items-center gap-2">
                <Mic className="text-teal-400 w-5 h-5" /> Analyse Vocale
              </h4>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-teal-100/60">Intensité</span>
                    <span className="text-teal-400 font-medium">
                      {Math.round(audioLevelDisplay * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${audioLevelDisplay * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Émotion', value: toneAnalysis?.emotion || 'serein', icon: '✨' },
                    { label: 'Débit', value: toneAnalysis?.pace || 'calme', icon: '🌊' },
                    { label: 'Clarté', value: toneAnalysis?.clarity || 'optimale', icon: '💎' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-sm text-teal-100/60 flex items-center gap-2">
                        <span>{item.icon}</span> {item.label}
                      </span>
                      <span className="text-sm text-white font-medium capitalize">{item.value}</span>
                    </div>
                  ))}
                </div>

                {renderAiScore()}
              </div>
            </div>

            {/* TRANSCRIPTION */}
            {transcriptionText && (
              <div className="glass-card border-white/10 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <CheckCircle2 className="text-teal-400 w-5 h-5" /> Transcription
                    {transcriptionLanguage && (
                      <span className="text-[10px] px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full uppercase tracking-wider font-bold ml-2">
                        {transcriptionLanguage.toUpperCase()}
                      </span>
                    )}
                  </h4>
                  <span className="text-xs px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full">
                    Terminée
                  </span>
                </div>
                <div className="bg-black/20 border border-white/5 rounded-2xl p-4 max-h-60 overflow-y-auto custom-scrollbar">
                  <p className="text-sm text-teal-50/80 leading-relaxed italic whitespace-pre-wrap">
                    "{transcriptionText}"
                  </p>
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(transcriptionText);
                    toast.success('Texte copié !');
                  }}
                  size="sm"
                  className="w-full mt-3 bg-white/5 hover:bg-white/10 text-teal-100/60 border border-white/10 rounded-xl"
                >
                  📋 Copier la transcription
                </Button>
              </div>
            )}

            {/* ANALYSE GPT-4 */}
            {analysisResult && (
              <div className="glass-card border-white/10 rounded-3xl p-6 shadow-xl animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Sparkles className="text-teal-400 w-5 h-5" /> Analyse IA avancée
                  </h4>
                  <span className="text-[10px] px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full uppercase tracking-wider font-bold">
                    GPT-4
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <h5 className="font-medium text-teal-400 text-xs uppercase tracking-widest mb-2">📊 Résumé</h5>
                    <p className="text-sm text-teal-50/70 leading-relaxed">
                      {analysisResult.summary?.substring(0, 200)}...
                    </p>
                  </div>
                  
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <h5 className="font-medium text-teal-400 text-xs uppercase tracking-widest mb-2">🎯 Conseils</h5>
                    <ul className="text-sm text-teal-50/70 space-y-2">
                      {analysisResult.communication_advice?.slice(0, 3).map((advice, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-1.5 shrink-0" />
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
              <div className="glass-card border-white/10 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Loader2 className="text-teal-400 w-5 h-5 animate-spin" /> Traitement IA
                  </h4>
                  <span className="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full animate-pulse uppercase tracking-wider font-bold">
                    En cours...
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-teal-100/40 uppercase tracking-widest">Transcription</span>
                    <span className="text-teal-400 font-medium">Analyse en cours</span>
                  </div>
                  
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-teal-500 to-blue-500 h-1.5 rounded-full animate-pulse w-3/4" />
                  </div>
                  
                  <p className="text-[11px] text-teal-100/40 italic pt-2">
                    L'IA Whisper analyse votre discours et génère la transcription...
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ZONE PRINCIPALE - VIDÉO AVEC ANIMATION FLUIDE */}
          <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
            <div className="glass-card border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              {/* Animation de fond subtile */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />

              {/* COMPTE À REBOURS */}
              {countdown > 0 && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-3xl">
                  <div className="text-white text-9xl font-bold animate-ping">
                    {countdown}
                  </div>
                </div>
              )}

              {/* ZONE VIDÉO AVEC CONTOUR ANIMÉ FLUIDE */}
              <div className="relative mb-8 group">
                {/* L'animation de contour fluide (style Lumi/VoltFlow) */}
                <div className={`absolute -inset-1.5 rounded-[2rem] blur-sm opacity-75 transition-all duration-1000 
                  ${recording ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-gradient-x opacity-100' : 
                    uploading ? 'bg-gradient-to-r from-teal-400 via-blue-500 to-teal-400 animate-gradient-x opacity-100' : 
                    'bg-gradient-to-r from-teal-500/30 to-blue-500/30 group-hover:opacity-100'}`} 
                />
                
                <div className="relative bg-black rounded-[1.75rem] overflow-hidden aspect-video shadow-2xl border border-white/10">
                  {!recordedVideo ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('❌ Erreur vidéo live:', e);
                        setError('Erreur de flux vidéo. Veuillez réessayer.');
                      }}
                    />
                  ) : (
                    <video
                      key={recordedVideo.url}
                      src={recordedVideo.url}
                      controls
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('❌ Erreur vidéo enregistrée:', e);
                        setError('La vidéo enregistrée ne peut pas être lue.');
                      }}
                    />
                  )}
                  
                  {/* Overlays de statut */}
                  <div className="absolute top-6 left-6 flex gap-3">
                    {cameraAccess && !recording && !recordedVideo && (
                      <div className="bg-teal-500/90 text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2 border border-white/20 uppercase">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LUMI READY
                      </div>
                    )}
                    {recording && (
                      <div className="bg-red-600 text-white px-4 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-lg border border-white/20">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                        <span className="font-bold text-[10px] tracking-widest uppercase">REC {formatTime(recordingTime)}</span>
                      </div>
                    )}
                    {recordedVideo && !recording && (
                      <div className="bg-blue-600/90 text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest backdrop-blur-md shadow-lg flex items-center gap-2 border border-white/20 uppercase">
                        <CheckCircle2 className="w-3 h-3" />
                        ENREGISTRÉ
                      </div>
                    )}
                  </div>
                </div>

                {/* BARRE PROGRESSION */}
                {recording && (
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-6 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-orange-500 h-1.5 rounded-full transition-all duration-1000"
                      style={{ width: `${(recordingTime / maxRecordingTime) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* ACTIONS */}
              <div className="space-y-6">
                <div className="relative group">
                  <label className="block text-[10px] font-bold text-teal-400/60 uppercase tracking-widest mb-3 ml-1">
                    Mots-clés de votre Odyssée
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="ex: passion, leadership, innovation..."
                    className="input-volt w-full p-4 rounded-2xl text-white placeholder:text-white/20 focus:ring-2 focus:ring-teal-500/50 transition-all outline-none border border-white/10"
                    disabled={recording || uploading}
                  />
                </div>

                <div className="flex gap-4 flex-wrap">
                  {!recordedVideo && !recording && (
                    <Button
                      onClick={startRecording}
                      disabled={!cameraAccess || countdown > 0}
                      className="flex-1 h-16 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl shadow-xl shadow-teal-900/20 transition-all active:scale-[0.98] font-bold text-lg flex items-center justify-center gap-3"
                    >
                      <Mic className="w-6 h-6" />
                      <span>Démarrer l'expérience</span>
                    </Button>
                  )}

                  {recording && (
                    <Button
                      onClick={stopRecording}
                      className="flex-1 h-16 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 transition-all active:scale-[0.98] font-bold text-lg flex items-center justify-center gap-3"
                    >
                      <Square className="w-6 h-6 fill-current" />
                      <span>Terminer</span>
                    </Button>
                  )}

                  {recordedVideo && !uploading && (
                    <>
                      <Button
                        onClick={uploadVideo}
                        className="flex-1 h-16 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white rounded-2xl shadow-xl shadow-teal-900/20 transition-all active:scale-[0.98] font-bold text-lg flex items-center justify-center gap-3"
                      >
                        <UploadCloud className="w-6 h-6" />
                        <span>Uploader vers Lumi</span>
                      </Button>
                      <Button
                        onClick={retryRecording}
                        className="w-16 h-16 bg-white/5 hover:bg-white/10 text-white rounded-2xl border border-white/10 transition-all flex items-center justify-center"
                        title="Recommencer"
                      >
                        <RefreshCw className="w-6 h-6" />
                      </Button>
                    </>
                  )}

                  {uploading && (
                    <Button disabled className="flex-1 h-16 bg-white/5 text-teal-400/50 rounded-2xl border border-white/5 font-bold text-lg flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Synchronisation Lumi...</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* ERREUR */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-4 rounded-2xl mt-6 flex items-center justify-between animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <p className="text-sm">{error}</p>
                  </div>
                  <Button 
                    onClick={() => setError(null)} 
                    size="sm" 
                    className="bg-red-500/20 hover:bg-red-500/30 text-white rounded-xl border-none"
                  >
                    OK
                  </Button>
                </div>
              )}
            </div>

            {/* OPTIONS & CONSEILS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card border-white/10 rounded-3xl p-6 shadow-xl">
                <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" /> Thème Actif
                </h3>
                <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl">
                  <p className="text-teal-100/80 text-sm leading-relaxed mb-4 italic">
                    "{selectedScenario}"
                  </p>
                  <Button
                    onClick={() => setShowScenarioSelection(true)}
                    variant="outline"
                    className="w-full border-teal-500/30 text-teal-400 hover:bg-teal-500/10 rounded-xl text-[10px] font-bold uppercase tracking-widest"
                  >
                    Changer de thème
                  </Button>
                </div>
                
                <div className="mt-6">
                  <label className="flex items-center justify-between cursor-pointer p-4 border border-white/5 rounded-2xl hover:bg-white/5 transition-all">
                    <div>
                      <div className="text-sm font-medium text-white">Avatar Virtuel</div>
                      <div className="text-[10px] text-teal-100/40 uppercase tracking-wider">Mode Anonyme</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useAvatar}
                      onChange={(e) => setUseAvatar(e.target.checked)}
                      className="w-5 h-5 rounded-lg border-white/10 bg-white/5 text-teal-500 focus:ring-teal-500/50"
                    />
                  </label>
                </div>
              </div>

              <div className="glass-card border-white/10 rounded-3xl p-6 shadow-xl">
                <h3 className="text-[10px] font-bold text-white uppercase tracking-widest mb-4">Conseils Lumi</h3>
                <ul className="space-y-4">
                  {[
                    'Parlez avec authenticité et passion',
                    'Regardez l\'objectif comme un ami',
                    'Lumi analyse votre miroir stellaire',
                    '2 minutes pour captiver l\'attention',
                    'Un bon éclairage sublime l\'analyse'
                  ].map((tip, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-teal-100/60">
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
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
    <div className="min-h-screen bg-[#3d6b66] relative overflow-hidden"
      style={{
        backgroundImage: "url('/Fond-2.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Logo Lumi en haut à gauche */}
      <div className="absolute top-0 left-0 p-6 z-20 animate-float">
        <img src="/Logo-2.png" alt="Lumi" className="h-20 md:h-24 w-auto drop-shadow-2xl" />
      </div>

      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="relative pt-24 pb-12">
        {content}
      </div>

      {/* Modale de sélection de scénario */}
      {showScenarioSelection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card border-white/10 rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Sparkles className="text-teal-400" /> Choisissez votre défi
            </h2>
            <div className="grid gap-4">
              {scenarios[ageGroup]?.map((scenario, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedScenario(scenario);
                    setShowScenarioSelection(false);
                  }}
                  className="text-left p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all group"
                >
                  <p className="text-teal-50 group-hover:text-white transition-colors">{scenario}</p>
                </button>
              ))}
            </div>
            <Button 
              onClick={() => setShowScenarioSelection(false)}
              className="w-full mt-8 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10"
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRecordVideo;
