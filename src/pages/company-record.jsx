import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, refreshSession } from '../lib/supabase.js';
import { Button } from '../components/ui/button.jsx';

export const CompanyRecord = () => {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const maxRecordingTime = 300; // 5 minutes

  // Initialize: Check company user and request camera access
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        console.log('🔄 Initialisation CompanyRecord...');
        
        // 1. Check if user is logged in
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error('❌ Utilisateur non connecté:', userError);
          toast.error('Vous devez être connecté.');
          navigate('/company-signin');
          return;
        }

        // 2. Check if user is company user
        const { data: membership } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) {
          // Not a company user, redirect to home
          console.log('❌ Utilisateur n\'est pas un utilisateur entreprise');
          navigate('/');
          return;
        }

        console.log('✅ Utilisateur entreprise vérifié');
        
        // 3. Refresh session
        await refreshSession();
        
        // 4. Request camera access
        if (mounted) {
          await requestCameraAccess();
        }

      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation.');
          toast.error('Erreur initialisation');
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
      stopStream();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [recordedVideo]);

  // Recording timer
  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxRecordingTime) {
            stopRecording();
            toast.warning('Temps d\'enregistrement maximum atteint (5 minutes).');
            return maxRecordingTime;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording]);

  // Request camera access
  const requestCameraAccess = async () => {
    try {
      console.log('📹 Demande accès caméra...');
      
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: {
          channelCount: 1,
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Accès caméra accordé');
      streamRef.current = stream;
      setCameraAccess(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('⚠️ Lecture vidéo:', e));
      }

      setupAudioAnalysis(stream);
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      let errorMessage = 'Impossible d\'accéder à la caméra. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Veuillez autoriser l\'accès à la caméra et au microphone dans les paramètres de votre navigateur.';
        toast.error('Autorisation caméra requise');
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Aucune caméra détectée. Vérifiez votre connexion.';
        toast.error('Aucune caméra détectée');
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'La caméra est déjà utilisée par une autre application.';
        toast.error('Caméra indisponible');
      } else if (err.name === 'NotSupportedError') {
        errorMessage += 'Votre navigateur ne supporte pas l\'enregistrement vidéo.';
        toast.error('Navigateur non supporté');
      } else {
        errorMessage += `Erreur technique: ${err.message}`;
      }
      
      setError(errorMessage);
      setCameraAccess(false);
      
      // Clear video source on error
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  // Stop stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Setup audio analysis
  const setupAudioAnalysis = (stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
    } catch (err) {
      console.warn('⚠️ Analyse audio non supportée:', err);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
      return;
    }

    if (!streamRef.current) {
      setError('Flux caméra non disponible.');
      toast.error('Problème de flux vidéo.');
      await requestCameraAccess();
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('L\'enregistrement vidéo n\'est pas supporté sur votre navigateur. Essayez Chrome ou Firefox.');
      toast.error('Enregistrement non supporté');
      return;
    }

    // Countdown
    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCountdown(i - 1);
    }
    setCountdown(0);

    try {
      recordedChunksRef.current = [];
      setRecording(true);
      setRecordingTime(0);
      setError(null);

      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9,opus')
        ? 'video/webm; codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm; codecs=vp8,opus')
        ? 'video/webm; codecs=vp8,opus'
        : 'video/webm';

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 2500000
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recordedChunksRef.current[0]?.type || 'video/webm'
        });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({ blob, url });
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('❌ Erreur MediaRecorder:', event);
        setError('Erreur lors de l\'enregistrement vidéo.');
        setRecording(false);
        toast.error('Erreur d\'enregistrement');
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      toast.success('🎥 Enregistrement démarré !');
    } catch (err) {
      console.error('Recording error:', err);
      setError('Erreur lors de l\'enregistrement');
      setRecording(false);
      toast.error('Erreur enregistrement');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      try {
        mediaRecorderRef.current.stop();
        setRecording(false);
        toast.success('✅ Enregistrement terminé !');
      } catch (err) {
        console.error('❌ Erreur arrêt enregistrement:', err);
        setRecording(false);
      }
    }
  };

  // Upload video
  const uploadVideo = async () => {
    if (!recordedVideo?.blob) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Get company info
      const { data: membership } = await supabase
        .from('user_companies')
        .select('company_id, companies(name)')
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        throw new Error('Aucune entreprise associée');
      }

      // Create video file name
      const fileName = `company-${membership.company_id}-${Date.now()}.webm`;
      const filePath = `company-videos/${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, recordedVideo.blob, {
          contentType: 'video/webm',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      setVideoUrl(urlData.publicUrl);
      setUploadSuccess(true);
      toast.success('Vidéo enregistrée avec succès !');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Erreur lors de l\'upload');
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  // Download video
  const downloadVideo = () => {
    if (!recordedVideo?.url) return;

    const a = document.createElement('a');
    a.href = recordedVideo.url;
    a.download = `video-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Record another video
  const recordAnother = () => {
    setRecordedVideo(null);
    setUploadSuccess(false);
    setVideoUrl(null);
    setRecordingTime(0);
    setError(null);
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Logout function
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Déconnexion réussie');
      navigate('/company-signin');
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Erreur lors de la déconnexion');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative">
      {/* Logout button */}
      <Button
        onClick={handleLogout}
        className="absolute top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 text-sm"
        variant="outline"
      >
        Déconnexion
      </Button>
      <div className="w-full max-w-4xl">
        {!uploadSuccess ? (
          <div className="space-y-6">
            {/* Video Preview */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              {countdown > 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                  <div className="text-8xl font-bold text-white">{countdown}</div>
                </div>
              ) : null}
              {!cameraAccess && !error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/50 z-10">
                  <div className="text-6xl mb-4">📹</div>
                  <p className="text-white text-lg font-semibold mb-2">Autorisation requise</p>
                  <p className="text-gray-300 text-sm mb-4">Veuillez autoriser l'accès à la caméra et au microphone</p>
                  <Button
                    onClick={requestCameraAccess}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                  >
                    Autoriser l'accès
                  </Button>
                </div>
              ) : null}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {recording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  <span className="font-semibold">Enregistrement</span>
                  <span className="ml-2">{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-4">
              {error && (
                <div className="w-full bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {!cameraAccess && !recording && (
                <Button
                  onClick={requestCameraAccess}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                >
                  Activer la caméra
                </Button>
              )}

              {cameraAccess && !recording && !recordedVideo && (
                <Button
                  onClick={startRecording}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg"
                >
                  🎥 Commencer l'enregistrement
                </Button>
              )}

              {recording && (
                <Button
                  onClick={stopRecording}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg"
                >
                  ⏹️ Arrêter l'enregistrement
                </Button>
              )}

              {recordedVideo && !uploadSuccess && (
                <div className="flex gap-4">
                  <Button
                    onClick={uploadVideo}
                    disabled={uploading}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                  >
                    {uploading ? 'Upload en cours...' : '💾 Enregistrer la vidéo'}
                  </Button>
                  <Button
                    onClick={recordAnother}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8 py-3 text-lg"
                  >
                    🔄 Réenregistrer
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Success Screen */
          <div className="bg-slate-800/70 rounded-2xl p-8 text-center space-y-6 border border-slate-700">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-white">Vidéo enregistrée avec succès !</h2>
            <p className="text-gray-300">Votre vidéo a été sauvegardée.</p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={downloadVideo}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
              >
                📥 Télécharger la vidéo
              </Button>
              <Button
                onClick={recordAnother}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
              >
                🎥 Enregistrer une autre vidéo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

