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
  const [title, setTitle] = useState('Ma vidéo SpotBulle');  // Ajout titre par défaut

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

    const initCamera = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Veuillez vous connecter pour enregistrer une vidéo.');
          navigate('/login');
          return;
        }

        await requestCameraAccess();
        if (mounted) setCameraAccess(true);
      } catch (err) {
        console.error('Erreur init caméra:', err);
        setError('Impossible d\'accéder à la caméra/micro.');
      }
    };

    initCamera();

    return () => { mounted = false; };
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

    const checkProgress = async () => {
      try {
        const { data: video } = await supabase
          .from('videos')
          .select('status')
          .eq('id', uploadedVideoId)
          .single();

        if (video) {
          setAnalysisProgress(video.status);
          const message = getProgressMessage(video.status);
          toast.info(message);

          if (video.status === VIDEO_STATUS.ANALYSED) {
            toast.success('Analyse terminée !');
            onVideoUploaded();
            navigate('/dashboard');
          } else if (video.status === VIDEO_STATUS.FAILED) {
            toast.error('Erreur lors du traitement.');
          }
        }
      } catch (err) {
        console.error('Erreur check progress:', err);
      }
    };

    const interval = setInterval(checkProgress, 5000);
    return () => clearInterval(interval);
  }, [uploadedVideoId, navigate, onVideoUploaded]);

  const getProgressMessage = (status) => {
    const messages = {
      [VIDEO_STATUS.UPLOADED]: 'Vidéo téléchargée',
      [VIDEO_STATUS.PROCESSING]: 'Traitement de la vidéo',
      [VIDEO_STATUS.TRANSCRIBED]: 'Transcription en cours',
      [VIDEO_STATUS.ANALYZING]: 'Analyse du contenu et de la tonalité',
      [VIDEO_STATUS.ANALYSED]: 'Analyse terminée'
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

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
        }
        requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();
    } catch (err) {
      console.error('Erreur audio analysis:', err);
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setupAudioAnalysis(stream);
      setCameraAccess(true);
      setError(null);
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      setError('Accès caméra/micro refusé. Vérifiez les permissions.');
      toast.error('Accès caméra requis.');
    }
  };

  // Démarrer l'enregistrement avec compte à rebours
  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
      return;
    }

    // Compte à rebours
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Démarrer enregistrement réel
          recordedChunksRef.current = [];
          const options = { mimeType: 'video/webm;codecs=vp9' };
          mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunksRef.current.push(event.data);
          };
          mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setRecordedVideo({ blob, url, size: blob.size });
            analyzeToneBasic();  // Analyse basique post-enregistrement
          };
          mediaRecorderRef.current.start();
          setRecording(true);
          setCountdown(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Arrêter l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('Enregistrement terminé !');
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
      // 1. Upload fichier vers storage (génère storage_path non NULL)
      const fileName = `${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(`${supabase.auth.getUser().data.user.id}/${fileName}`, recordedVideo.blob, {
          upsert: true,
          contentType: 'video/webm'
        });

      if (uploadError) throw uploadError;

      const storagePath = uploadData.path;  // Chemin non NULL
      const publicUrl = supabase.storage.from('videos').getPublicUrl(storagePath).data.publicUrl;

      // 2. Insert en DB avec storage_path
      const { data: videoData, error: insertError } = await supabase
        .from('videos')
        .insert({
          user_id: supabase.auth.getUser().data.user.id,
          title: title || 'Sans titre',
          description: 'Vidéo enregistrée via SpotBulle',  // À rendre éditable
          file_path: storagePath,
          storage_path: storagePath,  // Double pour compatibilité
          status: VIDEO_STATUS.UPLOADED,
          duration: Math.round(recordedVideoTime / 1000),  // À calculer si needed
          use_avatar: useAvatar,
          tone_analysis: toneAnalysis || null,
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
          public_url: publicUrl,
          transcription_text: '',  // À remplir post-transcription
          file_size: recordedVideo.size,
          format: 'webm'
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      setUploadedVideoId(videoData.id);
      toast.success('Vidéo uploadée ! Transcription en cours...');
      onVideoUploaded();

      // 3. Déclencher transcription
      await triggerTranscription(videoData.id, supabase.auth.getUser().data.user.id, publicUrl);

    } catch (err) {
      console.error('Erreur upload:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      toast.error(`Erreur upload: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Fonction pour déclencher la transcription
  const triggerTranscription = async (videoId, userId, videoUrl) => {
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { videoId, userId, videoUrl }
      });

      if (error) throw error;
      console.log('✅ Transcription déclenchée:', data);
    } catch (err) {
      console.error('Erreur transcription:', err);
      toast.error('Erreur déclenchement transcription.');
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

          {/* Vidéo preview */}
          <div className="mb-6">
            <video
              ref={videoRef}
              className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              autoPlay
              muted
              playsInline
            />
            {recording && (
              <div className="text-center mt-2">
                <div className="text-red-500 text-xl font-bold">● Enregistrement</div>
                <div className="text-sm text-gray-600">Temps: {formatTime(recordingTime)}</div>
              </div>
            )}
            {countdown > 0 && <div className="text-center text-4xl font-bold text-blue-600">{countdown}</div>}
          </div>

          {/* Contrôles enregistrement */}
          <div className="flex justify-center gap-4 mb-6">
            {!recording && !recordedVideo ? (
              <Button onClick={startRecording} disabled={!cameraAccess || countdown > 0} className="btn-spotbulle">
                {countdown > 0 ? 'Prêt...' : '🎬 Démarrer'}
              </Button>
            ) : !uploading && recordedVideo ? (
              <Button onClick={uploadVideo} disabled={uploading} className="btn-spotbulle">
                📤 Uploader la vidéo
              </Button>
            ) : null}
            {recording && (
              <Button onClick={stopRecording} variant="destructive" className="btn-spotbulle">
                ⏹️ Arrêter
              </Button>
            )}
            <Button onClick={retryRecording} variant="outline">
              🔄 Réessayer
            </Button>
          </div>

          {/* Formulaires */}
          {!recordedVideo && !uploading && (
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Titre</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Mon premier message SpotBulle"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mots-clés (séparés par des virgules)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="football, passion, communauté"
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useAvatar}
                    onChange={(e) => setUseAvatar(e.target.checked)}
                  />
                  Utiliser un avatar virtuel
                </label>
              </div>
            </div>
          )}

          {/* Analyse tonale preview */}
          {toneAnalysis && (
            <div className="bg-green-50 p-4 rounded mb-6">
              <h3 className="font-medium mb-2">🎵 Analyse de tonalité</h3>
              <p><strong>Émotion:</strong> {toneAnalysis.emotion}</p>
              <p><strong>Débit:</strong> {toneAnalysis.pace}</p>
              <p><strong>Clarté:</strong> {toneAnalysis.clarity}</p>
              <ul className="mt-2 space-y-1">
                {toneAnalysis.suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-green-700">• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Progression analyse */}
          {analysisProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
              <p className="text-blue-800"><strong>{getProgressMessage(analysisProgress)}</strong></p>
            </div>
          )}

          {/* Conseils */}
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mt-6">
            <h3 className="font-medium mb-2">💡 Conseils pour un bon enregistrement</h3>
            <ul className="space-y-1 text-sm text-yellow-800">
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
