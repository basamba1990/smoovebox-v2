import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';

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
  const [recordingTime, setRecordingTime] = useState(0); // Temps d'enregistrement
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120; // 2 minutes max

  // Nettoyage des Object URLs
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    };
  }, [recordedVideo]);

  // Initialisation authentification et caméra
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

      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!user || !session) {
        toast.error('Utilisateur non authentifié.');
        navigate('/login');
        return;
      }

      const waitForVideoElement = () =>
        new Promise((resolve, reject) => {
          const check = () => {
            if (videoRef.current) resolve();
            else if (!mounted) reject(new Error('Composant démonté'));
            else setTimeout(check, 100);
          };
          check();
        });

      try {
        await waitForVideoElement();
        await requestCameraAccess();
      } catch (err) {
        console.error('Erreur initialisation caméra:', err);
        if (mounted) {
          setError('Impossible d\'initialiser la caméra. Veuillez recharger la page.');
          toast.error('Erreur d\'initialisation de la caméra.');
        }
      }
    };

    checkAuthAndInitCamera();

    return () => {
      mounted = false;
      stopStream();
    };
  }, [navigate]);

  // Timer pour durée max d'enregistrement
  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxRecordingTime) stopRecording();
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording]);

  // Vérification du statut de l'analyse
  useEffect(() => {
    if (!uploadedVideoId) return;

    const checkAnalysisStatus = async () => {
      try {
        const { data: video, error } = await supabase
          .from('videos')
          .select('status, analysis, error_message')
          .eq('id', uploadedVideoId)
          .single();

        if (error) throw error;

        switch (video.status) {
          case 'uploaded':
            setAnalysisProgress('📥 Vidéo uploadée, en attente de traitement...');
            break;
          case 'processing':
            setAnalysisProgress('🔍 Transcription en cours...');
            break;
          case 'transcribed':
            setAnalysisProgress('🤖 Analyse IA en cours...');
            break;
          case 'analyzed':
            setAnalysisProgress('✅ Analyse terminée !');
            toast.success('Votre vidéo a été analysée avec succès !');
            setTimeout(() => {
              navigate(`/video-success?id=${uploadedVideoId}`);
            }, 3000);
            break;
          case 'failed':
            setAnalysisProgress(`❌ Erreur: ${video.error_message || "Échec de l'analyse"}`);
            toast.error('Erreur lors de l\'analyse de la vidéo.');
            break;
          default:
            setAnalysisProgress('⏳ En attente de traitement...');
        }
      } catch (error) {
        console.error('Erreur vérification statut:', error);
        setAnalysisProgress('❌ Erreur lors de la vérification du statut');
      }
    };

    const interval = setInterval(checkAnalysisStatus, 3000);
    return () => clearInterval(interval);
  }, [uploadedVideoId, navigate]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraAccess(true);
      }
    } catch (err) {
      console.error('Erreur accès caméra/micro:', err);
      setError('Impossible d\'accéder à la caméra ou au microphone. Veuillez vérifier les permissions.');
      toast.error('Erreur d\'accès à la caméra ou au microphone.');
    }
  };

  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      return;
    }
    if (!videoRef.current) {
      setError('Erreur : élément vidéo non disponible.');
      toast.error('Erreur : élément vidéo non disponible.');
      return;
    }

    setError(null);
    setCountdown(3);

    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(res => setTimeout(res, 1000));
    }
    setCountdown(0);

    try {
      const stream =
        streamRef.current ||
        (await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        }));
      streamRef.current = stream;

      if (videoRef.current) videoRef.current.srcObject = stream;

      recordedChunksRef.current = [];

      const preferredTypes = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type) && (!isSafari || type.startsWith('video/mp4'))) || '';
      if (!mimeType) throw new Error('Aucun format vidéo supporté par ce navigateur.');

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType, bitsPerSecond: 500000 });
      mediaRecorderRef.current.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedVideo({ blob, url: URL.createObjectURL(blob) });
        setRecordingTime(0);
        stopStream();
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      toast.success('Enregistrement en cours... Parlez maintenant !');
    } catch (err) {
      console.error('Erreur démarrage enregistrement:', err);
      setError('Impossible de démarrer l\'enregistrement: ' + err.message);
      toast.error('Erreur lors de l\'enregistrement.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('Enregistrement terminé !');
    }
  };

  const uploadVideo = async () => {
    if (!recordedVideo) {
      setError('Vous devez enregistrer une vidéo.');
      toast.error('Vidéo manquante.');
      return;
    }

    setUploading(true);
    setError(null);
    setAnalysisProgress('📤 Upload de la vidéo...');

    try {
      const isSessionValid = await refreshSession();
      if (!isSessionValid) throw new Error('Utilisateur non authentifié');

      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!user || !session) throw new Error('Utilisateur non authentifié');

      const fileName = `video-${Date.now()}.${recordedVideo.blob.type.split('/')[1]}`;
      const pathInBucket = `videos/${user.id}/${fileName}`;

      // Upload direct
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(pathInBucket, recordedVideo.blob, { upsert: true });

      if (uploadError) throw uploadError;

      // Générer une URL publique pour lecture
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(pathInBucket);

      if (!publicUrlData?.publicUrl) throw new Error('Impossible de générer l\'URL publique');

      // Insérer dans la table videos
      const { data: videoData, error: insertError } = await supabase
        .from('videos')
        .insert([
          {
            title: 'Ma vidéo SpotBulle',
            description: 'Vidéo enregistrée via SpotBulle',
            user_id: user.id,
            storage_path: pathInBucket,
            public_url: publicUrlData.publicUrl,
            original_file_name: fileName,
            format: recordedVideo.blob.type.split('/')[1],
            tags: tags.length > 0 ? tags.split(',').map(t => t.trim()) : [],
            status: 'uploaded',
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      setUploadedVideoId(videoData.id);
      setRecordedVideo(prev => ({ ...prev, url: publicUrlData.publicUrl }));
      setAnalysisProgress('🚀 Démarrage de l\'analyse IA...');

      // Déclencher l'analyse automatique
      try {
        const response = await fetch('https://nyxtckjfaajhacboxojd.supabase.co/functions/v1/transcribe-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ video_id: videoData.id }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || 'Erreur lors du déclenchement de l\'analyse');
        }
      } catch (analysisError) {
        console.warn('Erreur analyse automatique:', analysisError);
        setAnalysisProgress('❌ Erreur lors du démarrage de l\'analyse');
        toast.error('Erreur lors du démarrage de l\'analyse.');
      }
    } catch (err) {
      console.error('Erreur upload:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      setAnalysisProgress(null);
      toast.error('Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  const retryRecording = () => {
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    setRecordedVideo(null);
    setError(null);
    setAnalysisProgress(null);
    setUploadedVideoId(null);
    setRecordingTime(0);
    requestCameraAccess();
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
            <span className="font-semibold">📊 Analyse en cours</span>
            <span className="text-sm bg-blue-700 px-2 py-1 rounded">{analysisProgress}</span>
          </div>
          <div className="w-full bg-blue-700 rounded-full h-2">
            <div
              className="bg-green-400 h-2 rounded-full transition-all duration-1000 ease-in-out"
              style={{
                width: analysisProgress.includes('terminée') ? '100%' :
                       analysisProgress.includes('Analyse IA') ? '75%' :
                       analysisProgress.includes('Transcription') ? '50%' :
                       analysisProgress.includes('Upload') ? '25%' : '10%',
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
          controls
          playsInline
          className="w-full max-w-md border-2 border-blue-500 rounded-lg bg-black shadow-lg"
        />
        {recording && (
          <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 rounded-full text-sm animate-pulse">
            ● ENREGISTREMENT ({recordingTime}s)
          </div>
        )}
      </div>

      {!recordedVideo ? (
        <div className="text-center">
          {!recording ? (
            <Button
              onClick={startRecording}
              disabled={!cameraAccess || countdown > 0}
              className={`text-lg px-8 py-3 ${
                cameraAccess
                  ? 'bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-700 hover:to-blue-700'
                  : 'bg-gray-600 opacity-50 cursor-not-allowed'
              }`}
            >
              {cameraAccess ? '🎤 Commencer l\'enregistrement' : '📷 Caméra non disponible'}
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              className="bg-red-600 hover:bg-red-700 text-lg px-8 py-3"
            >
              ⏹️ Arrêter l'enregistrement
            </Button>
          )}

          <div className="mt-4 text-sm text-gray-400">
            <p>💡 Conseil : Parlez clairement et regardez la caméra</p>
            <p>⏱️ Durée max : 2 minutes</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-4">
          <div className="bg-green-900 text-green-100 p-3 rounded-lg">
            <p className="font-semibold">✅ Vidéo enregistrée avec succès !</p>
            <p className="text-sm">Taille : {Math.round(recordedVideo.blob.size / 1024 / 1024)} Mo</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              🏷️ Ajouter des mots-clés (séparés par des virgules) :
            </label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="ex: Football, Sport, Passion, CAN2025"
              className="w-full p-3 border border-gray-600 rounded bg-gray-900 text-white placeholder-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              Ces mots-clés aideront l'IA à mieux comprendre votre vidéo
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              onClick={retryRecording}
              className="bg-gray-600 hover:bg-gray-700 flex-1"
              disabled={uploading}
            >
              🔄 Réessayer
            </Button>
            <Button
              onClick={uploadVideo}
              disabled={uploading}
              className={`flex-1 ${
                uploading
                  ? 'bg-blue-400 opacity-70 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700'
              }`}
            >
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
