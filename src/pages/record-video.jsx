// ✅ VERSION COMPLÈTE : RecordVideo avec IA avancée
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';

// ✅ CONSTANTES OPTIMISÉES
const VIDEO_CONFIG = {
  MAX_RECORDING_TIME: 120,
  COUNTDOWN_DURATION: 3,
  SUPPORTED_FORMATS: {
    ios: 'video/mp4',
    android: 'video/webm; codecs=vp9',
    fallback: 'video/webm'
  },
  CONSTRAINTS: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: 'user'
    },
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      sampleSize: 16,
      echoCancellation: true,
      noiseSuppression: true
    }
  }
};

// ✅ HOOK PERSONNALISÉ : Gestion caméra et enregistrement
const useMediaRecorder = (onRecordingComplete) => {
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const initializeCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(VIDEO_CONFIG.CONSTRAINTS);
      setStream(mediaStream);
      setError(null);
      return mediaStream;
    } catch (err) {
      const errorMessage = getCameraErrorMessage(err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const getMimeType = useCallback(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) return VIDEO_CONFIG.SUPPORTED_FORMATS.ios;
    
    if (MediaRecorder.isTypeSupported(VIDEO_CONFIG.SUPPORTED_FORMATS.android)) {
      return VIDEO_CONFIG.SUPPORTED_FORMATS.android;
    }
    
    return VIDEO_CONFIG.SUPPORTED_FORMATS.fallback;
  }, []);

  const startRecording = useCallback(async (stream) => {
    try {
      recordedChunksRef.current = [];
      const mimeType = getMimeType();

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        onRecordingComplete(blob, mimeType);
      };

      mediaRecorderRef.current.onerror = (event) => {
        setError(`Erreur enregistrement: ${event.error.name}`);
        setRecording(false);
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      return true;
    } catch (err) {
      setError('Erreur démarrage enregistrement');
      throw err;
    }
  }, [getMimeType, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  const cleanup = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setRecording(false);
    setRecordedBlob(null);
  }, [stream]);

  return {
    stream,
    recording,
    recordedBlob,
    error,
    initializeCamera,
    startRecording,
    stopRecording,
    cleanup
  };
};

