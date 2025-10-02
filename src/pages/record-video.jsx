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
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120; // 2 minutes

  // Nettoyage des ressources à la destruction du composant
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

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Veuillez vous connecter pour enregistrer une vidéo.');
          navigate('/');
          return;
        }

        await refreshSession();
        await requestCameraAccess();
      } catch (err) {
        console.error('Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
          toast.error('Impossible d\'accéder à la caméra.');
        }
      }
    };

    init();

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

  // Suivi de la progression de l'analyse
  useEffect(() => {
    if (!uploadedVideoId) return;

    const checkAnalysisProgress = async () => {
      try {
        const { data: video, error } = await supabase
          .from('videos')
          .select('*')
          .eq('id', uploadedVideoId)
          .single();

        if (error) throw error;

        if (video.status === VIDEO_STATUS.ANALYZED || video.status === VIDEO_STATUS.PUBLISHED) {
          setAnalysisProgress(null);
          toast.success('Analyse terminée !');
          onVideoUploaded();
          navigate('/video-success', { state: { videoId: uploadedVideoId } });
        } else if (video.status === VIDEO_STATUS.FAILED) {
          setAnalysisProgress(null);
          toast.error('Erreur lors de l\'analyse de la vidéo.');
        } else {
          // Mettre à jour la progression
          const progressStages = {
            [VIDEO_STATUS.UPLOADED]: 20,
            [VIDEO_STATUS.PROCESSING]: 40,
            [VIDEO_STATUS.TRANSCRIBED]: 60,
            [VIDEO_STATUS.ANALYZING]: 80,
            [VIDEO_STATUS.ANALYZED]: 100
          };
          
          setAnalysisProgress({
            status: video.status,
            progress: progressStages[video.status] || 0,
            message: getProgressMessage(video.status)
          });

          // Vérifier à nouveau dans 2 secondes
          setTimeout(() => checkAnalysisProgress(), 2000);
        }
      } catch (err) {
        console.error('Erreur vérification progression:', err);
      }
    };

    checkAnalysisProgress();
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
        setAudioLevel(average / 255); // Normaliser entre 0 et 1
        
        if (recording) {
          requestAnimationFrame(analyzeAudio);
        }
      };

      analyzeAudio();
    } catch (err) {
      console.warn('Analyse audio non disponible:', err);
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
      console.error('Erreur accès caméra:', err);
      setError('Impossible d\'accéder à la caméra ou au microphone.');
      toast.error('Veuillez autoriser l\'accès à la caméra et au microphone.');
    }
  };

  // Démarrer l'enregistrement avec compte à rebours
  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
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
    recordedChunksRef.current = [];

    try {
      const stream = streamRef.current;
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000
      };

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      
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

      mediaRecorderRef.current.start(1000); // Collecte des données chaque seconde
      toast.success('Enregistrement démarré !');

    } catch (err) {
      console.error('Erreur démarrage enregistrement:', err);
      setError('Erreur lors du démarrage de l\'enregistrement.');
      setRecording(false);
    }
  };

  // Arrêter l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('Enregistrement terminé !');
      
      // Analyser la tonalité basique
      analyzeToneBasic();
    }
  };

  // Analyse basique de la tonalité (exemple simplifié)
  const analyzeToneBasic = () => {
    // Dans une vraie implémentation, cela analyserait l'audio
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

  // Uploader la vidéo et déclencher la transcription
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
          status: VIDEO_STATUS.UPLOADED,
          use_avatar: useAvatar,
          tone_analysis: toneAnalysis
        })
        .select()
        .single();

      if (videoError) throw videoError;

      setUploadedVideoId(videoData.id);
      toast.success('Vidéo uploadée avec succès !');
      
      // Déclencher la transcription
      await triggerTranscription(videoData.id, session.user.id, publicUrl);

    } catch (err) {
      console.error('Erreur upload:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      toast.error('Erreur lors de l\'upload de la vidéo.');
    } finally {
      setUploading(false);
    }
  };

  // Fonction pour déclencher la transcription
  const triggerTranscription = async (videoId, userId, videoUrl) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session non valide');

      const response = await fetch('/functions/transcribe-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          videoId,
          userId,
          videoUrl
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur transcription: ${response.statusText}`);
      }

      console.log('Transcription déclenchée avec succès');
    } catch (err) {
      console.error('Erreur déclenchement transcription:', err);
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

          {/* Options d'enregistrement */}
          <div className="flex gap-4 mb-6 justify-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAvatar}
                onChange={(e) => setUseAvatar(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Utiliser un avatar virtuel</span>
            </label>
          </div>

          {/* Compte à rebours */}
          {countdown > 0 && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="text-white text-8xl font-bold animate-pulse">
                {countdown}
              </div>
            </div>
          )}

          {/* Zone d'enregistrement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Caméra */}
            <div className="relative">
              <div className="bg-black rounded-lg overflow-hidden aspect-video">
                {cameraAccess && !recordedVideo && (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
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
                    <div className="text-center">
                      <div className="text-4xl mb-2">📹</div>
                      <p>Caméra initialisation...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Indicateur de niveau audio */}
              {recording && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black/50 rounded-full p-2">
                    <div 
                      className="h-2 bg-gradient-to-r from-green-400 to-red-500 rounded-full transition-all duration-100"
                      style={{ width: `${audioLevel * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Timer d'enregistrement */}
              {recording && (
                <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                  ⏺️ {formatTime(recordingTime)}
                </div>
              )}
            </div>

            {/* Contrôles et informations */}
            <div className="space-y-4">
              {/* Analyse de tonalité */}
              {toneAnalysis && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">🎵 Analyse de tonalité</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Émotion:</strong> {toneAnalysis.emotion}</div>
                    <div><strong>Débit:</strong> {toneAnalysis.pace}</div>
                    <div><strong>Clarté:</strong> {toneAnalysis.clarity}</div>
                    <div className="mt-2">
                      <strong>Suggestions:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {toneAnalysis.suggestions.map((suggestion, index) => (
                          <li key={index} className="text-blue-700">{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
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

              {/* Progression de l'analyse */}
              {analysisProgress && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-800 font-medium">{analysisProgress.message}</span>
                    <span className="text-green-600">{analysisProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${analysisProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Boutons de contrôle */}
              <div className="flex gap-3 flex-wrap">
                {!recordedVideo && !recording && (
                  <Button
                    onClick={startRecording}
                    disabled={!cameraAccess || countdown > 0}
                    className="btn-spotbulle flex-1"
                  >
                    🎤 Commencer l'enregistrement
                  </Button>
                )}

                {recording && (
                  <Button
                    onClick={stopRecording}
                    className="bg-red-500 hover:bg-red-600 text-white flex-1"
                  >
                    ⏹️ Arrêter l'enregistrement
                  </Button>
                )}

                {recordedVideo && !uploading && !analysisProgress && (
                  <>
                    <Button
                      onClick={uploadVideo}
                      className="btn-spotbulle flex-1"
                    >
                      📤 Uploader la vidéo
                    </Button>
                    <Button
                      onClick={retryRecording}
                      variant="outline"
                      className="flex-1"
                    >
                      🔄 Réessayer
                    </Button>
                  </>
                )}

                {uploading && (
                  <Button disabled className="flex-1">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Upload en cours...
                  </Button>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">💡 Conseils pour un bon enregistrement</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Parlez clairement et à un rythme modéré</li>
              <li>• Utilisez un fond neutre et un bon éclairage</li>
              <li>• Souriez et soyez naturel</li>
              <li>• 2 minutes maximum pour garder l'attention</li>
              <li>• Ajoutez des mots-clés pertinents pour être mieux découvert</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordVideo;
