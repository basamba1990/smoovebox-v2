import { useState, useRef, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

const RecordVideo = () => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null); // Référence pour le flux média
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    // Demander l'accès à la caméra au chargement
    requestCameraAccess();

    // Nettoyage du flux média lors du démontage
    return () => {
      stopStream();
    };
  }, []);

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
    } catch (error) {
      console.error('Erreur accès caméra:', error);
      setError('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions et activer la caméra/micro.');
    }
  };

  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra pour enregistrer une vidéo');
      return;
    }

    setError(null);
    // Compte à rebours avant l'enregistrement
    setCountdown(3);

    for (let i = 3; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
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
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
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
      setError('Impossible de démarrer l\'enregistrement. Veuillez réessayer.');
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
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const file = new File(
        [recordedVideo.blob],
        `video-${Date.now()}.webm`,
        { type: 'video/webm' }
      );

      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', 'Ma vidéo SpotBulle');
      formData.append('description', 'Vidéo enregistrée via SpotBulle');

      const { data, error } = await supabase.functions.invoke('upload-video', {
        body: formData,
      });

      if (error) throw error;

      // Rediriger vers la page de succès
      router.push(`/video-success?id=${data.video.id}`);
    } catch (error) {
      console.error('Erreur upload:', error);
      setError(`Erreur lors de l'upload de la vidéo : ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const retryRecording = () => {
    if (recordedVideo?.url) {
      URL.revokeObjectURL(recordedVideo.url);
    }
    setRecordedVideo(null);
    setError(null);
    requestCameraAccess();
  };

  if (countdown > 0) {
    return (
      <div style={{
        padding: '20px',
        maxWidth: '600px',
        margin: '0 auto',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <h1 style={{ color: '#38b2ac', fontSize: '72px', fontWeight: 'bold' }}>{countdown}</h1>
        <p style={{ color: '#4a5568', fontSize: '24px' }}>Préparez-vous à parler...</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <h1 style={{ color: '#38b2ac', fontSize: '28px', marginBottom: '20px' }}>
        Enregistrez votre vidéo
      </h1>

      {error && (
        <div style={{
          backgroundColor: '#fed7d7',
          color: '#9b2c2c',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '20px',
        }}>
          {error}
        </div>
      )}

      <div style={{ margin: '20px 0' }}>
        <video
          ref={videoRef}
          autoPlay
          muted={!recordedVideo}
          style={{
            width: '100%',
            maxWidth: '500px',
            border: '2px solid #38b2ac',
            borderRadius: '8px',
            backgroundColor: '#000',
          }}
          src={recordedVideo?.url}
        />
      </div>

      {!recordedVideo ? (
        <div>
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={!cameraAccess}
              style={{
                backgroundColor: cameraAccess ? '#38b2ac' : '#a0aec0',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                cursor: cameraAccess ? 'pointer' : 'not-allowed',
                opacity: cameraAccess ? 1 : 0.5,
              }}
            >
              {cameraAccess ? 'Commencer l\'enregistrement' : 'Caméra non disponible'}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{
                backgroundColor: '#e53e3e',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Arrêter l'enregistrement
            </button>
          )}
        </div>
      ) : (
        <div>
          <p style={{ color: '#38b2ac', marginBottom: '10px' }}>Vidéo enregistrée avec succès !</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={retryRecording}
              style={{
                backgroundColor: '#a0aec0',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
            <button
              onClick={uploadVideo}
              disabled={uploading}
              style={{
                backgroundColor: '#38b2ac',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? 'Envoi en cours...' : 'Valider et envoyer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecordVideo;
