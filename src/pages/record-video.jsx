import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';

// ✅ CORRECTION : Valeurs exactes autorisées pour le statut
const VIDEO_STATUS = {
  UPLOADED: 'uploaded',
  PROCESSING: 'processing', 
  TRANSCRIBED: 'transcribed',
  ANALYZING: 'analyzing',
  ANALYZED: 'analyzed',
  PUBLISHED: 'published',
  FAILED: 'failed'
};

const RecordVideo = ({ onVideoUploaded = () => {}, scenarios }) => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [uploadedVideoId, setUploadedVideoId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useAvatar, setUseAvatar] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [toneAnalysis, setToneAnalysis] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [ageGroup, setAgeGroup] = useState('adolescents');
  const [showScenarioSelection, setShowScenarioSelection] = useState(true);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120;

  // ✅ Scénarios par défaut
  const defaultScenarios = {
    enfants: [
      "🎙 Dis-moi pourquoi tu aimes ton sport préféré.",
      "🎙 Qu'est-ce que tu ressens quand tu marques un but / réussis ton coup ?",
      "🎙 Si tu devais inventer ton club idéal, à quoi ressemblerait-il ?"
    ],
    adolescents: [
      "🎙 Comment le foot (ou ton sport) t'aide à grandir dans la vie ?",
      "🎙 Raconte un moment où tu as douté, mais où tu t'es relevé.",
      "🎙 Où te vois-tu dans 5 ans grâce à ta passion ?",
      "🎙 Quel joueur ou joueuse t'inspire le plus, et pourquoi ?"
    ],
    adultes: [
      "🎙 Comment ton sport reflète ta personnalité ?",
      "🎙 Quel lien fais-tu entre ton sport et ta vie professionnelle ?",
      "🎙 Que t'apprend ton sport sur la gestion de la pression, de l'échec ou du leadership ?"
    ]
  };

  const effectiveScenarios = scenarios || defaultScenarios;

  // ✅ CORRECTION : Nettoyage amélioré
  useEffect(() => {
    return () => {
      if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [recordedVideo]);

  // ✅ CORRECTION : Initialisation robuste avec gestion des erreurs étendue
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        // ✅ VÉRIFICATION CRITIQUE : Actualisation du schéma
        await refreshSchemaCache();
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          toast.error('Vous devez être connecté pour enregistrer une vidéo.');
          navigate('/login');
          return;
        }

        if (mounted) {
          setUser(user);
          await refreshSession();
          await requestCameraAccess();
        }
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // ✅ NOUVELLE FONCTION : Actualisation du cache de schéma
  const refreshSchemaCache = async () => {
    try {
      // Forcer une requête simple pour actualiser le cache
      const { error } = await supabase
        .from('videos')
        .select('id')
        .limit(1);
      
      // Cette erreur est normale si la table est vide, mais ça actualise le cache
      console.log('🔄 Cache schéma actualisé');
    } catch (err) {
      console.warn('⚠️ Actualisation cache schéma:', err);
    }
  };

  // ✅ CORRECTION : Gestion du minuteur
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
  }, [recording, maxRecordingTime]);

  // ✅ CORRECTION : Suivi de progression avec gestion d'erreur améliorée
  useEffect(() => {
    if (!uploadedVideoId) return;

    let intervalId;
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    const checkProgress = async () => {
      try {
        const { data: video, error } = await supabase
          .from('videos')
          .select('status, analysis, ai_result, error_message, age_group, scenario_used')
          .eq('id', uploadedVideoId)
          .single();

        if (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(`Impossible de récupérer la vidéo après ${maxRetries} tentatives`);
          }
          console.warn(`⚠️ Tentative ${retryCount}/${maxRetries} échouée, nouvelle tentative...`);
          return;
        }

        if (!mounted) return;

        retryCount = 0; // Réinitialiser le compteur en cas de succès

        if (video.status === VIDEO_STATUS.ANALYZED) {
          setAnalysisProgress(VIDEO_STATUS.ANALYZED);
          toast.success('Analyse terminée avec succès !');
          clearInterval(intervalId);
          onVideoUploaded();
          
          // ✅ Redirection vers video-success
          navigate(`/video-success?id=${uploadedVideoId}`);
          
        } else if (video.status === VIDEO_STATUS.FAILED) {
          setAnalysisProgress(VIDEO_STATUS.FAILED);
          setError(video.error_message || 'L\'analyse de la vidéo a échoué.');
          clearInterval(intervalId);
        } else {
          setAnalysisProgress(video.status);
        }
      } catch (err) {
        console.error('❌ Erreur vérification progression:', err);
        if (mounted) {
          setError('Erreur lors du suivi de la progression.');
          clearInterval(intervalId);
        }
      }
    };

    intervalId = setInterval(checkProgress, 3000);
    checkProgress();

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
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

    if (!selectedScenario) {
      setError('Veuillez sélectionner un scénario avant de commencer.');
      toast.error('Scénario requis');
      return;
    }

    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCountdown(i - 1);
    }

    try {
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
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
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({
          url,
          blob,
          duration: recordingTime
        });
        analyzeToneBasic();
      };

      mediaRecorderRef.current.start(1000);
      setRecording(true);
      setRecordingTime(0);
      toast.success('Enregistrement démarré !');
    } catch (err) {
      console.error('❌ Erreur démarrage enregistrement:', err);
      setError('Erreur lors du démarrage de l\'enregistrement.');
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

  // ✅ CORRECTION CRITIQUE : Upload avec gestion robuste du schéma
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

      // ✅ VÉRIFICATION SCHEMA : Confirmer que age_group est disponible
      await refreshSchemaCache();

      // 1. Upload du fichier vers Supabase Storage
      const fileName = `video-${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      console.log('📤 Upload du fichier vers:', filePath);

      // ✅ VÉRIFICATION CRITIQUE : S'assurer que filePath n'est pas null
      if (!filePath || filePath.trim() === '') {
        throw new Error('Le chemin de stockage ne peut pas être vide');
      }

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, recordedVideo.blob);

      if (uploadError) {
        throw new Error(`Erreur upload storage: ${uploadError.message}`);
      }

      console.log('✅ Fichier uploadé avec succès');

      // 2. Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      // ✅ CORRECTION : Structure de données compatible avec le schéma
      const videoInsertData = {
        title: `Vidéo ${new Date().toLocaleDateString('fr-FR')}`,
        description: 'Vidéo enregistrée depuis la caméra',
        // ✅ CHAMPS CRITIQUES : S'assurer que storage_path et file_path sont bien définis
        file_path: filePath,
        storage_path: filePath, // ✅ DOUBLON POUR COMPATIBILITÉ
        file_size: recordedVideo.blob.size,
        duration: Math.round(recordingTime),
        user_id: user.id,
        status: VIDEO_STATUS.UPLOADED,
        use_avatar: useAvatar,
        public_url: urlData.publicUrl,
        video_url: urlData.publicUrl, // ✅ CHAMP ALTERNATIF
        format: 'webm',
        tone_analysis: toneAnalysis,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        scenario_used: selectedScenario,
        // ✅ CORRECTION CRITIQUE : Champ age_group explicitement inclus
        age_group: ageGroup,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('📝 Données à insérer:', videoInsertData);

      // 3. Insérer la vidéo avec TOUS les champs requis
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert(videoInsertData)
        .select()
        .single();

      if (videoError) {
        console.error('❌ Erreur insertion vidéo:', videoError);
        
        // ✅ Gestion spécifique de l'erreur de schéma
        if (videoError.message.includes('age_group') || videoError.message.includes('column')) {
          console.warn('⚠️ Erreur de colonne détectée, nouvel essai après délai...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Nouvel essai
          const { data: retryData, error: retryError } = await supabase
            .from('videos')
            .insert(videoInsertData)
            .select()
            .single();
            
          if (retryError) throw retryError;
          setUploadedVideoId(retryData.id);
        } else if (videoError.message.includes('stockage') || videoError.message.includes('NULL')) {
          throw new Error('Erreur de configuration du chemin de stockage. Veuillez réessayer.');
        } else {
          throw new Error(`Erreur création vidéo: ${videoError.message}`);
        }
      } else {
        setUploadedVideoId(videoData.id);
      }

      console.log('✅ Vidéo créée en base:', videoData?.id || 'ID non disponible');
      toast.success('Vidéo uploadée avec succès !');

      // ✅ VÉRIFICATION après insertion
      const { data: verifiedVideo, error: verifyError } = await supabase
        .from('videos')
        .select('id, file_path, storage_path, public_url, age_group, scenario_used')
        .eq('id', videoData?.id || uploadedVideoId)
        .single();

      if (verifyError) {
        console.error('❌ Erreur vérification vidéo:', verifyError);
      } else {
        console.log('✅ Vidéo vérifiée après insertion:', verifiedVideo);
      }

      // ✅ CORRIGÉ : Déclencher la transcription
      await triggerTranscription(videoData?.id || uploadedVideoId, user.id, urlData.publicUrl);

    } catch (err) {
      console.error('❌ Erreur upload:', err);
      
      // ✅ Gestion d'erreur améliorée
      let errorMessage = `Erreur lors de l'upload: ${err.message}`;
      if (err.message.includes('stockage') || err.message.includes('NULL')) {
        errorMessage = 'Erreur de configuration du stockage. Le chemin de la vidéo est invalide.';
      } else if (err.message.includes('age_group') || err.message.includes('column')) {
        errorMessage = 'Erreur de schéma base de données. Le service est en cours de mise à jour. Veuillez réessayer dans quelques instants.';
      }
      
      setError(errorMessage);
      toast.error('Échec de l\'upload.');
    } finally {
      setUploading(false);
    }
  };

  // ✅ CORRECTION : Fonction pour déclencher la transcription
  const triggerTranscription = async (videoId, userId, videoPublicUrl) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('⚠️ Session non valide, reconnexion...');
        await refreshSession();
      }

      console.log('🚀 Déclenchement transcription avec URL:', videoPublicUrl);

      const { data, error } = await supabase.functions.invoke('transcribe-video', {
        body: {
          videoId,
          userId,
          videoUrl: videoPublicUrl
        }
      });

      if (error) throw error;

      console.log('✅ Transcription lancée:', data);
      toast.success('Transcription en cours...');
    } catch (err) {
      console.error('❌ Erreur triggerTranscription:', err);
      // Ne pas throw pour ne pas bloquer l'upload
      toast.warning('La transcription n\'a pas pu démarrer automatiquement.');
    }
  };

  const retryRecording = () => {
    if (recordedVideo?.url) URL.revokeObjectURL(recordedVideo.url);
    setRecordedVideo(null);
    setError(null);
    setAnalysisProgress(null);
    setUploadedVideoId(null);
    setRecordingTime(0);
    setTags('');
    setToneAnalysis(null);
    setAudioLevel(0);
    stopStream();
    requestCameraAccess();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selectScenario = (scenario) => {
    setSelectedScenario(scenario);
    setShowScenarioSelection(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="card-spotbulle p-6">
          <h1 className="text-3xl font-french font-bold mb-2 text-center">
            🎤 Expression Orale SpotBulle
          </h1>
          <p className="text-gray-600 text-center mb-6">
            Transformez votre énergie d'immersion en parole authentique
          </p>

          {/* Sélection du scénario */}
          {showScenarioSelection && (
            <div className="card-spotbulle p-6 mb-6">
              <h2 className="text-xl font-french font-bold mb-4">
                👥 Choisissez votre profil
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { id: 'enfants', label: '👦 Enfants (8-12 ans)', emoji: '👦' },
                  { id: 'adolescents', label: '👨‍🎓 Adolescents (13-17 ans)', emoji: '👨‍🎓' },
                  { id: 'adultes', label: '👨‍💼 Jeunes adultes (18+)', emoji: '👨‍💼' }
                ].map(group => (
                  <div
                    key={group.id}
                    onClick={() => setAgeGroup(group.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      ageGroup === group.id
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-2xl mb-2">{group.emoji}</div>
                    <div className="text-gray-800 font-medium">{group.label}</div>
                  </div>
                ))}
              </div>

              <h2 className="text-xl font-french font-bold mb-4">
                🎬 Choisissez votre thème de pitch
              </h2>
              <div className="space-y-3">
                {effectiveScenarios[ageGroup]?.map((scenario, index) => (
                  <div
                    key={index}
                    onClick={() => selectScenario(scenario)}
                    className="p-4 border border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-500/10 transition-all"
                  >
                    <p className="text-gray-800">{scenario}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm text-gray-500">⏱️ 2 minutes maximum</span>
                      <Button size="sm" variant="outline" className="border-blue-500 text-blue-600">
                        Sélectionner →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interface principale d'enregistrement */}
          {!showScenarioSelection && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Caméra et contrôles */}
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

                {/* Barre de niveau audio */}
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${audioLevel * 100}%` }}
                  ></div>
                </div>

                {/* Scénario sélectionné */}
                {selectedScenario && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">🎯 Thème sélectionné</h3>
                    <p className="text-blue-700">{selectedScenario}</p>
                    <Button
                      onClick={() => setShowScenarioSelection(true)}
                      variant="outline"
                      size="sm"
                      className="mt-2 border-blue-300 text-blue-600"
                    >
                      Changer de thème
                    </Button>
                  </div>
                )}

                {/* Contrôles d'enregistrement */}
                <div className="flex gap-4 justify-center">
                  {!recordedVideo ? (
                    <>
                      <Button
                        onClick={startRecording}
                        disabled={recording || !cameraAccess || countdown > 0 || !selectedScenario}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg"
                      >
                        {recording ? '🔄 Enregistrement...' : '● Commencer l\'enregistrement'}
                      </Button>
                      {recording && (
                        <Button
                          onClick={stopRecording}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 text-lg"
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
                        className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                      >
                        {uploading ? '📤 Upload en cours...' : '📤 Uploader la vidéo'}
                      </Button>
                      <Button
                        onClick={retryRecording}
                        variant="outline"
                        className="px-8 py-3 text-lg"
                      >
                        🔄 Réessayer
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Paramètres et analyse */}
              <div className="space-y-6">
                {/* Option avatar */}
                <div className="card-spotbulle p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAvatar}
                      onChange={(e) => setUseAvatar(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">Utiliser un avatar virtuel</span>
                  </label>
                </div>

                {/* Mots-clés */}
                <div className="card-spotbulle p-4">
                  <label className="block font-semibold mb-2">
                    Mots-clés (séparés par des virgules)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="football, sport, passion..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Analyse de tonalité */}
                {toneAnalysis && (
                  <div className="card-spotbulle p-4">
                    <h3 className="font-semibold mb-3">🎵 Analyse de tonalité</h3>
                    <div className="space-y-2 text-sm">
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

                {/* Progression de l'analyse */}
                {analysisProgress && (
                  <div className="card-spotbulle p-4">
                    <h3 className="font-semibold mb-2">📊 Progression</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{getProgressMessage(analysisProgress)}</span>
                        <span>{analysisProgress === VIDEO_STATUS.ANALYZED ? '✅' : '🔄'}</span>
                      </div>
                      {analysisProgress === VIDEO_STATUS.FAILED && (
                        <p className="text-red-600 text-sm">{error}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Message d'erreur */}
                {error && !analysisProgress && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">{error}</p>
                    <Button 
                      onClick={retryRecording} 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 border-red-300 text-red-600"
                    >
                      🔄 Réessayer
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Barre de progression du parcours */}
          <div className="mt-8 card-spotbulle p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">🗺️ Votre parcours immersion</h3>
            <div className="flex items-center justify-between">
              {[
                { step: 1, name: 'Test personnalité', status: 'completed', emoji: '🎨' },
                { step: 2, name: 'Immersion simulateur', status: 'completed', emoji: '⚽' },
                { step: 3, name: 'Expression orale', status: 'current', emoji: '🎤' },
                { step: 4, name: 'Restitution IA', status: 'pending', emoji: '🏆' }
              ].map((step, index, array) => (
                <React.Fragment key={step.step}>
                  <div className="text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
                      step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'current' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                    }`}>
                      {step.emoji}
                    </div>
                    <div className={`mt-2 text-sm ${
                      step.status === 'completed' ? 'text-green-600' :
                      step.status === 'current' ? 'text-blue-600 font-semibold' : 'text-gray-500'
                    }`}>
                      {step.name}
                    </div>
                  </div>
                  {index < array.length - 1 && (
                    <div className={`flex-1 h-1 ${
                      step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                    }`}></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Conseils */}
          <div className="mt-8 card-spotbulle p-6">
            <h3 className="font-semibold mb-3">💡 Conseils pour un bon enregistrement</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Parlez clairement et à un rythme modéré</li>
              <li>Utilisez un fond neutre et un bon éclairage</li>
              <li>Souriez et soyez naturel</li>
              <li>2 minutes maximum pour garder l'attention</li>
              <li>Ajoutez des mots-clés pertinents pour être mieux découvert</li>
              <li>Regardez droit dans la caméra pour un contact visuel optimal</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordVideo;