// ✅ COMPOSANT : Assistant IA d'enregistrement
const RecordingAssistant = ({ onSuggestionSelect, userProfile }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    generateSuggestions();
  }, [userProfile]);

  const generateSuggestions = () => {
    const baseSuggestions = {
      technique: [
        "🎯 Partagez une technique que vous maîtrisez particulièrement bien",
        "⚡ Démontrez un mouvement ou geste technique spécifique",
        "🔄 Expliquez comment vous avez progressé sur un point technique"
      ],
      emotion: [
        "💫 Racontez un moment fort en émotion dans votre pratique",
        "🌟 Partagez ce qui vous passionne le plus dans votre activité",
        "🤝 Parlez d'une rencontre qui a marqué votre parcours"
      ],
      conseils: [
        "📚 Donnez un conseil que vous auriez aimé recevoir plus tôt",
        "🚀 Partagez une astuce pour progresser plus rapidement",
        "💡 Expliquez comment surmonter un défi particulier"
      ]
    };

    // ✅ Suggestions personnalisées basées sur le profil
    const personalizedSuggestions = personalizeSuggestions(baseSuggestions, userProfile);
    setSuggestions(personalizedSuggestions);
  };

  const personalizeSuggestions = (suggestions, profile) => {
    if (!profile) return suggestions;

    const personalized = { ...suggestions };

    if (profile.passions?.includes('football')) {
      personalized.technique.push(
        "⚽ Démontrez votre geste technique préféré au football",
        "🎯 Expliquez votre stratégie lors d'un match important"
      );
    }

    if (profile.passions?.includes('éducation')) {
      personalized.conseils.push(
        "📖 Partagez votre méthode d'apprentissage préférée",
        "🎓 Donnez un conseil pour rester motivé dans l'apprentissage"
      );
    }

    return personalized;
  };

  const allSuggestions = Object.values(suggestions).flat();

  return (
    <div className="bg-gradient-to-br from-purple-900 to-blue-900 rounded-xl p-6 border border-purple-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white text-sm">🤖</span>
        </div>
        <div>
          <h3 className="font-semibold text-white">Assistant IA SpotBulle</h3>
          <p className="text-purple-200 text-sm">Sujets optimisés pour vous</p>
        </div>
      </div>

      {/* Catégories */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'technique', 'emotion', 'conseils'].map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1 rounded-full text-sm transition-all ${
              activeCategory === category
                ? 'bg-white text-purple-900 font-medium'
                : 'bg-purple-800 text-purple-200 hover:bg-purple-700'
            }`}
          >
            {category === 'all' && '✨ Tous'}
            {category === 'technique' && '⚙️ Technique'}
            {category === 'emotion' && '💫 Émotion'}
            {category === 'conseils' && '💡 Conseils'}
          </button>
        ))}
      </div>

      {/* Suggestions */}
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {(activeCategory === 'all' ? allSuggestions : suggestions[activeCategory] || []).map((suggestion, index) => (
          <div
            key={index}
            onClick={() => onSuggestionSelect(suggestion)}
            className="p-4 bg-purple-800/50 hover:bg-purple-700/50 rounded-lg border border-purple-600 cursor-pointer transition-all hover:scale-105 group"
          >
            <p className="text-purple-100 text-sm group-hover:text-white">{suggestion}</p>
            <div className="flex justify-between items-center mt-2">
              <span className="text-purple-300 text-xs">⏱️ 2 min max</span>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs">
                Utiliser →
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ✅ COMPOSANT PRINCIPAL : RecordVideo avancé
const AdvancedRecordVideo = ({ onVideoUploaded = () => {}, userProfile }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [videoMetadata, setVideoMetadata] = useState({
    title: '',
    description: '',
    tags: [],
    useAvatar: false,
    selectedSuggestion: null
  });

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const progressCheckRef = useRef(null);

  const {
    stream,
    recording,
    recordedBlob,
    error: mediaError,
    initializeCamera,
    startRecording,
    stopRecording,
    cleanup
  } = useMediaRecorder((blob, mimeType) => {
    // Callback appelé quand l'enregistrement est complet
    analyzeToneBasic();
  });

  // ✅ Initialisation
  useEffect(() => {
    initializeApp();
    return () => {
      cleanup();
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressCheckRef.current) clearInterval(progressCheckRef.current);
    };
  }, []);

  const initializeApp = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        toast.error('Authentification requise');
        navigate('/login');
        return;
      }
      setUser(user);
      await refreshSession();
      await initializeCamera();
      generateDefaultTitle();
    } catch (err) {
      console.error('❌ Initialisation échouée:', err);
    }
  };

  const generateDefaultTitle = () => {
    const now = new Date();
    const title = `Vidéo ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    setVideoMetadata(prev => ({ ...prev, title }));
  };

  // ✅ Gestion enregistrement
  const handleStartRecording = async () => {
    if (!stream) {
      toast.error('Caméra non disponible');
      return;
    }

    // Compte à rebours
    setCountdown(VIDEO_CONFIG.COUNTDOWN_DURATION);
    for (let i = VIDEO_CONFIG.COUNTDOWN_DURATION; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCountdown(i - 1);
    }

    try {
      await startRecording(stream);
      startRecordingTimer();
      toast.success('Enregistrement démarré ! 🎥');
    } catch (err) {
      toast.error('Erreur démarrage enregistrement');
    }
  };

  const startRecordingTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= VIDEO_CONFIG.MAX_RECORDING_TIME) {
          handleStopRecording();
          toast.warning('Temps maximum atteint ⏰');
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const handleStopRecording = () => {
    stopRecording();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    toast.success('Enregistrement terminé ! ✅');
  };

  // ✅ Upload et traitement
  const handleUpload = async () => {
    if (!recordedBlob || !user) {
      toast.error('Vidéo ou utilisateur manquant');
      return;
    }

    try {
      setUploading(true);
      
      // Upload vers Supabase Storage
      const fileName = `video-${Date.now()}.${recordedBlob.type.includes('mp4') ? 'mp4' : 'webm'}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, recordedBlob);
        
      if (uploadError) throw uploadError;

      // Récupération URL publique
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // Insertion en base de données
      const videoData = {
        title: videoMetadata.title,
        description: videoMetadata.description,
        file_path: filePath,
        storage_path: filePath,
        file_size: recordedBlob.size,
        duration: recordingTime,
        user_id: user.id,
        status: 'uploaded',
        use_avatar: videoMetadata.useAvatar,
        public_url: urlData.publicUrl,
        video_url: urlData.publicUrl,
        format: recordedBlob.type.includes('mp4') ? 'mp4' : 'webm',
        tags: videoMetadata.tags,
        ai_suggestion: videoMetadata.selectedSuggestion,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: video, error: dbError } = await supabase
        .from('videos')
        .insert(videoData)
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadedVideoId(video.id);
      toast.success('Vidéo uploadée avec succès ! 🚀');

      // Déclenchement transcription
      await triggerTranscription(video.id, user.id, urlData.publicUrl);
      
    } catch (err) {
      console.error('❌ Erreur upload:', err);
      toast.error('Échec de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const triggerTranscription = async (videoId, userId, videoUrl) => {
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: { videoId, userId, videoUrl }
      });
      if (error) throw error;
      startProgressTracking(videoId);
    } catch (err) {
      console.error('❌ Transcription échouée:', err);
    }
  };

  const startProgressTracking = (videoId) => {
    progressCheckRef.current = setInterval(async () => {
      try {
        const { data: video, error } = await supabase
          .from('videos')
          .select('status, analysis')
          .eq('id', videoId)
          .single();

        if (!error && video) {
          setAnalysisProgress(video.status);
          
          if (video.status === 'analyzed') {
            clearInterval(progressCheckRef.current);
            toast.success('Analyse IA terminée ! 🎉');
            onVideoUploaded();
            navigate(`/video-success?id=${videoId}`);
          } else if (video.status === 'failed') {
            clearInterval(progressCheckRef.current);
            toast.error('Échec de l\'analyse');
          }
        }
      } catch (err) {
        console.error('❌ Erreur suivi progression:', err);
      }
    }, 3000);
  };

  // ✅ Rendu principal
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* En-tête amélioré */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-french font-bold text-white mb-4">
            🎥 Studio SpotBulle
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Créez des vidéos authentiques avec l'assistance IA et connectez-vous à la communauté France-Maroc
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Colonne gauche : Caméra et contrôles */}
          <div className="xl:col-span-2 space-y-6">
            {/* Vue caméra */}
            <div className="bg-black rounded-2xl overflow-hidden aspect-video relative border-2 border-gray-700">
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-20">
                  <div className="text-white text-8xl font-bold animate-pulse">{countdown}</div>
                </div>
              )}
              
              {stream && (
                <video 
                  ref={videoRef}
                  srcObject={stream}
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
              
              {recording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="font-semibold">
                    {formatTime(recordingTime)} / {formatTime(VIDEO_CONFIG.MAX_RECORDING_TIME)}
                  </span>
                </div>
              )}

              {/* Overlay d'état */}
              {!stream && !mediaError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center text-gray-400">
                    <div className="w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p>Initialisation de la caméra...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Barre de progression et contrôles */}
            <div className="space-y-4">
              {/* Barre de progression temps */}
              <div className="bg-gray-800 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(recordingTime / VIDEO_CONFIG.MAX_RECORDING_TIME) * 100}%` 
                  }}
                ></div>
              </div>

              {/* Contrôles d'enregistrement */}
              <div className="flex justify-center gap-4">
                {!recordedBlob ? (
                  <>
                    <Button 
                      onClick={handleStartRecording}
                      disabled={recording || countdown > 0 || !stream}
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg rounded-full shadow-lg transition-all"
                    >
                      {recording ? '🔄 En cours...' : '● Commencer'}
                    </Button>
                    {recording && (
                      <Button 
                        onClick={handleStopRecording}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 text-lg rounded-full shadow-lg"
                      >
                        ■ Arrêter
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="flex gap-4">
                    <Button 
                      onClick={handleUpload}
                      disabled={uploading}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg rounded-full shadow-lg"
                    >
                      {uploading ? '📤 Envoi...' : '🚀 Publier la vidéo'}
                    </Button>
                    <Button 
                      onClick={() => {
                        cleanup();
                        setRecordingTime(0);
                        setVideoMetadata(prev => ({ ...prev, selectedSuggestion: null }));
                        initializeCamera();
                      }}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700 px-8 py-3 text-lg rounded-full"
                    >
                      🔄 Nouvelle prise
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Progression analyse */}
            {analysisProgress && (
              <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-xl p-4 border border-blue-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-300 font-medium">Analyse en cours...</span>
                  <span className="text-blue-400 text-sm">{analysisProgress}</span>
                </div>
                <div className="w-full bg-blue-800 rounded-full h-2">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full animate-pulse"></div>
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite : Paramètres et assistance */}
          <div className="space-y-6">
            {/* Assistant IA */}
            <RecordingAssistant 
              onSuggestionSelect={(suggestion) => setVideoMetadata(prev => ({
                ...prev,
                selectedSuggestion: suggestion,
                description: suggestion
              }))}
              userProfile={userProfile}
            />

            {/* Métadonnées vidéo */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="font-semibold text-white mb-4 text-lg">📝 Informations vidéo</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Titre de la vidéo
                  </label>
                  <input
                    type="text"
                    value={videoMetadata.title}
                    onChange={(e) => setVideoMetadata(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Donnez un titre percutant..."
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={videoMetadata.description}
                    onChange={(e) => setVideoMetadata(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Décrivez le contenu de votre vidéo..."
                    rows="3"
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Tags améliorés */}
                <TagInput 
                  tags={videoMetadata.tags}
                  setTags={(tags) => setVideoMetadata(prev => ({ ...prev, tags }))}
                />

                {/* Option avatar */}
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <input 
                    type="checkbox" 
                    checked={videoMetadata.useAvatar}
                    onChange={(e) => setVideoMetadata(prev => ({ ...prev, useAvatar: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-white">Utiliser l'avatar IA</span>
                    <p className="text-gray-400 text-sm">Remplacer votre visage par un avatar animé</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conseils contextuels */}
            <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-xl p-4 border border-orange-700">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💡</span>
                <span className="font-semibold text-white">Conseils du coach IA</span>
              </div>
              <ul className="text-orange-100 text-sm space-y-2">
                <li>• Parlez face à la lumière naturelle</li>
                <li>• Maintenez un débit modéré et clair</li>
                <li>• Souriez pour une communication positive</li>
                <li>• Utilisez des gestes naturels pour appuyer vos propos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ FONCTIONS UTILITAIRES
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getCameraErrorMessage = (error) => {
  switch (error.name) {
    case 'NotAllowedError':
      return 'Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres de votre navigateur.';
    case 'NotFoundError':
      return 'Aucune caméra détectée. Vérifiez votre matériel.';
    case 'NotSupportedError':
      return 'Votre navigateur ne supporte pas l\'enregistrement vidéo.';
    default:
      return 'Erreur d\'accès à la caméra. Vérifiez les permissions.';
  }
};

const analyzeToneBasic = () => {
  // Simulation d'analyse de tonalité
  return {
    confidence: 0.85,
    emotion: 'enthousiaste',
    pace: 'modéré',
    clarity: 'bonne',
    suggestions: [
      'Excellent enthousiasme dans votre communication !',
      'Le débit est parfaitement équilibré pour la compréhension',
      'Continuez à sourire pour maintenir une énergie positive'
    ]
  };
};

export default AdvancedRecordVideo;
