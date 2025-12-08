import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase.js';
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

  const maxRecordingTime = 300; // 5 minutes

  // Check if user is company user
  useEffect(() => {
    const checkCompanyUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/company-signin');
        return;
      }

      const { data: membership } = await supabase
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership) {
        // Not a company user, redirect to home
        navigate('/');
      }
    };

    checkCompanyUser();
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

  // Request camera access
  const requestCameraAccess = async () => {
    try {
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
      streamRef.current = stream;
      setCameraAccess(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play error:', e));
      }
    } catch (err) {
      console.error('Camera access error:', err);
      let errorMessage = 'Impossible d\'accéder à la caméra. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Veuillez autoriser l\'accès à la caméra et au microphone.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Aucune caméra n\'a été détectée.';
      } else {
        errorMessage += `Erreur: ${err.message}`;
      }
      
      setError(errorMessage);
      toast.error('Accès caméra refusé');
    }
  };

  // Stop stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!cameraAccess) {
      await requestCameraAccess();
      if (!cameraAccess) return;
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

      mediaRecorderRef.current.start(1000); // Collect data every second

      // Recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxRecordingTime) {
            stopRecording();
            return maxRecordingTime;
          }
          return prev + 1;
        });
      }, 1000);
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
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
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

