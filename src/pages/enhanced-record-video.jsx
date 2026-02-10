import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced';
import { supabase } from '../lib/supabase';
import ProfessionalHeader from '../components/ProfessionalHeader';
import { 
  Video, Mic, MicOff, Camera, CameraOff, 
  RefreshCw, Upload, CheckCircle2, AlertCircle, 
  Loader2, Play, Square, Tag, Sparkles, MessageSquare
} from 'lucide-react';

const EnhancedRecordVideo = ({ user, profile, onSignOut, onVideoUploaded, embedInOdyssey = false }) => {
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [useAvatar, setUseAvatar] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [toneAnalysis, setToneAnalysis] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState("🎙 Raconte un moment où tu as douté, mais où tu t'es relevé.");
  const [showScenarioSelection, setShowScenarioSelection] = useState(false);
  const [ageGroup, setAgeGroup] = useState('adolescents');
  
  // Speech-to-Text states
  const [transcription, setTranscription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const navigate = useNavigate();
  const maxRecordingTime = 120;

  const scenarios = {
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

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscription(prev => prev + finalTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    } else {
      console.warn('Speech Recognition API not supported in this browser.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
      stopStream();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [recordedVideo]);

  useEffect(() => {
    let mounted = true;
    const initializeCamera = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Veuillez vous connecter pour enregistrer une vidéo.');
          navigate('/login');
          return;
        }
        await requestCameraAccess();
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        if (mounted) {
          setError('Erreur lors de l\'initialisation de la caméra.');
          toast.error('Impossible d\'accéder à la caméra.');
        }
      }
    };
    initializeCamera();
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

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
      setCameraAccess(false);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const requestCameraAccess = async () => {
    try {
      setError(null);
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => resolve();
        });
        await videoRef.current.play();
        setCameraAccess(true);
      }
      setupAudioAnalysis(stream);
    } catch (err) {
      console.error('❌ Erreur accès caméra:', err);
      setError('Impossible d\'accéder à la caméra. Vérifiez vos autorisations.');
      setCameraAccess(false);
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
        if (!analyserRef.current || !recording) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        setAudioLevel(sum / bufferLength / 255);
        if (recording) requestAnimationFrame(analyzeAudio);
      };
      if (recording) analyzeAudio();
    } catch (err) { console.warn('⚠️ Analyse audio non disponible:', err); }
  };

  const startRecording = async () => {
    if (!cameraAccess || !streamRef.current) {
      await requestCameraAccess();
      if (!cameraAccess) return;
    }
    setCountdown(3);
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(0);
    setRecording(true);
    setRecordingTime(0);
    setTranscription('');
    recordedChunksRef.current = [];
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) { console.error('Speech start error:', e); }
    }

    try {
      const options = { mimeType: 'video/webm; codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = 'video/webm';
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: options.mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideo({ blob, url, duration: recordingTime });
      };
      mediaRecorderRef.current.start();
    } catch (err) {
      console.error('❌ Erreur enregistrement:', err);
      setRecording(false);
      setIsListening(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const uploadVideo = async () => {
    if (!recordedVideo) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fileName = `${session.user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from('videos').upload(fileName, recordedVideo.blob);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);
      const { data: videoData, error: videoError } = await supabase.from('videos').insert({
        user_id: session.user.id,
        title: `Odyssée - ${new Date().toLocaleDateString()}`,
        video_url: publicUrl,
        storage_path: fileName,
        duration: recordedVideo.duration,
        transcription_text: transcription,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        status: 'uploaded',
        use_avatar: useAvatar,
        scenario_used: selectedScenario
      }).select().single();
      if (videoError) throw videoError;
      toast.success('Vidéo et transcription enregistrées !');
      if (onVideoUploaded) onVideoUploaded();
      if (!embedInOdyssey) navigate(`/video-success?id=${videoData.id}`);
    } catch (err) {
      toast.error('Erreur lors de l\'upload.');
    } finally { setUploading(false); }
  };

  const retryRecording = () => {
    setRecordedVideo(null);
    setTranscription('');
    requestCameraAccess();
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const content = (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar: Scénario & Transcription */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="text-teal-400 w-5 h-5" /> Thème Actif
            </h3>
            <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4 mb-4">
              <p className="text-teal-50 text-sm leading-relaxed italic">"{selectedScenario}"</p>
            </div>
            <Button 
              onClick={() => setShowScenarioSelection(true)}
              className="w-full bg-white/5 hover:bg-white/10 text-teal-400 border-white/10 rounded-xl py-2 text-sm"
            >
              Changer de thème
            </Button>
          </div>

          <div className="glass-card p-6 rounded-3xl border-white/10 min-h-[200px] flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="text-teal-400 w-5 h-5" /> Transcription Live
            </h3>
            <div className="flex-1 bg-black/20 rounded-2xl p-4 overflow-y-auto max-h-[300px] custom-scrollbar">
              {transcription ? (
                <p className="text-teal-50/80 text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                  {transcription}
                  {isListening && <span className="inline-block w-1 h-4 bg-teal-400 ml-1 animate-pulse" />}
                </p>
              ) : (
                <p className="text-white/20 text-sm italic text-center mt-8">
                  {recording ? "Écoute en cours..." : "La transcription apparaîtra ici pendant l'enregistrement."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main: Video Recorder */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-4 rounded-[2rem] border-white/10 shadow-2xl relative overflow-hidden">
            {countdown > 0 && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 rounded-[2rem]">
                <div className="text-teal-400 text-9xl font-bold animate-ping">{countdown}</div>
              </div>
            )}

            <div className="bg-black/40 rounded-[1.5rem] overflow-hidden aspect-video relative group">
              {!recordedVideo ? (
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              ) : (
                <video src={recordedVideo.url} controls className="w-full h-full object-cover" />
              )}

              {!cameraAccess && !recordedVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
                  <div className="text-center p-8">
                    <CameraOff className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white font-medium mb-4">Accès caméra requis</p>
                    <Button onClick={requestCameraAccess} className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl px-6">
                      Activer la caméra
                    </Button>
                  </div>
                </div>
              )}

              {recording && (
                <div className="absolute top-6 right-6 bg-red-500/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl flex items-center gap-3 animate-pulse shadow-lg">
                  <div className="w-3 h-3 bg-white rounded-full" />
                  <span className="font-bold tracking-wider">{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-4">
              {!recordedVideo && !recording ? (
                <Button 
                  onClick={startRecording} 
                  disabled={!cameraAccess}
                  className="flex-1 h-16 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-xl font-bold shadow-xl shadow-teal-900/20 transition-all active:scale-95"
                >
                  <Mic className="mr-3 w-6 h-6" /> Commencer l'Odyssée
                </Button>
              ) : recording ? (
                <Button 
                  onClick={stopRecording}
                  className="flex-1 h-16 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-xl font-bold shadow-xl shadow-red-900/20 transition-all active:scale-95"
                >
                  <Square className="mr-3 w-6 h-6 fill-current" /> Terminer
                </Button>
              ) : (
                <div className="flex gap-4 w-full">
                  <Button 
                    onClick={uploadVideo} 
                    disabled={uploading}
                    className="flex-1 h-16 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-xl font-bold shadow-xl shadow-teal-900/20"
                  >
                    {uploading ? <Loader2 className="animate-spin w-6 h-6" /> : <><Upload className="mr-3 w-6 h-6" /> Valider l'étape</>}
                  </Button>
                  <Button 
                    onClick={retryRecording}
                    className="w-20 h-16 bg-white/5 hover:bg-white/10 text-white border-white/10 rounded-2xl"
                  >
                    <RefreshCw className="w-6 h-6" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Scénario Selection Modal-like */}
          {showScenarioSelection && (
            <div className="glass-card p-8 rounded-3xl border-teal-500/30 animate-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Choisissez votre thématique</h2>
                <Button onClick={() => setShowScenarioSelection(false)} variant="ghost" className="text-white/40 hover:text-white">Fermer</Button>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {['enfants', 'adolescents', 'adultes'].map(g => (
                  <button 
                    key={g} 
                    onClick={() => setAgeGroup(g)}
                    className={`p-4 rounded-2xl border-2 transition-all ${ageGroup === g ? 'border-teal-400 bg-teal-400/10 text-teal-400' : 'border-white/10 text-white/40 hover:border-white/20'}`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {scenarios[ageGroup].map((s, i) => (
                  <button 
                    key={i} 
                    onClick={() => { setSelectedScenario(s); setShowScenarioSelection(false); }}
                    className="w-full text-left p-5 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-teal-500/30 transition-all text-teal-50/90"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return embedInOdyssey ? content : (
    <div className="min-h-screen bg-[#3d6b66]" style={{ backgroundImage: "url('/Fond-2.png')", backgroundSize: 'cover' }}>
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      <div className="container mx-auto px-4 py-12">{content}</div>
    </div>
  );
};

export default EnhancedRecordVideo;
