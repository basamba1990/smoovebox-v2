// src/pages/record-video.jsx
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, retryOperation } from '../lib/supabase';

const RecordVideo = () => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState('');
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    console.log('RecordVideo: Vérification auth, user:', user, 'loading:', loading);

    // Vérifier si l'utilisateur est connecté
    if (!loading && !user) {
      console.log('RecordVideo: Utilisateur non connecté, redirection vers /');
      setError('Vous devez être connecté pour enregistrer une vidéo.');
      toast.error('Veuillez vous connecter pour continuer.');
      navigate('/'); // Rediriger vers la page d'accueil
      return;
    }

    const initCamera = async () => {
      if (!mounted || !user) return;
      console.log('RecordVideo: Initialisation caméra pour user:', user?.id);
      const waitForVideoElement = () => {
        return new Promise((resolve, reject) => {
          const check = () => {
            if (videoRef.current) {
              resolve();
            } else if (!mounted) {
              reject(new Error('Composant démonté'));
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
      };

      try {
        await waitForVideoElement();
        await requestCameraAccess();
      } catch (err) {
        console.error('RecordVideo: Erreur initialisation caméra:', err);
        if (mounted) {
          setError('Impossible d\'initialiser la caméra. Veuillez recharger la page.');
          toast.error('Erreur d\'initialisation de la caméra.');
        }
      }
    };

    if (user) initCamera();

    return () => {
      mounted = false;
      stopStream();
    };
  }, [loading, user, navigate]);

  const stopStream = () => {
    if (streamRef.current) {
      console.log('RecordVideo: Arrêt du flux caméra');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const requestCameraAccess = async () => {
    try {
      console.log('RecordVideo: Demande d\'accès à la caméra');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraAccess(true);
        console.log('RecordVideo: Accès caméra réussi');
      } else {
        throw new Error('Élément vidéo non disponible dans le DOM');
      }
    } catch (err) {
      console.error('RecordVideo: Erreur accès caméra:', err);
      setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions ou recharger la page.');
      toast.error('Erreur d\'accès à la caméra.');
    }
  };

  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      return;
    }
    if (!videoRef.current) {
      setError('Erreur : élément vidéo non disponible. Veuillez recharger la page.');
      toast.error('Erreur : élément vidéo non disponible.');
      return;
    }

    setError(null);
    setCountdown(3);

    for (let i = 3; i > 0; i--) {
      await new Promise(res => setTimeout(res, 1000));
      setCountdown(i - 1);
    }

    try {
      console.log('RecordVideo: Début enregistrement');
      const stream = streamRef.current || await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      } else {
        throw new Error('Élément vidéo non disponible dans le DOM');
      }
      recordedChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus') 
        ? 'video/webm; codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm') 
        ? 'video/webm'
        : 'video/mp4';
      console.log('RecordVideo: Format vidéo utilisé:', mimeType);

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('RecordVideo: Enregistrement arrêté');
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedVideo({ blob, url: URL.createObjectURL(blob) });
        stopStream();
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      console.error('RecordVideo: Erreur démarrage enregistrement:', err);
      setError(`Impossible de démarrer l'enregistrement: ${err.message}`);
      toast.error('Erreur lors de l\'enregistrement.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadVideo = async () => {
    if (!recordedVideo) {
      setError('Aucune vidéo enregistrée.');
      toast.error('Veuillez enregistrer une vidéo avant de l\'envoyer.');
      return;
    }
    if (!user) {
      console.log('RecordVideo: Utilisateur non connecté lors de l\'upload');
      setError('Vous devez être connecté pour envoyer une vidéo.');
      toast.error('Veuillez vous connecter pour continuer.');
      navigate('/');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      console.log('RecordVideo: Début upload vidéo pour user:', user.id);
      const { data: { session }, error: sessionError } = await retryOperation(() => 
        supabase.auth.getSession()
      );
      if (sessionError || !session?.access_token) {
        throw new Error('Session non valide, veuillez vous reconnecter');
      }

      const file = new File([recordedVideo.blob], `video-${Date.now()}.webm`, { type: 'video/webm' });

      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', 'Ma vidéo SpotBulle');
      formData.append('description', 'Vidéo enregistrée via SpotBulle');
      formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim())));

      const response = await retryOperation(() =>
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-video`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'X-Client-Info': 'spotbulle',
          },
          body: formData,
        })
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('RecordVideo: Réponse upload-video:', data);
      toast.success('Vidéo envoyée avec succès !');
      navigate(`/video-success?id=${data.video.id}`);
    } catch (err) {
      console.error('RecordVideo: Erreur upload:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      toast.error('Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  const retryRecording = () => {
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    setRecordedVideo(null);
    setError(null);
    requestCameraAccess();
  };

  return (
    <div className="p-8 min-h-screen bg-black text-white flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">Enregistrez votre vidéo</h1>

      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}

      {countdown > 0 && (
        <div className="text-white text-center mb-4">
          <h1 className="text-6xl font-bold">{countdown}</h1>
          <p>Préparez-vous à parler...</p>
        </div>
      )}

      <div className="mb-4">
        <video
          ref={videoRef}
          autoPlay
          muted={!recordedVideo}
          className="w-full max-w-md border-2 border-blue-500 rounded-lg bg-black"
          playsInline
        />
      </div>

      {!recordedVideo ? (
        <div>
          {!recording ? (
            <Button
              onClick={startRecording}
              disabled={!cameraAccess || loading}
              className={cameraAccess ? '' : 'opacity-50 cursor-not-allowed'}
            >
              {cameraAccess ? 'Commencer l\'enregistrement' : 'Caméra non disponible'}
            </Button>
          ) : (
            <Button onClick={stopRecording} className="bg-red-500 hover:bg-red-600">
              Arrêter l'enregistrement
            </Button>
          )}
        </div>
      ) : (
        <div className="w-full max-w-md">
          <p className="text-blue-400 mb-2">Vidéo enregistrée avec succès !</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-1">
              Ajouter des tags (séparés par des virgules) :
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Football, Sport, etc."
              className="w-full p-2 border rounded bg-white/10 text-white"
            />
          </div>
          <div className="flex gap-4 justify-center">
            <Button onClick={retryRecording} className="bg-gray-500 hover:bg-gray-600">
              Réessayer
            </Button>
            <Button
              onClick={uploadVideo}
              disabled={uploading || loading}
              className={uploading ? 'opacity-70 cursor-not-allowed' : ''}
            >
              {uploading ? 'Envoi en cours...' : 'Valider et envoyer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordVideo;
