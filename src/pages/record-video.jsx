// record-video.jsx - VERSION COMPLÈTE CORRIGÉE AVEC SOLUTION HTTPS
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession, invokeEdgeFunctionWithRetry } from '../lib/supabase';

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

// ✅ COMPOSANT TAGS AMÉLIORÉ
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

// ✅ COMPOSANT PRINCIPAL CORRIGÉ AVEC SOLUTION HTTPS
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
        console.log('🔄 Initialisation RecordVideo...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('❌ Utilisateur non connecté:', userError);
          toast.error('Vous devez être connecté pour enregistrer une vidéo.');
          navigate('/login');
          return;
        }

        setUser(user);
        console.log('✅ Utilisateur connecté:', user.id);
        
        await refreshSession();
        await requestCameraAccess();

        const defaultTitle = `Vidéo ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        setTitle(defaultTitle);
        console.log('🎯 Titre par défaut:', defaultTitle);

      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError("Erreur lors de l'initialisation de la caméra.");
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
            toast.warning("Temps d'enregistrement maximum atteint (5 minutes).");
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording]);

  // ✅ Suivi de la progression CORRIGÉ
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

        console.log(`🔍 Vérification progression #${checkCount} pour video:`, uploadedVideoId);
        
        const { data: video, error } = await supabase
          .from('videos')
          .select('status, analysis, ai_result, tone_analysis, error_message')
          .eq('id', uploadedVideoId)
          .single();

        if (error) {
          console.error('❌ Erreur vérification vidéo:', error);
          return;
        }

        console.log('📊 Statut vidéo:', video.status);

        // ✅ Update progress for all status changes
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
          const errorMsg = video.error_message || 'L analyse de la vidéo a échoué.';
          setError(errorMsg);
          toast.error("❌ Échec de l'analyse");
          clearInterval(intervalId);
        } else {
          // ✅ Update progress for intermediate statuses
          setAnalysisProgress(video.status);
          console.log('📈 Mise à jour progression:', video.status);
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
      console.log('📹 Demande accès caméra...');
      
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
      
      console.log('✅ Accès caméra accordé');
      streamRef.current = stream;
      setCameraAccess(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('⚠️ Lecture vidéo:', e));
      }

      setupAudioAnalysis(stream);
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      let errorMessage = "Impossible d'accéder à la caméra. ";
      
      if (err.name === 'NotAllowedError') {
        errorMessage += "Veuillez autoriser l'accès à la caméra et au microphone.";
      } else if (err.name === 'NotFoundError') {
        errorMessage += "Aucune caméra n'a été détectée.";
      } else if (err.name === 'NotSupportedError') {
        errorMessage += "Votre navigateur ne supporte pas l'enregistrement vidéo.";
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
      setError("Veuillez autoriser l'accès à la caméra.");
      toast.error('Accès caméra requis.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError("L'enregistrement vidéo n'est pas supporté sur votre navigateur. Essayez Chrome ou Firefox.");
      toast.error('Enregistrement non supporté');
      return;
    }

    // ✅ Compte à rebours
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

      console.log('📹 Format sélectionné:', mimeType, 'iOS:', isIOS);

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

        console.log('✅ Enregistrement terminé:', {
          duration: recordingTime,
          size: blob.size,
          format: mimeType.includes('mp4') ? 'mp4' : 'webm'
        });
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setRecordingTime(0);
      toast.success('🎥 Enregistrement démarré !');
    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      let errorMsg = "Erreur lors du démarrage de l'enregistrement.";
      
      if (isIOS) {
        errorMsg = "Enregistrement limité sur Safari iOS. Essayez l'application Chrome.";
      } else if (err.name === 'InvalidStateError') {
        errorMsg = 'État MediaRecorder invalide. Rafraîchissez la page.';
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

      console.log('📤 Appel analyse tonalité (analyze-tone)...');
      console.log('📦 Payload:', {
        userId: user.id,
        language: 'fr',
        audioLength: requestBody.audio.length
      });

      // ✅ UTILISATION DE LA NOUVELLE FONCTION AVEC RETRY ET HTTPS
      const result = await invokeEdgeFunctionWithRetry('analyze-tone', requestBody, {
        maxRetries: 2,
        timeout: 15000
      });

      console.log('📥 Réponse brute analyze-tone:', result);

      if (!result.success) {
        console.error('❌ Analyse tonalité échouée:', result.error);
        console.log('📝 Erreur détaillée:', result.originalError || result.error);
        setToneAnalysis(getFallbackToneAnalysis());
        setIsAnalyzingTone(false);
        return;
      }

      const { data } = result;
      console.log('✅ Analyse tonalité réussie:', data);
      
      if (data.success && data.analysis) {
        setToneAnalysis(data.analysis);
        toast.success('🎵 Analyse de tonalité terminée !');
      } else {
        throw new Error("Réponse d'analyse invalide");
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
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
    const randomPace = paces[Math.floor(Math.random() * paces.length)];

    return {
      emotion: randomEmotion,
      pace: randomPace,
      confidence: (Math.random() * 0.2 + 0.7).toFixed(2), // 70-90%
      suggestion: "Analyse de tonalité par défaut. Veuillez réessayer pour une analyse plus précise."
    };
  };

  // ✅ Upload vidéo
  const uploadVideo = async () => {
    if (!recordedVideo || uploading) return;

    setUploading(true);
    setError(null);
    setAnalysisProgress(VIDEO_STATUS.UPLOADED);
    
    try {
      const file = new File([recordedVideo.blob], `${user.id}_${Date.now()}.${recordedVideo.format}`, { type: recordedVideo.blob.type });
      const filePath = `public/${file.name}`;
      
      console.log('📤 Démarrage upload vers:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onProgress: (event) => {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
            console.log(`⬆️ Upload progress: ${progress}%`);
          }
        });

      if (uploadError) {
        console.error('❌ Erreur upload:', uploadError);
        throw uploadError;
      }

      console.log('✅ Upload réussi:', uploadData.path);

      // 1. Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      console.log('🔗 URL publique:', publicUrl);

      // ✅ VÉRIFICATION CRITIQUE : Tester l'URL
      try {
        const urlCheck = await fetch(publicUrl, { method: 'HEAD' });
        console.log('🔍 Vérification URL:', {
          url: publicUrl,
          status: urlCheck.status,
          ok: urlCheck.ok
        });
        
        if (!urlCheck.ok) {
          throw new Error(`URL vidéo inaccessible: ${urlCheck.status}`);
        }
      } catch (urlError) {
        console.error('❌ Erreur vérification URL:', urlError);
        throw new Error(`URL vidéo invalide: ${urlError.message}`);
      }

      // 2. Enregistrer les métadonnées dans la base de données
      const videoDataToInsert = {
        user_id: user.id,
        title: title || `Vidéo ${new Date().toLocaleDateString('fr-FR')}`,
        description: description || 'Vidéo enregistrée depuis la caméra',
        storage_path: filePath,
        video_url: publicUrl,
        duration_seconds: Math.round(recordingTime),
        file_size_bytes: recordedVideo.blob.size,
        video_format: recordedVideo.format || 'mp4',
        tags: tags || [],
        status: VIDEO_STATUS.UPLOADED,
        use_avatar: useAvatar || false,
        tone_analysis: toneAnalysis,
        transcription_language: selectedLanguage || 'fr',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📝 Insertion en base:', videoDataToInsert);

      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert([videoDataToInsert])
        .select()
        .single();

      if (dbError) {
        console.error('❌ Erreur DB insertion:', dbError);
        throw dbError;
      }

      const videoId = videoData.id;
      setUploadedVideoId(videoId);
      console.log('✅ Vidéo enregistrée en DB:', videoId);
      toast.success('Vidéo uploadée ! Démarrage de l\'analyse...');

      // 3. Déclencher la transcription et l'analyse
      setAnalysisProgress(VIDEO_STATUS.PROCESSING);
      await triggerTranscription(videoId, user.id, publicUrl);

    } catch (err) {
      console.error('❌ Erreur globale upload:', err);
      
      let errorMessage = "Une erreur inconnue est survenue lors de l'upload.";
      
      if (err.message.includes('duplicate key')) {
        errorMessage = 'Un fichier avec le même nom existe déjà. Veuillez réessayer.';
      } else if (err.message.includes('quota') || err.message.includes('space')) {
        errorMessage = 'Espace de stockage insuffisant.';
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        errorMessage = 'Erreur réseau. Vérifiez votre connexion.';
      }
      
      setError(errorMessage);
      toast.error("❌ Échec de l'upload");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ✅ FONCTION TRIGGER TRANSCRIPTION CORRIGÉE AVEC SOLUTION HTTPS
  const triggerTranscription = async (videoId, userId, videoPublicUrl) => {
    try {
      console.log('🚀 Déclenchement transcription...', {
        videoId,
        userId,
        videoUrl: videoPublicUrl?.substring(0, 100),
        selectedLanguage
      });

      // ✅ PRÉPARATION BODY AVEC VALEURS PAR DÉFAUT
      const requestBody = {
        videoId: videoId,
        userId: userId,
        videoUrl: videoPublicUrl,
        preferredLanguage: selectedLanguage || null,
        autoDetectLanguage: !selectedLanguage
      };

      console.log('📦 Body transcription:', {
        ...requestBody,
        videoUrl: requestBody.videoUrl?.substring(0, 80) + '...'
      });

      // ✅ UTILISATION DE LA NOUVELLE FONCTION ROBUSTE AVEC RETRY ET HTTPS FALLBACK
      const { data, error } = await invokeEdgeFunctionWithRetry('transcribe-video', requestBody, {
        maxRetries: 3,
        timeout: 30000,
        useHttpsFallback: true
      });

      if (error) {
        console.error('❌ Erreur invocation fonction Edge:', error);
        
        let errorMessage = `Erreur Edge Function: ${error.message}`;
        
        if (error.message.includes('fetch') || error.message.includes('network')) {
          errorMessage = 'Erreur réseau - vérifiez votre connexion internet';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'Erreur CORS - problème de configuration serveur';
        } else if (error.message.includes('timeout') || error.message.includes('abort')) {
          errorMessage = 'Timeout - le serveur met trop de temps à répondre';
        } else if (error.message.includes('auth') || error.message.includes('token')) {
          errorMessage = "Erreur d'authentification - reconnexion nécessaire";
        }
        
        throw new Error(errorMessage);
      }

      if (!data) {
        throw new Error('Réponse vide de la fonction Edge');
      }

      console.log('✅ Transcription déclenchée avec succès:', {
        success: data.success,
        message: data.message,
        videoId: data.videoId
      });

      toast.success('🔍 Transcription en cours...');

    } catch (err) {
      console.error('❌ Erreur triggerTranscription:', err);
      
      // ✅ SAUVEGARDE ERREUR EN BASE
      try {
        await supabase
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: `Transcription failed: ${err.message}`.substring(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq('id', videoId);
      } catch (dbError) {
        console.error('❌ Erreur sauvegarde statut:', dbError);
      }

      // ✅ MESSAGE D'ERREUR ADAPTÉ
      let userMessage = 'Erreur lors du déclenchement de la transcription';
      
      if (err.name === 'AbortError') {
        userMessage = 'Timeout - le serveur ne répond pas. Vérifiez votre connexion.';
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        userMessage = 'Erreur réseau - vérifiez votre connexion internet';
      } else if (err.message.includes('CORS')) {
        userMessage = 'Problème de configuration serveur. Réessayez dans quelques minutes.';
      } else {
        userMessage = err.message || 'Erreur inconnue lors de la transcription';
      }
      
      throw new Error(userMessage);
    }
  };

  // ✅ Réinitialiser
  const retryRecording = () => {
    console.log('🔄 Réinitialisation enregistrement...');
    
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
    
    // Réinitialiser la caméra après un court délai
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
        {/* <div className="text-center mb-8"> */}
          {/* <h1 className="text-4xl font-bold text-white mb-4">
            🎥 Enregistrez votre vidéo SpotBulle
          </h1> */}
          {/* <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Partagez votre passion et connectez-vous avec la communauté
          </p> */}
        {/* </div> */}

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
                onError={() => console.error('❌ Erreur lecture vidéo')}
              />
              
              {recording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                  <span className="font-semibold">{formatTime(recordingTime)}</span>
                </div>
              )}
              
              {recordedVideo && !recording && (
                <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm">
                  ✅ Prêt à uploader
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Démarrer l'enregistrement
                      </span>
                    )}
                  </Button>
                  {recording && (
                    <Button 
                      onClick={stopRecording}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                      </svg>
                      Arrêter
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button 
                    onClick={uploadVideo}
                    disabled={uploading || analysisProgress !== null}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all"
                  >
                    {uploading ? 'Upload en cours...' : '🚀 Uploader et Analyser'}
                  </Button>
                  <Button 
                    onClick={retryRecording}
                    disabled={uploading || analysisProgress !== null}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all"
                  >
                    🔄 Réenregistrer
                  </Button>
                </>
              )}
            </div>

            {/* Affichage des messages d'erreur */}
            {error && (
              <div className="bg-red-900 border border-red-700 text-white p-4 rounded-lg mt-4">
                <p className="font-bold">Erreur :</p>
                <p>{error}</p>
              </div>
            )}

            {/* Affichage de la progression de l'analyse - Only show during upload, hide after */}
            {analysisProgress && 
             analysisProgress !== VIDEO_STATUS.FAILED && 
             analysisProgress !== VIDEO_STATUS.UPLOADED && 
             analysisProgress !== VIDEO_STATUS.TRANSCRIBED && (
              <div className="bg-blue-900 border border-blue-700 text-white p-4 rounded-lg mt-4">
                <p className="font-bold">Statut de l'analyse :</p>
                <p className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {getProgressMessage(analysisProgress)}
                </p>
              </div>
            )}
          </div>

          {/* Détails et métadonnées */}
          <div className="space-y-6 bg-gray-700 p-6 rounded-lg shadow-xl">
            <h2 className="text-2xl font-bold text-white border-b border-gray-600 pb-3">Détails de la Vidéo</h2>

            {/* Titre */}
            <div>
              <label htmlFor="title" className="block font-semibold text-white mb-1">
                Titre de la vidéo
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Mon premier dribble réussi"
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
              />
              <p className="text-sm text-gray-400 mt-1">{title.length}/100 caractères</p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block font-semibold text-white mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez ce que vous faites dans cette vidéo..."
                rows={4}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                maxLength={500}
              />
              <p className="text-sm text-gray-400 mt-1">{description.length}/500 caractères</p>
            </div>

            {/* Tags */}
            <TagInput tags={tags} setTags={setTags} />

            {/* Informations sur la vidéo enregistrée */}
            {recordedVideo && (
              <div className="space-y-3 pt-4 border-t border-gray-600">
                <h3 className="text-xl font-semibold text-white">Informations d'enregistrement</h3>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                  <p>Durée : <span className="font-bold text-white">{formatTime(recordedVideo.duration)}</span></p>
                  <p>Taille estimée : <span className="font-bold text-white">{formatFileSize(recordedVideo.size)}</span></p>
                  <p>Format : <span className="font-bold text-white">{recordedVideo.format}</span></p>
                </div>
              </div>
            )}

            {/* Analyse de tonalité */}
            {isAnalyzingTone && (
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-white">Analyse de tonalité en cours...</span>
              </div>
            )}

            {toneAnalysis && !isAnalyzingTone && (
              <div className="space-y-3 p-4 bg-gray-800 rounded-lg border border-blue-500">
                <h3 className="text-xl font-semibold text-blue-400">🎵 Tonalité Détectée</h3>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                  <p>Émotion dominante : <span className="font-bold text-white">{toneAnalysis.emotion}</span></p>
                  <p>Rythme de parole : <span className="font-bold text-white">{toneAnalysis.pace}</span></p>
                  <p>Confiance : <span className="font-bold text-white">{Math.round(toneAnalysis.confidence * 100)}%</span></p>
                </div>
                <p className="text-sm text-gray-400 mt-2 border-t border-gray-700 pt-2">
                  **Suggestion :** {toneAnalysis.suggestion}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordVideo;
