import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';

const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing',
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
};

const TagInput = ({ tags, setTags }) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag) => {
    const cleanTag = tag.trim().toLowerCase();
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags(prev => [...prev, cleanTag]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  const suggestedTags = ['football', 'sport', 'passion', 'technique', 'entrainement', 'match', 'jeune', 'adolescent', 'adulte', 'expression'];

  return (
    <div className="space-y-3">
      <label className="block font-semibold text-white">
        🏷️ Mots-clés (pour les rapprochements)
      </label>
      
      <div className="flex flex-wrap gap-2 p-3 bg-gray-700 border border-gray-600 rounded-lg min-h-[50px]">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-red-300 text-xs"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "sport, passion, technique..." : "Ajouter un mot-clé"}
          className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 min-w-[120px]"
        />
      </div>
      
      <div className="text-xs text-gray-400">
        💡 Ajoutez des mots-clés pertinents pour retrouver facilement vos vidéos et faire des rapprochements automatiques.
        Appuyez sur Entrée ou tapez une virgule pour ajouter.
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-400">Suggestions rapides :</span>
        {suggestedTags.map(suggestion => (
          <button
            key={suggestion}
            type="button"
            onClick={() => addTag(suggestion)}
            disabled={tags.includes(suggestion)}
            className={`text-xs px-2 py-1 rounded transition-all ${
              tags.includes(suggestion)
                ? 'bg-blue-600 text-white cursor-not-allowed'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

const RecordVideo = ({ onVideoUploaded = () => {} }) => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useAvatar, setUseAvatar] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [toneAnalysis, setToneAnalysis] = useState(null);
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  useEffect(() => {
    return () => {
      if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [recordedVideo]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          toast.error('Vous devez être connecté pour enregistrer une vidéo.');
          navigate('/login');
          return;
        }
        setUser(user);
        await refreshSession();
        await requestCameraAccess();
        
        setTitle(`Vidéo ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
        
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
        }
      }
    };
    initialize();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxRecordingTime) {
            stopRecording();
            toast.warning('Temps d\'enregistrement maximum atteint.');
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!uploadedVideoId) return;

    let intervalId;
    const checkProgress = async () => {
      try {
        const { data: video, error } = await supabase
          .from('videos')
          .select('status, analysis, ai_result')
          .eq('id', uploadedVideoId)
          .single();
        if (error) throw error;
        if (video.status === VIDEO_STATUS.ANALYZED) {
          setAnalysisProgress(VIDEO_STATUS.ANALYZED);
          toast.success('Analyse terminée avec succès !');
          clearInterval(intervalId);
          onVideoUploaded();
          navigate(`/video-success?id=${uploadedVideoId}`);
        } else if (video.status === VIDEO_STATUS.FAILED) {
          setAnalysisProgress(VIDEO_STATUS.FAILED);
          setError('L\'analyse de la vidéo a échoué.');
          clearInterval(intervalId);
        } else {
          setAnalysisProgress(video.status);
        }
      } catch (err) {
        console.error('❌ Erreur vérification progression:', err);
      }
    };
    intervalId = setInterval(checkProgress, 3000);
    checkProgress();
    return () => clearInterval(intervalId);
  }, [uploadedVideoId, navigate, onVideoUploaded]);

  const getProgressMessage = (status) => {
    const messages = {
      [VIDEO_STATUS.UPLOADED]: 'Vidéo téléchargée',
      [VIDEO_STATUS.PROCESSING]: 'Traitement de la vidéo',
      [VIDEO_STATUS.TRANSCRIBED]: 'Transcription en cours',
      [VIDEO_STATUS.ANALYZING]: 'Analyse du contenu et de la tonalité',
      [VIDEO_STATUS.ANALYZED]: 'Analyse terminée'
    };
    return messages[status] || 'Traitement en cours';
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const setupAudioAnalysis = (stream) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const analyzeAudio = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average / 256);
        requestAnimationFrame(analyzeAudio);
      };
      analyzeAudio();
    } catch (err) {
      console.warn('⚠️ Analyse audio non supportée:', err);
    }
  };

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          facingMode: 'user'
        },
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true
        },
      });

      streamRef.current = stream;
      setCameraAccess(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setupAudioAnalysis(stream);
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      toast.error('Accès caméra refusé.');
    }
  };

  const startRecording = async () => {
    if (!cameraAccess) {
      setError('Veuillez autoriser l\'accès à la caméra.');
      toast.error('Accès caméra requis.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError('L\'enregistrement vidéo n\'est pas supporté sur votre navigateur. Essayez Chrome ou Firefox.');
      toast.error('Enregistrement non supporté');
      return;
    }

    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCountdown(i - 1);
    }
    try {
      recordedChunksRef.current = [];
      
      let mimeType = 'video/webm';
      if (isIOS) {
        mimeType = 'video/mp4';
      } else {
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
          mimeType = 'video/webm; codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        }
      }
      
      console.log('📹 Format sélectionné:', mimeType, 'iOS:', isIOS);

      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType,
        videoBitsPerSecond: 2500000
      });
      
      mediaRecorderRef.current.onerror = (event) => {
        console.error('❌ Erreur MediaRecorder:', event.error);
        setError(`Erreur enregistrement: ${event.error.name}`);
        setRecording(false);
      };
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({
          url,
          blob,
          duration: recordingTime,
          format: mimeType.includes('mp4') ? 'mp4' : 'webm'
        });
        analyzeToneBasic();
      };
      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setRecordingTime(0);
      toast.success('Enregistrement démarré !');
    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      if (isIOS) {
        setError('Enregistrement non supporté sur Safari iOS. Utilisez l\'application Chrome.');
      } else {
        setError('Erreur lors du démarrage de l'enregistrement.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      toast.success('Enregistrement terminé !');
    }
  };

  const analyzeToneBasic = () => {
    const mockToneAnalysis = {
      confidence: 0.85,
      emotion: 'enthousiaste',
      pace: 'modéré',
      clarity: 'bonne',
      suggestions: [
        'Excellent enthousiasme !',
        'Le débit est bien équilibré',
        'Continuez à sourire pour maintenir l\'énergie'
      ]
    };
    setToneAnalysis(mockToneAnalysis);
  };

  // ✅ CORRECTION PRINCIPALE : Upload simplifié et robuste
  const uploadVideo = async () => {
    if (!recordedVideo) {
      setError('Vous devez enregistrer une vidéo.');
      toast.error('Aucune vidéo à uploader.');
      return;
    }

    if (!user) {
      setError('Vous devez être connecté pour uploader une vidéo.');
      toast.error('Utilisateur non connecté');
      return;
    }
    
    try {
      setUploading(true);
      setError(null);
      
      // ✅ 1. Upload direct vers Supabase Storage
      const fileName = `video-${Date.now()}.${recordedVideo.format === 'mp4' ? 'mp4' : 'webm'}`;
      const filePath = `${user.id}/${fileName}`;
      
      console.log('📤 Upload du fichier vers:', filePath);
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, recordedVideo.blob);
        
      if (uploadError) {
        throw new Error(`Erreur upload storage: ${uploadError.message}`);
      }
      
      console.log('✅ Fichier uploadé avec succès');
      
      // ✅ 2. Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);
        
      // ✅ 3. Structure de données simplifiée et robuste
      const videoInsertData = {
        title: title || `Vidéo ${new Date().toLocaleDateString('fr-FR')}`,
        description: description || 'Vidéo enregistrée depuis la caméra',
        file_path: filePath,
        file_size: recordedVideo.blob.size,
        duration: Math.round(recordingTime),
        user_id: user.id,
        status: VIDEO_STATUS.UPLOADED,
        public_url: urlData.publicUrl,
        format: recordedVideo.format,
        tags: tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('📝 Données à insérer:', videoInsertData);
      
      // ✅ 4. Insertion avec gestion d'erreur améliorée
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert(videoInsertData)
        .select()
        .single();
        
      if (videoError) {
        console.error('❌ Erreur insertion vidéo:', videoError);
        throw new Error(`Erreur création vidéo: ${videoError.message}`);
      }
      
      console.log('✅ Vidéo créée en base:', videoData.id);
      setUploadedVideoId(videoData.id);
      toast.success('Vidéo uploadée avec succès !');
      
      // ✅ 5. Déclencher la transcription avec gestion d'erreur
      await triggerTranscription(videoData.id, user.id, urlData.publicUrl);
      
    } catch (err) {
      console.error('❌ Erreur upload:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      toast.error('Échec de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  // ✅ CORRECTION : Fonction transcription simplifiée
  const triggerTranscription = async (videoId, userId, videoPublicUrl) => {
    try {
      console.log('🚀 Déclenchement transcription avec URL:', videoPublicUrl);
      
      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: {
          videoId,
          userId,
          videoUrl: videoPublicUrl
        }
      });
      
      if (error) {
        console.error('❌ Erreur invocation transcription:', error);
        throw new Error(`Erreur transcription: ${error.message}`);
      }
      
      console.log('✅ Transcription lancée:', data);
      toast.success('Transcription en cours...');
      
    } catch (err) {
      console.error('❌ Erreur triggerTranscription:', err);
      // Ne pas bloquer le flux en cas d'erreur de transcription
      toast.warning('La vidéo a été uploadée mais la transcription a échoué.');
    }
  };

  const retryRecording = () => {
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    setRecordedVideo(null);
    setError(null);
    setAnalysisProgress(null);
    setUploadedVideoId(null);
    setRecordingTime(0);
    setTags([]);
    setToneAnalysis(null);
    setAudioLevel(0);
    setTitle(`Vidéo ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
    setDescription('');
    stopStream();
    requestCameraAccess();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-french font-bold text-white mb-4">
            🎥 Enregistrez votre vidéo SpotBulle
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Partagez votre passion et connectez-vous avec la communauté
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                  <div className="text-white text-6xl font-bold">{countdown}</div>
                </div>
              )}
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover" 
              />
              {recording && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="font-semibold">{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>
            
            <div className="bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-100" 
                style={{ width: `${audioLevel * 100}%` }}
              ></div>
            </div>
            
            <div className="flex gap-4 justify-center">
              {!recordedVideo ? (
                <>
                  <Button 
                    onClick={startRecording}
                    disabled={recording || !cameraAccess || countdown > 0}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {recording ? '🔄 Enregistrement...' : '● Commencer'}
                  </Button>
                  {recording && (
                    <Button 
                      onClick={stopRecording}
                      className="bg-gray-600 hover:bg-gray-700 text-white"
                    >
                      ■ Arrêter
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex gap-4">
                  <Button 
                    onClick={uploadVideo}
                    disabled={uploading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {uploading ? '📤 Upload...' : '📤 Uploader la vidéo'}
                  </Button>
                  <Button onClick={retryRecording} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    🔄 Réessayer
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="card-spotbulle-dark p-4">
              <label className="block font-semibold text-white mb-2">
                📝 Titre de la vidéo
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Donnez un titre à votre vidéo..."
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400"
              />
              
              <label className="block font-semibold text-white mb-2 mt-4">
                📄 Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le contenu de votre vidéo..."
                rows="3"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none"
              />
            </div>
            
            <div className="card-spotbulle-dark p-4">
              <TagInput tags={tags} setTags={setTags} />
            </div>

            <div className="card-spotbulle-dark p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={useAvatar}
                  onChange={(e) => setUseAvatar(e.target.checked)}
                  className="w-4 h-4" 
                />
                <span className="font-medium text-white">Utiliser un avatar virtuel</span>
              </label>
            </div>
            
            {toneAnalysis && (
              <div className="card-spotbulle-dark p-4">
                <h3 className="font-semibold mb-3 text-white">🎵 Analyse de tonalité</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <div><strong>Émotion:</strong> {toneAnalysis.emotion}</div>
                  <div><strong>Débit:</strong> {toneAnalysis.pace}</div>
                  <div><strong>Clarté:</strong> {toneAnalysis.clarity}</div>
                  <div className="mt-3">
                    <strong>Suggestions:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {toneAnalysis.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {analysisProgress && (
              <div className="card-spotbulle-dark p-4">
                <h3 className="font-semibold mb-2 text-white">📊 Progression</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>{getProgressMessage(analysisProgress)}</span>
                    <span>{analysisProgress === VIDEO_STATUS.ANALYZED ? '✅' : '🔄'}</span>
                  </div>
                  {analysisProgress === VIDEO_STATUS.FAILED && (
                    <p className="text-red-400 text-sm">{error}</p>
                  )}
                </div>
              </div>
            )}
            
            {error && !analysisProgress && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 card-spotbulle-dark p-4">
          <h3 className="font-semibold mb-3 text-white">💡 Conseils pour un bon enregistrement</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
            <li>Parlez clairement et à un rythme modéré</li>
            <li>Utilisez un fond neutre et un bon éclairage</li>
            <li>Souriez et soyez naturel</li>
            <li>2 minutes maximum pour garder l'attention</li>
            <li>Ajoutez des mots-clés pertinents pour être mieux découvert</li>
            <li>Les mots-clés permettent des rapprochements automatiques entre vos vidéos</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RecordVideo;
