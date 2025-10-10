import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';

// Valeurs exactes autorisées pour le statut dans la base de données
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
};

const RecordVideo = ({ onVideoUploaded = () => {} }) => {
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
  const [user, setUser] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120;

  // ✅ CORRECTION : Fonction pour détecter iOS et choisir le format adapté
  const getSupportedMimeType = () => {
    // Détection iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Formats prioritaires pour iOS
      if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1.42E01E')) {
        return 'video/mp4; codecs=avc1.42E01E';
      }
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        return 'video/mp4';
      }
    }
    
    // Formats pour autres navigateurs
    const types = [
      'video/webm; codecs=vp9',
      'video/webm; codecs=vp8', 
      'video/webm'
    ];
    
    return types.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
  };

  // Nettoyage des ressources
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [recordedVideo]);

  // Vérification de l'authentification et initialisation de la caméra
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
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Gestion du minuteur d'enregistrement
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

  // ✅ CORRIGÉ : Suivi de la progression avec redirection vers video-success
  useEffect(() => {
    if (!uploadedVideoId) return;

    let intervalId;

    const checkProgress = async () => {
      try {
        const { data: video, error } = await supabase
          .from('videos')
          .select('status, analysis, ai_result')
          .eq('id', uploadedVideoId)
          .single();

        if (error) throw error;

        if (video.status === VIDEO_STATUS.ANALYZED) {
          setAnalysisProgress(VIDEO_STATUS.ANALYZED);
          toast.success('Analyse terminée avec succès !');
          clearInterval(intervalId);
          onVideoUploaded();
          
          // ✅ CORRECTION : Redirection vers video-success au lieu de dashboard
          navigate(`/video-success?id=${uploadedVideoId}`);
          
        } else if (video.status === VIDEO_STATUS.FAILED) {
          setAnalysisProgress(VIDEO_STATUS.FAILED);
          setError('L\'analyse de la vidéo a échoué.');
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
      [VIDEO_STATUS.ANALYZING]: 'Analyse du contenu et de la tonalité',
      [VIDEO_STATUS.ANALYZED]: 'Analyse terminée'
    };
    return messages[status] || 'Traitement en cours';
  };

  // Arrêter le stream vidéo/audio
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Analyser le niveau audio en temps réel
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
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average / 256);

        requestAnimationFrame(analyzeAudio);
      };

      analyzeAudio();
    } catch (err) {
      console.warn('⚠️ Analyse audio non supportée:', err);
    }
  };

  // Demander l'accès à la caméra/micro
  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: 'user'
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
      setCameraAccess(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setupAudioAnalysis(stream);
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      toast.error('Accès caméra refusé.');
    }
  };

  // ✅ CORRIGÉ : Démarrer l'enregistrement avec support iOS
  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
      return;
    }

    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCountdown(i - 1);
    }

    try {
      recordedChunksRef.current = [];
      
      // ✅ UTILISATION du format détecté
      const mimeType = getSupportedMimeType();
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      console.log('🎥 Format vidéo sélectionné:', mimeType, 'iOS:', isIOS);

      // ✅ Vérification finale du support
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`Format non supporté: ${mimeType}. Utilisez un navigateur plus récent.`);
      }

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: isIOS ? 2000000 : 2500000 // Bitrate réduit pour iOS
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({
          url,
          blob,
          duration: recordingTime,
          mimeType // ✅ Stockage pour l'upload
        });
        analyzeToneBasic();
        
        // ✅ Message spécifique iOS
        if (isIOS) {
          toast.success('Vidéo enregistrée en format compatible iPhone');
        }
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setRecordingTime(0);
      toast.success('Enregistrement démarré !');
      
    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      
      let errorMsg = "Erreur lors du démarrage de l'enregistrement.";
      if (err.message.includes('non supporté')) {
        errorMsg = "Votre iPhone ne supporte pas l'enregistrement vidéo dans ce navigateur. Essayez Safari ou une application native.";
      }
      
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  // Arrêter l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('Enregistrement terminé !');
    }
  };

  // Analyse basique de la tonalité
  const analyzeToneBasic = () => {
    const mockToneAnalysis = {
      confidence: 0.85,
      emotion: 'enthousiaste',
      pace: 'modéré',
      clarity: 'bonne',
      suggestions: [
        'Excellent enthousiasme !',
        'Le débit est bien équilibré',
        'Continuez à sourire pour maintenir l\'énergie'
      ]
    };
    setToneAnalysis(mockToneAnalysis);
  };

  // ✅ CORRIGÉ : Uploader la vidéo avec gestion iOS
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

      // 1. Upload avec le bon content-type
      const fileExtension = recordedVideo.mimeType?.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `video-${Date.now()}.${fileExtension}`;
      const filePath = `${user.id}/${fileName}`;

      console.log('📤 Upload avec type:', recordedVideo.mimeType);

      // ✅ VÉRIFICATION CRITIQUE : S'assurer que filePath n'est pas null
      if (!filePath || filePath.trim() === '') {
        throw new Error('Le chemin de stockage ne peut pas être vide');
      }

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, recordedVideo.blob, {
          contentType: recordedVideo.mimeType || 'video/webm' // ✅ Content-Type explicite
        });

      if (uploadError) {
        // ✅ Gestion spécifique des erreurs MIME type 
        if (uploadError.message.includes('Mime type') || uploadError.message.includes('invalid_mime_type')) {
          throw new Error(`Type de fichier refusé: ${recordedVideo.mimeType}. Contactez l'administrateur.`);
        }
        throw new Error(`Erreur upload storage: ${uploadError.message}`);
      }

      console.log('✅ Fichier uploadé avec succès');

      // 2. Récupérer l'URL publique COMPLÈTE
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // ✅ CORRECTION : Structure de données compatible avec la base de données
      const videoInsertData = {
        title: `Vidéo ${new Date().toLocaleDateString('fr-FR')}`,
        description: 'Vidéo enregistrée depuis la caméra',
        // ✅ CHAMPS CRITIQUES : S'assurer que storage_path et file_path sont bien définis
        file_path: filePath,
        storage_path: filePath,
        file_size: recordedVideo.blob.size,
        duration: Math.round(recordingTime),
        user_id: user.id,
        status: VIDEO_STATUS.UPLOADED,
        use_avatar: useAvatar,
        public_url: urlData.publicUrl,
        // ✅ Champ supplémentaire pour compatibilité
        video_url: urlData.publicUrl,
        format: recordedVideo.mimeType ? recordedVideo.mimeType.split('/')[1] : 'webm', // ✅ Format dynamique
        tone_analysis: toneAnalysis,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        // ✅ Champs requis par la base de données
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📝 Données à insérer:', videoInsertData);

      // 3. Insérer la vidéo avec TOUS les champs requis
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert(videoInsertData)
        .select()
        .single();

      if (videoError) {
        console.error('❌ Erreur insertion vidéo:', videoError);
        
        // ✅ Gestion spécifique de l'erreur de chemin NULL
        if (videoError.message.includes('stockage') || videoError.message.includes('NULL')) {
          throw new Error('Erreur de configuration du chemin de stockage. Veuillez réessayer.');
        }
        
        throw new Error(`Erreur création vidéo: ${videoError.message}`);
      }

      console.log('✅ Vidéo créée en base:', videoData.id);
      setUploadedVideoId(videoData.id);
      toast.success('Vidéo uploadée avec succès !');

      // ✅ CORRIGÉ : Envoyer l'URL publique complète à la transcription
      await triggerTranscription(videoData.id, user.id, urlData.publicUrl);

    } catch (err) {
      console.error('❌ Erreur upload:', err);
      
      // ✅ Gestion d'erreur améliorée
      let errorMessage = `Erreur lors de l'upload: ${err.message}`;
      if (err.message.includes('non supporté') || err.message.includes('format')) {
        errorMessage = 'Format vidéo non compatible avec votre appareil. Réessayez sur un autre device.';
      } else if (err.message.includes('stockage') || err.message.includes('NULL')) {
        errorMessage = 'Erreur de configuration du stockage. Le chemin de la vidéo est invalide.';
      }
      
      setError(errorMessage);
      toast.error('Échec de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  // ✅ CORRIGÉ : Fonction pour déclencher la transcription avec URL valide
  const triggerTranscription = async (videoId, userId, videoPublicUrl) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session non valide');

      console.log('🚀 Déclenchement transcription avec URL:', videoPublicUrl);

      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: {
          videoId,
          userId,
          videoUrl: videoPublicUrl // ✅ URL publique complète
        }
      });

      if (error) throw error;

      console.log('✅ Transcription lancée:', data);
      toast.success('Transcription en cours...');
    } catch (err) {
      console.error('❌ Erreur triggerTranscription:', err);
      throw err;
    }
  };

  // Réinitialiser l'enregistrement
  const retryRecording = () => {
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    setRecordedVideo(null);
    setError(null);
    setAnalysisProgress(null);
    setUploadedVideoId(null);
    setRecordingTime(0);
    setTags('');
    setToneAnalysis(null);
    setAudioLevel(0);
    stopStream();
    requestCameraAccess();
  };

  // Formater le temps d'enregistrement
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="card-spotbulle p-6">
          <h1 className="text-3xl font-french font-bold mb-2 text-center">
            🎥 Enregistrez votre vidéo SpotBulle
          </h1>
          <p className="text-gray-600 text-center mb-6">
            Partagez votre passion et connectez-vous avec la communauté
          </p>

          {/* Interface d'enregistrement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Caméra et contrôles */}
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                    <div className="text-white text-6xl font-bold">{countdown}</div>
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
                  <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="font-semibold">{formatTime(recordingTime)}</span>
                  </div>
                )}
              </div>

              {/* Barre de niveau audio */}
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                ></div>
              </div>

              {/* Contrôles d'enregistrement */}
              <div className="flex gap-4 justify-center">
                {!recordedVideo ? (
                  <>
                    <Button
                      onClick={startRecording}
                      disabled={recording || !cameraAccess || countdown > 0}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {recording ? '🔄 Enregistrement...' : '● Commencer'}
                    </Button>
                    {recording && (
                      <Button
                        onClick={stopRecording}
                        className="bg-gray-600 hover:bg-gray-700 text-white"
                      >
                        ■ Arrêter
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="flex gap-4">
                    <Button
                      onClick={uploadVideo}
                      disabled={uploading}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {uploading ? '📤 Upload...' : '📤 Uploader la vidéo'}
                    </Button>
                    <Button
                      onClick={retryRecording}
                      variant="outline"
                    >
                      🔄 Réessayer
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Paramètres et analyse */}
            <div className="space-y-6">
              {/* Option avatar */}
              <div className="card-spotbulle p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAvatar}
                    onChange={(e) => setUseAvatar(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium">Utiliser un avatar virtuel</span>
                </label>
              </div>

              {/* Analyse de tonalité */}
              {toneAnalysis && (
                <div className="card-spotbulle p-4">
                  <h3 className="font-semibold mb-3">🎵 Analyse de tonalité</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Émotion:</strong> {toneAnalysis.emotion}</div>
                    <div><strong>Débit:</strong> {toneAnalysis.pace}</div>
                    <div><strong>Clarté:</strong> {toneAnalysis.clarity}</div>
                    <div className="mt-3">
                      <strong>Suggestions:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {toneAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Mots-clés */}
              <div className="card-spotbulle p-4">
                <label className="block font-semibold mb-2">
                  Mots-clés (séparés par des virgules)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="football, sport, passion..."
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Progression de l'analyse */}
              {analysisProgress && (
                <div className="card-spotbulle p-4">
                  <h3 className="font-semibold mb-2">📊 Progression</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{getProgressMessage(analysisProgress)}</span>
                      <span>{analysisProgress === VIDEO_STATUS.ANALYZED ? '✅' : '🔄'}</span>
                    </div>
                    {analysisProgress === VIDEO_STATUS.FAILED && (
                      <p className="text-red-600 text-sm">{error}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Message d'erreur */}
              {error && !analysisProgress && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Conseils */}
          <div className="mt-8 card-spotbulle p-4">
            <h3 className="font-semibold mb-3">💡 Conseils pour un bon enregistrement</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>Parlez clairement et à un rythme modéré</li>
              <li>Utilisez un fond neutre et un bon éclairage</li>
              <li>Souriez et soyez naturel</li>
              <li>2 minutes maximum pour garder l'attention</li>
              <li>Ajoutez des mots-clés pertinents pour être mieux découvert</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordVideo;
