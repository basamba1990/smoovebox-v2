// src/pages/enhanced-record-video.jsx - VERSION COMPLÈTEMENT CORRIGÉE
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced';
import { supabase } from '../lib/supabase';
import ProfessionalHeader from '../components/ProfessionalHeader';

const EnhancedRecordVideo = ({ user, profile, onSignOut, onVideoUploaded, cameraChecked }) => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useAvatar, setUseAvatar] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [toneAnalysis, setToneAnalysis] = useState(null);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120;
  const maxRetryCount = 3;

  // ✅ CORRECTION : Nettoyage robuste des ressources
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.warn);
      }
    };
  }, [recordedVideo]);

  // ✅ CORRECTION : Initialisation améliorée avec gestion d'erreur étendue
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Veuillez vous connecter pour enregistrer une vidéo.');
          navigate('/');
          return;
        }

        if (mounted) {
          await initializeCameraWithRetry();
        }
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setCameraError('Erreur lors de l\'initialisation de la caméra.');
          toast.error('Impossible d\'initialiser la caméra.');
        }
      }
    };

    if (cameraChecked) {
      initialize();
    }

    return () => {
      mounted = false;
    };
  }, [navigate, cameraChecked]);

  // ✅ NOUVELLE FONCTION : Initialisation avec système de reprise
  const initializeCameraWithRetry = async (retryAttempt = 0) => {
    try {
      setCameraError(null);
      await stopStream(); // Nettoyer les ressources existantes
      
      console.log(`🔄 Tentative d'initialisation caméra ${retryAttempt + 1}/${maxRetryCount}`);
      
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
      
      if (!stream) {
        throw new Error('Aucun flux média obtenu');
      }

      streamRef.current = stream;
      
      // ✅ CORRECTION : Attendre que l'élément vidéo soit prêt
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Attendre que les métadonnées soient chargées
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Élément vidéo non disponible'));
            return;
          }

          const onLoadedMetadata = () => {
            videoRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };

          const onError = () => {
            videoRef.current?.removeEventListener('error', onError);
            reject(new Error('Erreur de chargement des métadonnées vidéo'));
          };

          videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
          videoRef.current.addEventListener('error', onError);

          // Timeout de sécurité
          setTimeout(() => {
            if (videoRef.current?.readyState >= 1) {
              resolve();
            } else {
              reject(new Error('Timeout de chargement vidéo'));
            }
          }, 3000);
        });

        // ✅ CORRECTION : Forcer la lecture avec gestion d'erreur
        try {
          await videoRef.current.play();
          setCameraAccess(true);
          setCameraInitialized(true);
          setRetryCount(0);
          console.log('✅ Caméra initialisée avec succès');
          
          if (retryAttempt > 0) {
            toast.success('Caméra rétablie !');
          }
        } catch (playError) {
          console.error('❌ Erreur lecture vidéo:', playError);
          throw new Error(`Impossible de lire le flux vidéo: ${playError.message}`);
        }
      }

      setupAudioAnalysis(stream);
      
    } catch (err) {
      console.error(`❌ Échec initialisation caméra (tentative ${retryAttempt + 1}):`, err);
      
      if (retryAttempt < maxRetryCount - 1) {
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryAttempt + 1)));
        return initializeCameraWithRetry(retryAttempt + 1);
      } else {
        handleCameraError(err);
        throw err;
      }
    }
  };

  // ✅ CORRECTION : Gestion d'erreur caméra améliorée
  const handleCameraError = (error) => {
    let errorMessage = 'Erreur caméra inconnue';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'Aucune caméra détectée. Vérifiez votre connexion.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'La caméra est déjà utilisée par une autre application.';
    } else if (error.name === 'OverconstrainedError') {
      errorMessage = 'Les paramètres de caméra demandés ne sont pas disponibles.';
    } else {
      errorMessage = `Erreur caméra: ${error.message}`;
    }
    
    setCameraError(errorMessage);
    setCameraAccess(false);
    setCameraInitialized(false);
    
    toast.error('Problème de caméra détecté');
  };

  // ✅ CORRECTION : Arrêt robuste du stream
  const stopStream = () => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      } catch (err) {
        console.warn('⚠️ Erreur lors de l\'arrêt du stream:', err);
      }
    }
    setCameraAccess(false);
    setCameraInitialized(false);
  };

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
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [recording, maxRecordingTime]);

  // ✅ CORRECTION : Analyse audio avec gestion d'erreur
  const setupAudioAnalysis = (stream) => {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.warn('⚠️ AudioContext non supporté');
        return;
      }

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
        setAudioLevel(Math.min(average / 255, 1));
        
        // Analyse basique de la tonalité
        analyzeToneBasic(Math.min(average / 255, 1));
        
        requestAnimationFrame(analyzeAudio);
      };

      if (recording) {
        analyzeAudio();
      }
    } catch (err) {
      console.warn('⚠️ Analyse audio non disponible:', err);
    }
  };

  // ✅ CORRECTION : Démarrer l'enregistrement avec vérifications
  const startRecording = async () => {
    if (!cameraAccess || !cameraInitialized) {
      setCameraError('Caméra non disponible. Veuillez réinitialiser la caméra.');
      toast.error('Caméra non prête');
      await initializeCameraWithRetry();
      return;
    }

    if (!streamRef.current) {
      setError('Flux vidéo non disponible.');
      toast.error('Erreur de flux vidéo');
      return;
    }

    setCountdown(3);
    
    // Compte à rebours visuel
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setCountdown(0);
    setRecording(true);
    setRecordingTime(0);
    recordedChunksRef.current = [];

    try {
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000
      };

      // Vérifier la compatibilité MIME type
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
      }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({
          blob,
          url,
          duration: recordingTime
        });
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('❌ Erreur MediaRecorder:', event);
        setError('Erreur lors de l\'enregistrement vidéo');
        setRecording(false);
        toast.error('Erreur enregistrement');
      };

      mediaRecorderRef.current.start(1000); // Collecte des données chaque seconde
      toast.success('🎥 Enregistrement démarré !');

    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      setError(`Erreur démarrage enregistrement: ${err.message}`);
      setRecording(false);
      toast.error('Échec démarrage enregistrement');
    }
  };

  // ✅ CORRECTION : Arrêt de l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording && mediaRecorderRef.current.state !== 'inactive') {
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

  // ✅ CORRECTION : Upload avec gestion d'erreur améliorée
  const uploadVideo = async () => {
    if (!recordedVideo) {
      setError('Aucune vidéo à uploader.');
      toast.error('Enregistrez d\'abord une vidéo');
      return;
    }

    if (!user) {
      setError('Utilisateur non connecté.');
      toast.error('Reconnectez-vous');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const fileExt = 'webm';
      const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
      
      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, recordedVideo.blob);

      if (uploadError) throw uploadError;

      // Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Créer l'entrée dans la base de données
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
          storage_path: fileName
        })
        .select()
        .single();

      if (videoError) throw videoError;

      setUploadedVideoId(videoData.id);
      toast.success('📤 Vidéo uploadée avec succès !');
      
      if (onVideoUploaded) {
        onVideoUploaded();
      }
      
      navigate(`/video-success?id=${videoData.id}`);

    } catch (err) {
      console.error('❌ Erreur upload:', err);
      setError(`Erreur upload: ${err.message}`);
      toast.error('Échec de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  // ✅ CORRECTION : Réessayer l'enregistrement
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
    initializeCameraWithRetry().catch(console.error);
  };

  // ✅ CORRECTION : Réinitialisation manuelle de la caméra
  const resetCamera = async () => {
    setCameraError(null);
    await initializeCameraWithRetry();
  };

  const analyzeToneBasic = (volume) => {
    const pace = volume > 0.7 ? 'rapide' : volume > 0.4 ? 'modéré' : 'lent';
    const emotion = volume > 0.7 ? 'énergique' : volume > 0.4 ? 'neutre' : 'calme';
    const clarity = volume > 0.6 ? 'excellente' : volume > 0.3 ? 'bonne' : 'à améliorer';
    
    const suggestions = [];
    if (volume < 0.3) suggestions.push("Parlez plus fort pour plus d'impact");
    if (volume > 0.8) suggestions.push("Diminuez légèrement le volume");
    if (pace === 'lent') suggestions.push("Accélérez légèrement le rythme");

    setToneAnalysis({
      confidence: Math.min(volume * 1.5, 1),
      emotion,
      pace,
      clarity,
      suggestions: suggestions.slice(0, 2) // Limiter à 2 suggestions
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* En-tête */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-french font-bold text-gray-900 mb-4">
              🎥 Exprimez Votre Passion
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Partagez ce qui vous anime avec la communauté France-Maroc
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonne de gauche - Options et analyse */}
            <div className="space-y-6">
              {/* Options d'avatar */}
              <div className="card-spotbulle p-6">
                <h3 className="text-lg font-semibold mb-4">🛠️ Options</h3>
                
                <div className="mb-6">
                  <label className="flex items-center justify-between cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div>
                      <div className="font-medium">Utiliser un avatar</div>
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

                {/* Analyse de tonalité */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                  <h4 className="font-semibold text-purple-800 mb-3">🎵 Analyse en Direct</h4>
                  
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
                    
                    {toneAnalysis && (
                      <>
                        <div className="text-sm">
                          <div><strong>Émotion :</strong> {toneAnalysis.emotion}</div>
                          <div><strong>Débit :</strong> {toneAnalysis.pace}</div>
                          <div><strong>Clarté :</strong> {toneAnalysis.clarity}</div>
                        </div>

                        {toneAnalysis.suggestions.length > 0 && (
                          <div className="text-xs text-purple-700">
                            <strong>Suggestions :</strong>
                            <ul className="mt-1 space-y-1">
                              {toneAnalysis.suggestions.map((suggestion, index) => (
                                <li key={index}>• {suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Mots-clés */}
              <div className="card-spotbulle p-6">
                <h3 className="text-lg font-semibold mb-4">🏷️ Mots-clés</h3>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ex: football, passion, communauté..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={recording}
                />
                <p className="text-sm text-gray-600 mt-2">
                  Séparez par des virgules pour une meilleure découverte
                </p>
              </div>
            </div>

            {/* Colonne principale - Caméra et contrôles */}
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
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('❌ Erreur élément vidéo:', e);
                            setCameraError('Erreur de flux vidéo');
                          }}
                        />
                        {/* Overlay de statut */}
                        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          ✅ Caméra active
                        </div>
                      </>
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
                        <div className="text-center p-8">
                          <div className="text-6xl mb-4">📷</div>
                          <p className="text-xl font-semibold mb-2">Caméra non disponible</p>
                          <p className="text-gray-300 mb-4">
                            {cameraError || 'Initialisation en cours...'}
                          </p>
                          <Button
                            onClick={resetCamera}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
                          >
                            🔄 Réinitialiser la caméra
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Indicateur d'enregistrement */}
                    {recording && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full flex items-center space-x-2 animate-pulse">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                        <span className="font-semibold">⏺️ {formatTime(recordingTime)}</span>
                      </div>
                    )}
                  </div>

                  {/* Message d'erreur caméra */}
                  {cameraError && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-yellow-800 font-semibold">Problème de caméra</p>
                          <p className="text-yellow-700 text-sm mt-1">{cameraError}</p>
                        </div>
                        <Button
                          onClick={resetCamera}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
                        >
                          🔄 Réessayer
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Boutons de contrôle principaux */}
                <div className="flex gap-3 flex-wrap">
                  {!recordedVideo && !recording && (
                    <Button
                      onClick={startRecording}
                      disabled={!cameraAccess || countdown > 0}
                      className="btn-spotbulle flex-1 min-w-[200px]"
                    >
                      {!cameraAccess ? '📷 Initialisation...' : '🎤 Commencer l\'enregistrement'}
                    </Button>
                  )}

                  {recording && (
                    <Button
                      onClick={stopRecording}
                      className="bg-red-500 hover:bg-red-600 text-white flex-1 min-w-[200px]"
                    >
                      ⏹️ Arrêter l'enregistrement
                    </Button>
                  )}

                  {recordedVideo && !uploading && (
                    <>
                      <Button
                        onClick={uploadVideo}
                        className="btn-spotbulle flex-1 min-w-[140px]"
                      >
                        📤 Uploader la vidéo
                      </Button>
                      <Button
                        onClick={retryRecording}
                        variant="outline"
                        className="flex-1 min-w-[140px]"
                      >
                        🔄 Nouvel enregistrement
                      </Button>
                    </>
                  )}

                  {uploading && (
                    <Button disabled className="flex-1 min-w-[200px]">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Upload en cours...
                    </Button>
                  )}

                  {/* Bouton de réinitialisation caméra */}
                  {cameraAccess && !recording && (
                    <Button
                      onClick={resetCamera}
                      variant="outline"
                      className="border-blue-500 text-blue-600"
                    >
                      🔄 Caméra
                    </Button>
                  )}
                </div>

                {/* Message d'erreur général */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4">
                    <div className="flex justify-between items-center">
                      <p>{error}</p>
                      <Button
                        onClick={() => setError(null)}
                        variant="outline"
                        size="sm"
                        className="border-red-300 text-red-600"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-2">💡 Conseils pour un bon enregistrement</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Éclairage</strong> : Face à une source de lumière naturelle</li>
                  <li>• <strong>Stabilité</strong> : Posez votre appareil sur une surface stable</li>
                  <li>• <strong>Cadre</strong> : Positionnez-vous au centre de l'image</li>
                  <li>• <strong>Audio</strong> : Évitez les environnements bruyants</li>
                  <li>• <strong>Durée</strong> : 2 minutes maximum pour plus d'impact</li>
                </ul>
              </div>

              {/* Informations de débogage (développement seulement) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">🐛 Informations de débogage</h3>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Caméra: {cameraAccess ? '✅ Connectée' : '❌ Non connectée'}</div>
                    <div>Initialisée: {cameraInitialized ? '✅' : '❌'}</div>
                    <div>Enregistrement: {recording ? '✅ En cours' : '❌ Arrêté'}</div>
                    <div>Tentatives: {retryCount}</div>
                    {cameraError && <div>Erreur: {cameraError}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedRecordVideo;
