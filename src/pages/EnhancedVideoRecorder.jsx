import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button-enhanced.jsx';

const EnhancedVideoRecorder = ({ onRecordingComplete, user }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // ✅ CORRECTION : Initialisation robuste de la caméra
  const initializeCamera = async () => {
    try {
      setCameraError(null);
      
      // Arrêter le flux existant
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Demander l'accès à la caméra avec contraintes améliorées
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // ✅ CORRECTION : Attendre que la vidéo soit chargée
        await new Promise((resolve, reject) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
            videoRef.current.onerror = () => {
              reject(new Error('Erreur de chargement de la vidéo'));
            };
            
            // Timeout de sécurité
            setTimeout(() => {
              if (videoRef.current?.readyState >= 1) {
                resolve();
              } else {
                reject(new Error('Timeout de chargement vidéo'));
              }
            }, 3000);
          }
        });
        
        // Forcer la lecture avec gestion d'erreur
        try {
          await videoRef.current.play();
          setHasCameraAccess(true);
          console.log('✅ Caméra activée avec succès');
          toast.success('Caméra activée ! Vous pouvez maintenant vous enregistrer.');
        } catch (playError) {
          console.error('Erreur lecture vidéo:', playError);
          setCameraError('Erreur de lecture vidéo');
          toast.error('Problème d\'affichage vidéo');
        }
      }
    } catch (error) {
      console.error('❌ Erreur caméra:', error);
      let errorMessage = `Erreur caméra: ${error.message}`;
      
      // Gestion des erreurs spécifiques
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur';
        toast.info('Autorisation caméra requise');
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'Aucune caméra détectée. Vérifiez votre connexion.';
        toast.error('Aucune caméra détectée');
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'La caméra est déjà utilisée par une autre application';
        toast.error('Caméra indisponible');
      }
      
      setCameraError(errorMessage);
      setHasCameraAccess(false);
    }
  };

  // ✅ CORRECTION : Vérification au montage
  useEffect(() => {
    initializeCamera();
    
    return () => {
      // Nettoyage complet
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    if (!streamRef.current) {
      toast.error('Caméra non disponible');
      await initializeCamera();
      if (!streamRef.current) return;
    }

    try {
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (onRecordingComplete) {
          onRecordingComplete(blob);
        }
        setRecordingTime(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('Erreur enregistrement:', event);
        toast.error('Erreur lors de l\'enregistrement');
        setIsRecording(false);
        setRecordingTime(0);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };

      // Démarrer l'enregistrement
      mediaRecorder.start(1000); // Collecte des données chaque seconde
      setIsRecording(true);
      
      // Timer d'enregistrement
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 180) { // Maximum 3 minutes
            stopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);

      toast.success('🎥 Enregistrement démarré !');
    } catch (error) {
      console.error('❌ Erreur démarrage enregistrement:', error);
      toast.error('Erreur lors du démarrage de l\'enregistrement');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      toast.success('✅ Enregistrement terminé !');
    }
  };

  const retryCamera = async () => {
    setCameraError(null);
    await initializeCamera();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 p-6 border-2 border-gray-300 rounded-xl bg-white shadow-lg">
      <h3 className="text-2xl font-bold text-gray-800 text-center">
        🎥 Enregistrement Vidéo SpotBulle
      </h3>
      
      {/* ✅ CORRECTION : Avertissement caméra amélioré */}
      {!hasCameraAccess && (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-yellow-800 font-semibold text-lg">📷 Caméra non détectée</p>
              <p className="text-yellow-700 text-sm mt-1">
                {cameraError || 'Vérifiez que votre caméra est branchée et autorisée'}
              </p>
              <p className="text-yellow-600 text-xs mt-2">
                💡 Conseil : Rafraîchissez la page et autorisez l'accès à la caméra
              </p>
            </div>
            <Button
              onClick={retryCamera}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              🔄 Réessayer
            </Button>
          </div>
        </div>
      )}

      {/* Élément vidéo avec gestion d'erreur améliorée */}
      <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-auto max-h-96 object-contain bg-gray-900"
          onError={() => {
            setCameraError('Erreur de flux vidéo - Réinitialisation en cours...');
            setTimeout(retryCamera, 2000);
          }}
          onLoadStart={() => console.log('🔄 Chargement vidéo démarré')}
          onCanPlay={() => console.log('✅ Vidéo prête à jouer')}
          onPlaying={() => console.log('🎬 Vidéo en cours de lecture')}
        />
        
        {/* Overlay si pas de caméra */}
        {!hasCameraAccess && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <div className="text-white text-center p-8">
              <div className="text-6xl mb-4">📷</div>
              <p className="text-xl font-semibold mb-2">Caméra en attente...</p>
              <p className="text-gray-300">Veuillez autoriser l'accès à votre caméra</p>
              <Button
                onClick={retryCamera}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
              >
                🔍 Détecter la caméra
              </Button>
            </div>
          </div>
        )}

        {/* Indicateur d'enregistrement avec timer */}
        {isRecording && (
          <div className="absolute top-4 right-4 flex items-center space-x-3 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <span className="font-semibold">ENREGISTREMENT</span>
            <span className="font-mono bg-red-600 px-2 py-1 rounded">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}

        {/* Indicateur de statut caméra */}
        {hasCameraAccess && !isRecording && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            ✅ Caméra active
          </div>
        )}
      </div>

      {/* ✅ CORRECTION : Contrôles améliorés */}
      <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            disabled={!hasCameraAccess}
            className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-3"
          >
            <span>🎬</span>
            <span>Commencer l'enregistrement</span>
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg transition-all flex items-center space-x-3"
          >
            <span>⏹️</span>
            <span>Arrêter l'enregistrement</span>
          </Button>
        )}
        
        <Button
          onClick={retryCamera}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center space-x-2"
        >
          <span>🔄</span>
          <span>Réinitialiser caméra</span>
        </Button>
      </div>

      {/* ✅ CORRECTION : Instructions améliorées */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">💡 Conseils pour un bon enregistrement :</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Assurez-vous d'être dans un endroit bien éclairé</li>
          <li>• Regardez droit dans la caméra</li>
          <li>• Parlez clairement et distinctement</li>
          <li>• Maximum 3 minutes par enregistrement</li>
          <li>• Votre vidéo sera privée par défaut</li>
        </ul>
      </div>
    </div>
  );
};

export default EnhancedVideoRecorder;
