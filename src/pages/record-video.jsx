import { useState, useRef, useEffect } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

const RecordVideo = () => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const videoRef = useRef();
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    // Demander l'accès à la caméra au chargement de la page
    requestCameraAccess();
  }, []);

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraAccess(true);
      }
    } catch (error) {
      console.error('Erreur accès caméra:', error);
      alert('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
    }
  };

  const startRecording = async () => {
    if (!cameraAccess) {
      alert('Veuillez autoriser l\'accès à la caméra pour enregistrer une vidéo');
      return;
    }

    // Countdown avant le début de l'enregistrement
    setCountdown(3);
    
    for (let i = 3; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCountdown(i - 1);
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 },
        audio: true 
      });
      
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
        const blob = new Blob(recordedChunksRef.current, { 
          type: 'video/webm' 
        });
        setRecordedVideo(blob);
      };
      
      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (error) {
      console.error('Erreur démarrage enregistrement:', error);
      alert('Impossible de démarrer l\'enregistrement');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      setRecording(false);
    }
  };

  const uploadVideo = async () => {
    if (!recordedVideo || !user) return;
    
    setUploading(true);
    
    try {
      // Convertir le blob en fichier
      const file = new File(
        [recordedVideo], 
        `video-${Date.now()}.webm`, 
        { type: 'video/webm' }
      );
      
      // Créer un FormData pour l'upload
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', 'Ma vidéo SpotBulle');
      formData.append('description', 'Vidéo enregistrée via SpotBulle');
      
      // Appeler l'Edge Function d'upload
      const { data, error } = await supabase.functions.invoke('upload-video', {
        body: formData
      });
      
      if (error) throw error;
      
      // Rediriger vers la page de statut avec l'ID de la vidéo
      router.push(`/video-status?id=${data.video.id}`);
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors de l\'upload de la vidéo');
    } finally {
      setUploading(false);
    }
  };

  const retryRecording = () => {
    setRecordedVideo(null);
    requestCameraAccess();
  };

  if (countdown > 0) {
    return (
      <div style={{ 
        padding: '20px', 
        maxWidth: '600px', 
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#38b2ac', fontSize: '48px' }}>{countdown}</h1>
        <p>Préparez-vous à parler...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '600px', 
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <h1 style={{ color: '#38b2ac' }}>Enregistrez votre vidéo</h1>
      
      <div style={{ margin: '20px 0' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{ 
            width: '100%', 
            maxWidth: '500px', 
            border: '2px solid #38b2ac',
            borderRadius: '8px'
          }}
        />
      </div>
      
      {!recordedVideo ? (
        <div>
          {!recording ? (
            <button
              onClick={startRecording}
              disabled={!cameraAccess}
              style={{
                backgroundColor: '#38b2ac',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                cursor: cameraAccess ? 'pointer' : 'not-allowed',
                opacity: cameraAccess ? 1 : 0.5
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
                cursor: 'pointer'
              }}
            >
              Arrêter l'enregistrement
            </button>
          )}
        </div>
      ) : (
        <div>
          <p>Vidéo enregistrée avec succès!</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={retryRecording}
              style={{
                backgroundColor: '#a0aec0',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer'
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
                opacity: uploading ? 0.7 : 1
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
