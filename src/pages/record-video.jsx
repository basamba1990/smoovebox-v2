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

const RecordVideo = () => {
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
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120; // 2 minutes

  // Nettoyage des ressources à la destruction du composant
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
      stopStream();
    };
  }, [recordedVideo]);

  // Vérification de l'authentification et initialisation de la caméra
  useEffect(() => {
    let mounted = true;

    const checkAuthAndInitCamera = async () => {
      if (!mounted) return;

      const isSessionValid = await refreshSession();
      if (!isSessionValid) {
        toast.error('Veuillez vous connecter pour enregistrer une vidéo.');
        navigate('/login');
        return;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        toast.error('Utilisateur non authentifié.');
        navigate('/login');
        return;
      }

      try {
        await requestCameraAccess();
      } catch (err) {
        setError('Impossible d\'initialiser la caméra.');
        toast.error('Erreur d\'initialisation de la caméra.');
      }
    };

    checkAuthAndInitCamera();

    return () => {
      mounted = false;
      stopStream();
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

    const checkAnalysisStatus = async () => {
      try {
        const { data: video, error } = await supabase
          .from('videos')
          .select('status, error_message, transcription_data')
          .eq('id', uploadedVideoId)
          .single();

        if (error) throw error;

        switch (video.status) {
          case VIDEO_STATUS.UPLOADED:
            setAnalysisProgress('Vidéo uploadée, en attente...');
            break;
          case VIDEO_STATUS.PROCESSING:
            setAnalysisProgress('Transcription en cours...');
            break;
          case VIDEO_STATUS.TRANSCRIBED:
            setAnalysisProgress('Analyse IA en cours...');
            // Afficher un aperçu de la transcription si disponible
            if (video.transcription_data?.text) {
              const preview = video.transcription_data.text.substring(0, 100) + '...';
              toast.info(`Transcription: ${preview}`);
            }
            break;
          case VIDEO_STATUS.ANALYZING:
            setAnalysisProgress('Analyse approfondie...');
            break;
          case VIDEO_STATUS.ANALYZED:
            setAnalysisProgress('Analyse terminée !');
            toast.success('Votre vidéo a été analysée avec succès !');
            setTimeout(() => {
              navigate(`/video-success?id=${uploadedVideoId}`);
            }, 2000);
            break;
          case VIDEO_STATUS.FAILED:
            setAnalysisProgress(`Erreur: ${video.error_message || 'Échec de l\'analyse'}`);
            toast.error('Erreur lors de l\'analyse de la vidéo.');
            break;
          default:
            setAnalysisProgress('En attente de traitement...');
        }
      } catch (error) {
        console.error('Erreur vérification statut:', error);
        setAnalysisProgress('Erreur lors du suivi de l\'analyse.');
      }
    };

    const interval = setInterval(checkAnalysisStatus, 3000);
    return () => clearInterval(interval);
  }, [uploadedVideoId, navigate]);

  // Arrêter le stream vidéo/audio
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraAccess(false);
    }
  };

  // Demander l'accès à la caméra/micro
  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraAccess(true);
        toast.success('Accès à la caméra/micro autorisé.');
      }
    } catch (err) {
      setError('Impossible d\'accéder à la caméra ou au microphone.');
      toast.error('Erreur d\'accès à la caméra/micro: ' + err.message);
      throw err;
    }
  };

  // Démarrer l'enregistrement
  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
      return;
    }

    setError(null);
    setCountdown(3);

    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((res) => setTimeout(res, 1000));
    }
    setCountdown(0);

    try {
      const stream = streamRef.current;
      if (!stream) throw new Error('Aucun flux média disponible');

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedVideo({ blob, url: URL.createObjectURL(blob) });
        setRecordingTime(0);
        recordedChunksRef.current = [];
        stopStream();
      };

      mediaRecorderRef.current.start(1000); // Enregistrer par morceaux de 1s
      setRecording(true);
      toast.success('Enregistrement en cours...');
    } catch (err) {
      setError('Impossible de démarrer l\'enregistrement: ' + err.message);
      toast.error('Erreur lors de l\'enregistrement: ' + err.message);
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

  // Fonction pour déclencher la transcription (CORRIGÉE : passage de l'URL signée)
  const triggerTranscription = async (videoId, userId, videoUrl) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session non valide');

      // Log sécurisé avant envoi
      console.log('Déclenchement transcription pour videoId:', videoId, 'avec URL signée valide.');

      // Appeler la fonction Edge de transcription avec l'URL signée
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          videoId: videoId,
          userId: userId,
          videoUrl: videoUrl // URL signée passée explicitement
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Échec de l'appel transcription: ${errorText}`);
      }

      const result = await response.json();
      console.log('Transcription démarrée:', result);
      return result;
    } catch (error) {
      console.error('Erreur lors du déclenchement de la transcription:', error);
      throw error;
    }
  };

  // Uploader la vidéo et déclencher la transcription (CORRIGÉE : utilisation de createSignedUrl)
  const uploadVideo = async () => {
    if (!recordedVideo) {
      setError('Vous devez enregistrer une vidéo.');
      toast.error('Aucune vidéo à uploader.');
      return;
    }

    setUploading(true);
    setError(null);
    setAnalysisProgress('Upload de la vidéo...');

    let localUploadedVideoId = null; // Variable locale pour gérer l'ID en cas d'erreur

    try {
      // 1. Vérifier l'authentification
      const isSessionValid = await refreshSession();
      if (!isSessionValid) throw new Error('Utilisateur non authentifié');

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Utilisateur non authentifié');

      const fileName = `video-${Date.now()}.webm`;
      const objectPath = `${user.id}/${fileName}`;

      // 2. Upload vers le storage
      setAnalysisProgress('Envoi de la vidéo...');
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(objectPath, recordedVideo.blob, {
          contentType: 'video/webm',
          cacheControl: '3600',
        });
      if (uploadError) throw new Error(`Échec de l'upload: ${uploadError.message}`);

      // 3. CORRECTION : Générer une URL signée au lieu d'utiliser l'URL publique
      setAnalysisProgress('Génération de l\'URL sécurisée...');
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(objectPath, 60 * 60); // 1 heure en secondes

      if (signedUrlError) throw new Error(`Échec génération URL: ${signedUrlError.message}`);

      // Log sécurisé (sans exposer l'URL complète)
      console.log('URL signée générée avec succès pour le chemin:', objectPath);

      // 4. Insertion dans la base avec le statut UPLOADED
      setAnalysisProgress('Enregistrement en base...');
      const { data: videoData, error: insertError } = await supabase
        .from('videos')
        .insert([
          {
            user_id: user.id,
            title: 'Ma vidéo SpotBulle',
            storage_path: objectPath,
            public_url: signedUrlData.signedUrl, // Utiliser l'URL signée
            status: VIDEO_STATUS.UPLOADED,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: tags ? tags.split(',').map((tag) => tag.trim()) : [],
            transcription_attempts: 0,
          },
        ])
        .select()
        .single();
      if (insertError) throw new Error(`Échec insertion vidéo: ${insertError.message}`);

      localUploadedVideoId = videoData.id;
      setUploadedVideoId(videoData.id);

      // 5. Mettre à jour le statut en PROCESSING
      setAnalysisProgress('Préparation de la transcription...');
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          status: VIDEO_STATUS.PROCESSING,
          updated_at: new Date().toISOString(),
          transcription_attempts: 1
        })
        .eq('id', videoData.id);

      if (updateError) {
        console.warn('Erreur lors de la mise à jour du statut:', updateError);
      }

      // 6. Déclencher la transcription avec l'URL signée
      setAnalysisProgress('Démarrage de la transcription...');
      await triggerTranscription(videoData.id, user.id, signedUrlData.signedUrl);

      toast.success('Vidéo envoyée avec succès ! Analyse en cours...');
    } catch (err) {
      setError(`Erreur lors de l'upload: ${err.message}`);
      setAnalysisProgress(null);
      
      // Mettre à jour le statut en FAILED en cas d'erreur
      if (localUploadedVideoId) {
        await supabase
          .from('videos')
          .update({
            status: VIDEO_STATUS.FAILED,
            error_message: err.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', localUploadedVideoId);
      }
      
      toast.error(`Erreur: ${err.message}`);
      console.error('Erreur détaillée:', err);
    } finally {
      setUploading(false);
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
    <div className="p-8 min-h-screen bg-black text-white flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">Enregistrez votre vidéo SpotBulle</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4 max-w-md">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {countdown > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-white text-center">
            <div className="text-9xl font-bold mb-4 text-blue-400">{countdown}</div>
            <p className="text-2xl">Préparez-vous à parler...</p>
          </div>
        </div>
      )}

      {analysisProgress && (
        <div className="bg-blue-900 text-white p-4 rounded-lg mb-6 max-w-md w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Analyse en cours</span>
            <span className="text-sm bg-blue-700 px-2 py-1 rounded">{analysisProgress}</span>
          </div>
          <div className="w-full bg-blue-700 rounded-full h-2">
            <div
              className="bg-green-400 h-2 rounded-full transition-all duration-1000 ease-in-out"
              style={{
                width: analysisProgress.includes('terminée') ? '100%' : 
                       analysisProgress.includes('Analyse IA') ? '75%' :
                       analysisProgress.includes('Transcription') ? '50%' :
                       analysisProgress.includes('Upload') ? '25%' : '10%'
              }}
            ></div>
          </div>
        </div>
      )}

      <div className="mb-6 relative">
        <video
          ref={videoRef}
          src={recordedVideo?.url || undefined}
          autoPlay
          muted={!recordedVideo}
          controls={!!recordedVideo}
          playsInline
          className="w-full max-w-md border-2 border-blue-500 rounded-lg bg-black shadow-lg"
        />
        {recording && (
          <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 rounded-full text-sm animate-pulse">
            ● ENREGISTREMENT ({formatTime(recordingTime)})
          </div>
        )}
      </div>

      {!recordedVideo ? (
        <div className="text-center">
          {!recording ? (
            <Button
              onClick={startRecording}
              disabled={!cameraAccess || countdown > 0}
              className={`text-lg px-8 py-3 ${cameraAccess ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600'}`}
            >
              {cameraAccess ? 'Commencer l\'enregistrement' : 'Caméra non disponible'}
            </Button>
          ) : (
            <Button onClick={stopRecording} className="bg-red-600 hover:bg-red-700 text-lg px-8 py-3">
              Arrêter l'enregistrement
            </Button>
          )}
          <div className="mt-4 text-sm text-gray-400">
            <p>💡 Conseil : Parlez clairement et regardez la caméra</p>
            <p>⏱️ Durée max : 2 minutes</p>
            <p>🎯 L'IA analysera automatiquement votre discours</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="bg-green-900 text-green-100 p-3 rounded-lg">
            <p className="font-semibold">✅ Vidéo enregistrée avec succès !</p>
            <p className="text-sm">Taille : {Math.round(recordedVideo.blob.size / 1024 / 1024)} Mo</p>
            <p className="text-sm">Durée : {formatTime(recordingTime)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">🏷️ Mots-clés (séparés par des virgules) :</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ex: Football, Sport, Passion"
              className="w-full p-3 border border-gray-600 rounded bg-gray-900 text-white placeholder-gray-400"
              disabled={uploading}
            />
            <p className="text-xs text-gray-400 mt-1">Ces mots-clés aideront l'IA à mieux comprendre votre vidéo</p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={retryRecording} className="bg-gray-600 hover:bg-gray-700 flex-1" disabled={uploading}>
              🔄 Réessayer
            </Button>
            <Button onClick={uploadVideo} disabled={uploading} className="bg-green-600 hover:bg-green-700 flex-1">
              {uploading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Envoi...
                </span>
              ) : (
                '🚀 Valider et analyser'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordVideo;
