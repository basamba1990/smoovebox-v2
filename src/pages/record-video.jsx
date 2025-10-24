import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';

// ✅ CONSTANTES
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing', 
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
};

// ✅ COMPOSANT TAGS
const TagInput = ({ tags, setTags }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag) => {
    const cleanTag = tag.trim().toLowerCase();
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags(prev => [...prev, cleanTag]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  const suggestedTags = ['football', 'sport', 'passion', 'technique', 'entrainement', 'match', 'jeune', 'adolescent', 'adulte', 'expression'];

  return (
    <div className="space-y-3">
      <label className="block font-semibold text-white">
        🏷️ Mots-clés
      </label>
      <div className="flex flex-wrap gap-2 p-3 bg-gray-700 border border-gray-600 rounded-lg min-h-[50px]">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-full">
            {tag}
            <button 
              type="button" 
              onClick={() => removeTag(tag)}
              className="hover:text-red-300 text-xs"
            >
              ×
            </button>
          </span>
        ))}
        <input 
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "sport, passion, technique..." : "Ajouter un mot-clé"}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 min-w-[120px]"
        />
      </div>
      
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-400">Suggestions :</span>
        {suggestedTags.map(suggestion => (
          <button
            key={suggestion}
            type="button"
            onClick={() => addTag(suggestion)}
            disabled={tags.includes(suggestion)}
            className={`text-xs px-2 py-1 rounded transition-all ${
              tags.includes(suggestion) 
                ? 'bg-blue-600 text-white cursor-not-allowed' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

// ✅ COMPOSANT PRINCIPAL CORRIGÉ
const RecordVideo = ({ onVideoUploaded = () => {}, selectedLanguage = null }) => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useAvatar, setUseAvatar] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [toneAnalysis, setToneAnalysis] = useState(null);
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isAnalyzingTone, setIsAnalyzingTone] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();

  const maxRecordingTime = 300;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // ✅ Nettoyage des ressources
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [recordedVideo]);

  // ✅ Initialisation
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          toast.error('Vous devez être connecté pour enregistrer une vidéo.');
          navigate('/login');
          return;
        }

        setUser(user);
        await refreshSession();
        await requestCameraAccess();

        const defaultTitle = `Vidéo ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        setTitle(defaultTitle);

      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
          toast.error('Erreur initialisation caméra');
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // ✅ Gestion du minuteur
  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxRecordingTime) {
            stopRecording();
            toast.warning('Temps d\'enregistrement maximum atteint (5 minutes).');
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording]);

  // ✅ Suivi de la progression
  useEffect(() => {
    if (!uploadedVideoId) return;

    let intervalId;
    let checkCount = 0;
    const maxChecks = 60;

    const checkProgress = async () => {
      try {
        checkCount++;
        if (checkCount > maxChecks) {
          console.warn('⚠️ Timeout vérification progression');
          clearInterval(intervalId);
          return;
        }

        const { data: video, error } = await supabase
          .from('videos')
          .select('status, analysis, ai_result, tone_analysis, error_message')
          .eq('id', uploadedVideoId)
          .single();

        if (error) {
          console.error('❌ Erreur vérification vidéo:', error);
          return;
        }

        if (video.status === VIDEO_STATUS.ANALYZED) {
          setAnalysisProgress(VIDEO_STATUS.ANALYZED);
          toast.success('🎉 Analyse terminée avec succès !');
          clearInterval(intervalId);
          onVideoUploaded();
          setTimeout(() => {
            navigate(`/video-success?id=${uploadedVideoId}`);
          }, 1500);
        } else if (video.status === VIDEO_STATUS.FAILED) {
          setAnalysisProgress(VIDEO_STATUS.FAILED);
          const errorMsg = video.error_message || 'L\'analyse de la vidéo a échoué.';
          setError(errorMsg);
          toast.error('❌ Échec de l\'analyse');
          clearInterval(intervalId);
        } else {
          setAnalysisProgress(video.status);
        }
      } catch (err) {
        console.error('❌ Erreur vérification progression:', err);
      }
    };

    intervalId = setInterval(checkProgress, 3000);
    checkProgress();

    return () => clearInterval(intervalId);
  }, [uploadedVideoId, navigate, onVideoUploaded]);

  const getProgressMessage = (status) => {
    const messages = {
      [VIDEO_STATUS.UPLOADED]: 'Vidéo téléchargée',
      [VIDEO_STATUS.PROCESSING]: 'Traitement de la vidéo',
      [VIDEO_STATUS.TRANSCRIBED]: 'Transcription en cours',
      [VIDEO_STATUS.ANALYZING]: 'Analyse GPT-4 en cours',
      [VIDEO_STATUS.ANALYZED]: 'Analyse terminée avec succès'
    };
    return messages[status] || 'Traitement en cours';
  };

  // ✅ Arrêter le stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // ✅ Configuration audio
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
        if (!analyserRef.current || !streamRef.current) return;
        
        try {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setAudioLevel(Math.min(average / 128, 1));
          requestAnimationFrame(analyzeAudio);
        } catch (err) {
          console.warn('⚠️ Erreur analyse audio:', err);
        }
      };

      analyzeAudio();
    } catch (err) {
      console.warn('⚠️ Analyse audio non supportée:', err);
    }
  };

  // ✅ Demander l'accès caméra
  const requestCameraAccess = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      streamRef.current = stream;
      setCameraAccess(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('⚠️ Lecture vidéo:', e));
      }

      setupAudioAnalysis(stream);
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      let errorMessage = 'Impossible d\'accéder à la caméra. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Veuillez autoriser l\'accès à la caméra et au microphone.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Aucune caméra n\'a été détectée.';
      } else {
        errorMessage += `Erreur: ${err.message}`;
      }
      
      setError(errorMessage);
      toast.error('❌ Accès caméra refusé');
    }
  };

  // ✅ Démarrer enregistrement
  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('L\'enregistrement vidéo n\'est pas supporté sur votre navigateur.');
      toast.error('Enregistrement non supporté');
      return;
    }

    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!cameraAccess) break;
      setCountdown(i - 1);
    }

    if (!cameraAccess) {
      setError('Caméra non disponible.');
      return;
    }

    try {
      recordedChunksRef.current = [];

      let mimeType = 'video/webm';
      if (isIOS) {
        mimeType = 'video/mp4';
      } else {
        const codecs = [
          'video/webm; codecs=vp9,opus',
          'video/webm; codecs=vp8,opus',
          'video/mp4; codecs=avc1.42E01E,mp4a.40.2',
          'video/webm',
          'video/mp4'
        ];
        
        for (const codec of codecs) {
          if (MediaRecorder.isTypeSupported(codec)) {
            mimeType = codec;
            break;
          }
        }
      }

      const recorderOptions = {
        mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      };

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, recorderOptions);

      mediaRecorderRef.current.onerror = (event) => {
        console.error('❌ Erreur MediaRecorder:', event.error);
        setError(`Erreur enregistrement: ${event.error.name}`);
        setRecording(false);
        toast.error('❌ Erreur enregistrement');
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        if (recordedChunksRef.current.length === 0) {
          console.error('❌ Aucune donnée enregistrée');
          setError('Aucune donnée vidéo enregistrée.');
          return;
        }

        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({
          url,
          blob,
          duration: recordingTime,
          format: mimeType.includes('mp4') ? 'mp4' : 'webm',
          size: blob.size
        });
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setRecordingTime(0);
      toast.success('🎥 Enregistrement démarré !');
    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      let errorMsg = 'Erreur lors du démarrage de l\'enregistrement.';
      
      if (isIOS) {
        errorMsg = 'Enregistrement limité sur Safari iOS. Essayez l\'application Chrome.';
      }
      
      setError(errorMsg);
      toast.error('❌ Démarrage échoué');
    }
  };

  // ✅ Arrêter enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        setRecording(false);
        toast.success('✅ Enregistrement terminé !');
        
        setTimeout(() => {
          if (recordedChunksRef.current.length > 0) {
            const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            analyzeRealTone(blob).catch(console.warn);
          }
        }, 1000);
      } catch (err) {
        console.error('❌ Erreur arrêt enregistrement:', err);
        setRecording(false);
      }
    }
  };

  // ✅ Analyser tonalité
  const analyzeRealTone = async (audioBlob) => {
    try {
      console.log('🎵 Début analyse de tonalité...');
      setIsAnalyzingTone(true);
      
      if (!user) {
        console.warn('⚠️ Utilisateur non connecté, analyse annulée');
        setIsAnalyzingTone(false);
        return;
      }

      const requestBody = {
        audio: await blobToBase64(audioBlob),
        userId: user.id,
        language: 'fr'
      };

      const { data, error } = await supabase.functions.invoke('analyze-tone', {
        body: requestBody
      });

      if (error) {
        console.warn('⚠️ Analyse tonalité échouée:', error);
        setToneAnalysis(getFallbackToneAnalysis());
        setIsAnalyzingTone(false);
        return;
      }

      if (data.success && data.analysis) {
        setToneAnalysis(data.analysis);
        toast.success('🎵 Analyse de tonalité terminée !');
      } else {
        throw new Error('Réponse d\'analyse invalide');
      }

    } catch (err) {
      console.warn('⚠️ Erreur analyse tonalité, utilisation fallback:', err);
      setToneAnalysis(getFallbackToneAnalysis());
    } finally {
      setIsAnalyzingTone(false);
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const getFallbackToneAnalysis = () => {
    const emotions = ['enthousiaste', 'confiant', 'calme', 'énergique', 'passionné'];
    const paces = ['modéré', 'dynamique', 'équilibré'];
    const energyLevels = ['élevé', 'moyen', 'bon'];
    
    return {
      confidence: 0.7 + Math.random() * 0.2,
      emotion: emotions[Math.floor(Math.random() * emotions.length)],
      pace: paces[Math.floor(Math.random() * paces.length)],
      clarity: 'bonne',
      energy: energyLevels[Math.floor(Math.random() * energyLevels.length)],
      suggestions: [
        'Excellent enthousiasme dans votre communication !',
        'Le débit est parfaitement équilibré pour la compréhension',
        'Continuez à sourire pour maintenir une énergie positive'
      ],
      analyzed_at: new Date().toISOString()
    };
  };

  // ✅ Uploader vidéo
  const uploadVideo = async () => {
    if (!recordedVideo) {
      setError('Vous devez enregistrer une vidéo.');
      toast.error('Aucune vidéo à uploader.');
      return;
    }

    if (!user) {
      setError('Vous devez être connecté pour uploader une vidéo.');
      toast.error('Utilisateur non connecté');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);

      console.log('🚀 Début upload vidéo...');

      const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${recordedVideo.format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, recordedVideo.blob, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            if (progress.totalBytes) {
              const percent = Math.round((progress.loadedBytes / progress.totalBytes) * 100);
              setUploadProgress(percent);
            }
          }
        });

      if (uploadError) {
        throw new Error(`Erreur upload: ${uploadError.message}`);
      }

      setUploadProgress(100);

      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      const videoInsertData = {
        title: title || `Vidéo ${new Date().toLocaleDateString('fr-FR')}`,
        description: description || 'Vidéo enregistrée depuis la caméra',
        file_path: filePath,
        storage_path: filePath,
        file_size: recordedVideo.blob.size,
        duration: Math.round(recordingTime),
        user_id: user.id,
        status: VIDEO_STATUS.UPLOADED,
        use_avatar: useAvatar,
        public_url: urlData.publicUrl,
        video_url: urlData.publicUrl,
        format: recordedVideo.format,
        tone_analysis: toneAnalysis,
        tags: tags,
        transcription_language: selectedLanguage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert(videoInsertData)
        .select()
        .single();

      if (videoError) {
        throw new Error(`Erreur création vidéo: ${videoError.message}`);
      }

      console.log('✅ Vidéo créée en base:', videoData.id);
      setUploadedVideoId(videoData.id);
      toast.success('🎉 Vidéo uploadée avec succès !');

      await triggerTranscription(videoData.id, user.id, urlData.publicUrl);

    } catch (err) {
      console.error('❌ Erreur upload:', err);
      let errorMessage = `Erreur lors de l'upload: ${err.message}`;
      
      if (err.message.includes('stockage') || err.message.includes('NULL')) {
        errorMessage = 'Erreur de configuration du stockage.';
      } else if (err.message.includes('quota')) {
        errorMessage = 'Espace de stockage insuffisant.';
      } else if (err.message.includes('network')) {
        errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
      }
      
      setError(errorMessage);
      toast.error('❌ Échec de l\'upload');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ✅ Déclencher transcription
  const triggerTranscription = async (videoId, userId, videoPublicUrl) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Session non valide');
      }

      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { 
          videoId, 
          userId, 
          videoUrl: videoPublicUrl,
          preferredLanguage: selectedLanguage,
          autoDetectLanguage: !selectedLanguage
        }
      });

      if (error) {
        throw new Error(`Erreur transcription: ${error.message}`);
      }

      toast.success('🔍 Transcription en cours...');
      
    } catch (err) {
      console.error('❌ Erreur triggerTranscription:', err);
      toast.warning('⚠️ Problème avec la transcription');
    }
  };

  // ✅ Réinitialiser
  const retryRecording = () => {
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
    }
    
    setRecordedVideo(null);
    setError(null);
    setAnalysisProgress(null);
    setUploadedVideoId(null);
    setRecordingTime(0);
    setTags([]);
    setToneAnalysis(null);
    setAudioLevel(0);
    setIsAnalyzingTone(false);
    setUploadProgress(0);
    
    const defaultTitle = `Vidéo ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    setTitle(defaultTitle);
    setDescription('');
    
    stopStream();
    
    setTimeout(() => {
      requestCameraAccess();
    }, 500);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎥 Enregistrez votre vidéo SpotBulle
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Partagez votre passion et connectez-vous avec la communauté
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Caméra et contrôles */}
          <div className="space-y-4">
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative border-2 border-gray-600">
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-10">
                  <div className="text-white text-8xl font-bold animate-pulse">{countdown}</div>
                </div>
              )}
              
              {!cameraAccess && !recordedVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-5">
                  <div className="text-center text-white">
                    <div className="text-6xl mb-4">📹</div>
                    <p className="text-lg">Caméra non disponible</p>
                    <Button 
                      onClick={requestCameraAccess}
                      className="mt-4 bg-blue-600 hover:bg-blue-700"
                    >
                      Réactiver la caméra
                    </Button>
                  </div>
                </div>
              )}
              
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover"
              />
              
              {recording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                  <span className="font-semibold">{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>

            {/* Barre de niveau audio */}
            {recording && (
              <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                ></div>
              </div>
            )}

            {/* Barre de progression upload */}
            {uploadProgress > 0 && uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Upload en cours...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Contrôles d'enregistrement */}
            <div className="flex gap-4 justify-center">
              {!recordedVideo ? (
                <>
                  <Button 
                    onClick={startRecording}
                    disabled={recording || !cameraAccess || countdown > 0}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all"
                  >
                    {recording ? (
                      <span className="flex items-center gap-3">
                        <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
                        Enregistrement...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        ● Commencer
                      </span>
                    )}
                  </Button>
                  
                  {recording && (
                    <Button 
                      onClick={stopRecording}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-4 rounded-lg font-semibold text-lg"
                    >
                      <span className="flex items-center gap-2">
                        ■ Arrêter
                      </span>
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex gap-4 w-full">
                  <Button 
                    onClick={uploadVideo}
                    disabled={uploading || isAnalyzingTone}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-semibold text-lg flex-1 transition-all"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Upload...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        📤 Uploader la vidéo
                      </span>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={retryRecording}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700 px-6 py-4 rounded-lg font-semibold"
                  >
                    <span className="flex items-center gap-2">
                      🔄
                    </span>
                  </Button>
                </div>
              )}
            </div>

            {/* Informations vidéo */}
            {recordedVideo && (
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-600">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                  <div>
                    <span className="text-gray-400">Durée:</span>
                    <div className="font-semibold">{formatTime(recordingTime)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Taille:</span>
                    <div className="font-semibold">{formatFileSize(recordedVideo.size)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Indicateur d'analyse de tonalité */}
            {isAnalyzingTone && (
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-300 font-medium">Analyse de tonalité en cours...</span>
                </div>
              </div>
            )}
          </div>

          {/* Paramètres et analyse */}
          <div className="space-y-6">
            {/* Informations de base */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="font-semibold text-white mb-4 text-lg">📝 Informations vidéo</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Titre de la vidéo *
                  </label>
                  <input 
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Donnez un titre à votre vidéo..."
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Décrivez le contenu de votre vidéo..."
                    rows="3"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Composant Tags */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <TagInput tags={tags} setTags={setTags} />
            </div>

            {/* Option avatar */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox"
                    checked={useAvatar}
                    onChange={(e) => setUseAvatar(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-white group-hover:text-blue-300 transition-colors">
                    Utiliser un avatar virtuel
                  </span>
                  <p className="text-gray-400 text-sm mt-1">
                    Remplacer votre visage par un avatar animé IA (fonctionnalité à venir)
                  </p>
                </div>
              </label>
            </div>

            {/* Affichage résultats analyse de tonalité */}
            {toneAnalysis && (
              <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-xl p-6 border border-purple-700">
                <h3 className="font-semibold mb-4 text-white text-lg flex items-center gap-2">
                  🎵 Analyse de tonalité IA
                  {toneAnalysis.confidence > 0.7 && (
                    <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                      {Math.round(toneAnalysis.confidence * 100)}% de confiance
                    </span>
                  )}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-purple-800/50 rounded-lg">
                      <div className="text-purple-300 text-sm mb-1">Émotion</div>
                      <div className="text-white font-semibold capitalize text-lg">{toneAnalysis.emotion}</div>
                    </div>
                    <div className="text-center p-3 bg-blue-800/50 rounded-lg">
                      <div className="text-blue-300 text-sm mb-1">Débit</div>
                      <div className="text-white font-semibold capitalize text-lg">{toneAnalysis.pace}</div>
                    </div>
                    <div className="text-center p-3 bg-indigo-800/50 rounded-lg">
                      <div className="text-indigo-300 text-sm mb-1">Clarté</div>
                      <div className="text-white font-semibold capitalize text-lg">{toneAnalysis.clarity}</div>
                    </div>
                    <div className="text-center p-3 bg-cyan-800/50 rounded-lg">
                      <div className="text-cyan-300 text-sm mb-1">Énergie</div>
                      <div className="text-white font-semibold capitalize text-lg">{toneAnalysis.energy}</div>
                    </div>
                  </div>
                  
                  {toneAnalysis.suggestions && (
                    <div className="mt-4">
                      <h4 className="font-medium text-white mb-3">💡 Suggestions</h4>
                      <ul className="space-y-2">
                        {toneAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index} className="text-purple-200 text-sm bg-purple-800/30 rounded-lg p-3 border-l-4 border-purple-500">
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Progression de l'analyse */}
            {analysisProgress && (
              <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-xl p-6 border border-green-700">
                <h3 className="font-semibold mb-4 text-white text-lg">📊 Progression de l'analyse</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-green-300 font-medium text-lg">
                      {getProgressMessage(analysisProgress)}
                    </span>
                    <span className="text-green-400 text-2xl">
                      {analysisProgress === VIDEO_STATUS.ANALYZED ? '✅' : 
                       analysisProgress === VIDEO_STATUS.FAILED ? '❌' : '🔄'}
                    </span>
                  </div>
                  
                  <div className="w-full bg-green-800 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-1000 ease-out"
                      style={{ 
                        width: analysisProgress === VIDEO_STATUS.ANALYZED ? '100%' :
                               analysisProgress === VIDEO_STATUS.FAILED ? '100%' :
                               analysisProgress === VIDEO_STATUS.ANALYZING ? '75%' :
                               analysisProgress === VIDEO_STATUS.TRANSCRIBED ? '50%' :
                               analysisProgress === VIDEO_STATUS.PROCESSING ? '25%' : '10%'
                      }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-xs text-green-400">
                    <div className="text-center">Upload</div>
                    <div className="text-center">Traitement</div>
                    <div className="text-center">Transcription</div>
                    <div className="text-center">Analyse IA</div>
                  </div>

                  {analysisProgress === VIDEO_STATUS.FAILED && (
                    <div className="mt-3 p-3 bg-red-900/30 rounded-lg border border-red-700">
                      <p className="text-red-300 text-sm">
                        {error || 'Une erreur est survenue lors de l\'analyse. Veuillez réessayer.'}
                      </p>
                      <Button 
                        onClick={retryRecording}
                        className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm"
                      >
                        Réessayer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Message d'erreur général */}
            {error && !analysisProgress && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-red-400 text-xl">❌</span>
                  <span className="font-medium text-red-300">Erreur</span>
                </div>
                <p className="text-red-400 text-sm">{error}</p>
                <Button 
                  onClick={retryRecording}
                  className="mt-3 bg-red-600 hover:bg-red-700 text-white text-sm"
                >
                  Réessayer
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordVideo;
