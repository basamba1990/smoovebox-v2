// src/pages/record-video.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase } from '../lib/supabase';

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
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const initCamera = async () => {
      if (!mounted) return;
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
          setError("Impossible d'initialiser la caméra. Veuillez recharger la page.");
          toast.error("Erreur d'initialisation de la caméra.");
        }
      }
    };

    initCamera();

    return () => {
      mounted = false;
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
      } else {
        throw new Error('Élément vidéo non disponible dans le DOM');
      }
    } catch (err) {
      console.error('Erreur accès caméra:', err);
      setError("Impossible d'accéder à la caméra. Veuillez vérifier les permissions ou recharger la page.");
      toast.error("Erreur d'accès à la caméra.");
    }
  };

  const startRecording = async () => {
    if (!cameraAccess) {
      setError("Veuillez autoriser l'accès à la caméra.");
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
      await new Promise(res => setTimeout(res, 1000));
      setCountdown(i - 1);
    }

    try {
      const stream =
        streamRef.current ||
        (await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true }));
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current.ondataavailable = event => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedVideo({ blob, url: URL.createObjectURL(blob) });
        stopStream();
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } catch (err) {
      console.error('Erreur démarrage enregistrement:', err);
      setError(`Impossible de démarrer l'enregistrement: ${err.message}`);
      toast.error("Erreur lors de l'enregistrement.");
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
      setError('Vous devez enregistrer une vidéo.');
      toast.error('Vidéo manquante.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Utilisateur non authentifié');

      const fileName = `video-${Date.now()}.webm`;
      const pathInBucket = `${user.id}/${fileName}`;
      const fullStoragePath = `videos/${pathInBucket}`;

      // 1) Générer une URL signée pour l'upload
      const { data: signed, error: signedErr } = await supabase
        .storage
        .from('videos')
        .createSignedUploadUrl(pathInBucket, { upsert: true });

      if (signedErr) throw signedErr;

      // 2) Upload via fetch PUT (robuste pour gros fichiers)
      const putResp = await fetch(signed.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/webm',
          'x-upsert': 'true',
        },
        body: recordedVideo.blob,
      });

      if (!putResp.ok) {
        const text = await putResp.text().catch(() => '');
        throw new Error(`Upload Storage échoué: ${putResp.status} ${text}`);
      }

      // 3) Insérer la row dans la table videos avec user_id et storage_path
      const { data: videoData, error: insertError } = await supabase
        .from('videos')
        .insert([{
          title: 'Ma vidéo SpotBulle',
          description: 'Vidéo enregistrée via SpotBulle',
          user_id: user.id, // CRITIQUE: requis par RLS/schéma
          storage_path: fullStoragePath, // Inclut le bucket pour Edge Functions
          original_file_name: fileName,
          format: 'webm',
          tags: tags ? tags.split(',').map(t => t.trim()) : null,
          status: 'uploaded',
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Vidéo envoyée avec succès !');
      navigate(`/video-success?id=${videoData.id}`);
    } catch (err) {
      console.error('Erreur upload:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      toast.error("Erreur lors de l'upload.");
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
              disabled={!cameraAccess}
              className={cameraAccess ? '' : 'opacity-50 cursor-not-allowed'}
            >
              {cameraAccess ? "Commencer l'enregistrement" : 'Caméra non disponible'}
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
              onChange={e => setTags(e.target.value)}
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
              disabled={uploading}
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
