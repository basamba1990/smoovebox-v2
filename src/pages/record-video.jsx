import { useState, useRef, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';

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
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    requestCameraAccess();
    return () => stopStream();
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
    } catch (error) {
      console.error('Erreur accès caméra:', error);
      setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
      toast.error('Erreur d\'accès à la caméra.');
    }
  };

  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      return;
    }

    setError(null);
    setCountdown(3);

    for (let i = 3; i > 0; i--) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setCountdown(i - 1);
    }

    try {
      const stream = streamRef.current || await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      recordedChunksRef.current = [];

      const options = { mimeType: 'video/webm; codecs=vp9,opus' };
      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setRecordedVideo({ blob, url: URL.createObjectURL(blob) });
        stopStream();
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (error) {
      console.error('Erreur démarrage enregistrement:', error);
      setError('Impossible de démarrer l\'enregistrement.');
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
    if (!recordedVideo || !user) {
      setError('Vous devez être connecté et avoir une vidéo enregistrée.');
      toast.error('Connexion ou vidéo manquante.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const file = new File([recordedVideo.blob], `video-${Date.now()}.webm`, { type: 'video/webm' });

      const body = {
        title: 'Ma vidéo SpotBulle',
        description: 'Vidéo enregistrée via SpotBulle',
        tags: tags.split(',').map(t => t.trim()),
      };

      const { data, error } = await supabase.functions.invoke('upload-video', {
        body: { ...body, video: file },
      });

      if (error) throw error;
      toast.success('Vidéo envoyée avec succès !');
      navigate(`/video-success?id=${data.video.id}`);
    } catch (error) {
      console.error('Erreur upload:', error);
      setError(`Erreur lors de l'upload : ${error.message}`);
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

  if (countdown > 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white text-2xl">
        <h1>Prêt dans {countdown}...</h1>
        <p>Préparez-vous à parler...</p>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen text-white bg-black flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4">Enregistrez votre vidéo</h1>

      {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}

      <div className="mb-4">
        <video
          ref={videoRef}
          autoPlay
          muted={!recordedVideo}
          className="w-full max-w-md border-2 border-blue-500 rounded-lg bg-black"
          src={recordedVideo?.url}
        />
      </div>

      {!recordedVideo ? (
        !recording ? (
          <Button onClick={startRecording} disabled={!cameraAccess}>
            {cameraAccess ? 'Commencer l\'enregistrement' : 'Caméra non disponible'}
          </Button>
        ) : (
          <Button onClick={stopRecording} className="bg-red-500 hover:bg-red-600">
            Arrêter l'enregistrement
          </Button>
        )
      ) : (
        <div className="w-full max-w-md">
          <p className="text-blue-400 mb-2">Vidéo enregistrée avec succès !</p>
          <label className="block text-sm font-medium text-white mb-1">
            Ajouter des tags (séparés par des virgules) :
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Football, Sport, etc."
            className="w-full p-2 border rounded bg-white/10 text-white mb-4"
          />
          <div className="flex gap-4 justify-center">
            <Button onClick={retryRecording} className="bg-gray-500 hover:bg-gray-600">
              Réessayer
            </Button>
            <Button onClick={uploadVideo} disabled={uploading}>
              {uploading ? 'Envoi en cours...' : 'Valider et envoyer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordVideo;
