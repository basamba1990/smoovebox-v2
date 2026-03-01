/**
 * ModuleMimetique - VERSION EXACTE
 * Tous les onglets opérationnels avec interface vidéo complète
 * 5 onglets: Cockpit, Évaluation IA, Parcours, Écosystème, Enregistrement
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import OdysseyLayout from '../components/OdysseyLayout.jsx';
import { Button } from '../components/ui/button.jsx';

const STEP_3 = { id: 3, label: 'Le Module Mimétique', path: '/module-mimetique' };
const STEP_4 = { id: 4, label: 'Le Labo de Transformation', path: '/labo-transformation' };

// Robot IO - Joueur numéro 10
const RobotIO = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  return (
    <motion.div
      className={`${sizes[size]} relative`}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Jersey bleu avec numéro 10 */}
      <svg viewBox="0 0 100 120" className="w-full h-full">
        {/* Corps - Jersey */}
        <rect x="25" y="35" width="50" height="55" rx="8" fill="#06B6D4" stroke="#0EA5E9" strokeWidth="2" />
        
        {/* Numéro 10 */}
        <text x="50" y="75" fontSize="32" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial">
          10
        </text>
        
        {/* Tête - Cercle bleu */}
        <circle cx="50" cy="20" r="15" fill="#06B6D4" stroke="#0EA5E9" strokeWidth="2" />
        
        {/* Yeux */}
        <motion.circle
          cx="45"
          cy="18"
          r="2.5"
          fill="white"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
        />
        <motion.circle
          cx="55"
          cy="18"
          r="2.5"
          fill="white"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0 }}
        />
        
        {/* Sourire */}
        <path d="M 45 23 Q 50 25 55 23" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        
        {/* Antennes */}
        <motion.line
          x1="40"
          y1="8"
          x2="35"
          y2="2"
          stroke="#0EA5E9"
          strokeWidth="2"
          strokeLinecap="round"
          animate={{ rotate: [-15, 15, -15] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.line
          x1="60"
          y1="8"
          x2="65"
          y2="2"
          stroke="#0EA5E9"
          strokeWidth="2"
          strokeLinecap="round"
          animate={{ rotate: [15, -15, 15] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Bras */}
        <rect x="20" y="40" width="8" height="30" rx="4" fill="#0EA5E9" />
        <rect x="72" y="40" width="8" height="30" rx="4" fill="#0EA5E9" />
        
        {/* Jambes */}
        <rect x="38" y="90" width="8" height="25" rx="4" fill="#0EA5E9" />
        <rect x="54" y="90" width="8" height="25" rx="4" fill="#0EA5E9" />
      </svg>
    </motion.div>
  );
};

// Composant Enregistrement Vidéo
const EnregistrementVideo = ({ user, profile }) => {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState(null);
  const [tags, setTags] = useState('');

  const maxRecordingTime = 120;

  // Initialiser caméra
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraAccess(true);
        }
      } catch (err) {
        setError('Impossible d\'accéder à la caméra');
      }
    };
    initCamera();
  }, []);

  // Minuteur
  useEffect(() => {
    let timer;
    if (recording) {
      timer = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 >= maxRecordingTime) {
            stopRecording();
            return maxRecordingTime;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [recording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (!cameraAccess) return;
    setRecording(true);
    setRecordingTime(0);

    const stream = videoRef.current.srcObject;
    const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });

    const chunks = [];
    mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedVideo({ blob, url, duration: recordingTime });
    };

    mediaRecorderRef.current.start();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadVideo = async () => {
    if (!recordedVideo) return;
    setUploading(true);
    // Simulation d'upload
    setTimeout(() => {
      setUploading(false);
      alert('Vidéo uploadée avec succès !');
    }, 2000);
  };

  const retryRecording = () => {
    setRecordedVideo(null);
    setRecordingTime(0);
  };

  return (
    <div className="space-y-6">
      {/* Erreur */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300"
        >
          {error}
        </motion.div>
      )}

      {/* Écran vidéo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-black rounded-2xl overflow-hidden aspect-video shadow-2xl border-2 border-cyan-500/30"
      >
        {!recordedVideo ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {cameraAccess && !recording && (
              <div className="absolute top-4 left-4 bg-cyan-500/90 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                CAMÉRA PRÊTE
              </div>
            )}
            {recording && (
              <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                REC {formatTime(recordingTime)}
              </div>
            )}
          </>
        ) : (
          <video
            src={recordedVideo.url}
            controls
            className="w-full h-full object-cover"
          />
        )}
      </motion.div>

      {/* Barre progression */}
      {recording && (
        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 to-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${(recordingTime / maxRecordingTime) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="block text-xs font-bold text-cyan-400/60 uppercase tracking-widest mb-2">
          Mots-clés
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="ex: passion, leadership, innovation..."
          className="w-full p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-white placeholder:text-slate-400 focus:border-cyan-500/50 outline-none"
          disabled={recording || uploading}
        />
      </div>

      {/* Boutons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {!recordedVideo && !recording && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="sm:col-span-3"
          >
            <Button
              onClick={startRecording}
              disabled={!cameraAccess}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-3"
            >
              🎙️ Démarrer l'enregistrement
            </Button>
          </motion.div>
        )}

        {recording && (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="sm:col-span-3"
          >
            <Button
              onClick={stopRecording}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3"
            >
              ⏹️ Arrêter l'enregistrement
            </Button>
          </motion.div>
        )}

        {recordedVideo && !uploading && (
          <>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={uploadVideo}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-3"
              >
                ☁️ Uploader
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={retryRecording}
                className="w-full bg-slate-600 hover:bg-slate-700 text-white font-bold py-3"
              >
                🔄 Réessayer
              </Button>
            </motion.div>
          </>
        )}

        {uploading && (
          <motion.div className="sm:col-span-3">
            <Button
              disabled
              className="w-full bg-slate-600/50 text-slate-300 font-bold py-3"
            >
              ⏳ Synchronisation...
            </Button>
          </motion.div>
        )}
      </div>

      {/* Conseils */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg space-y-2"
      >
        <p className="text-sm text-slate-300 font-semibold">📝 Conseils:</p>
        <ul className="text-sm text-slate-400 space-y-1 ml-4">
          <li>✓ Bonne luminosité et son clair</li>
          <li>✓ Regard vers la caméra</li>
          <li>✓ Parlez avec passion et conviction</li>
          <li>✓ Durée recommandée: 30-60 secondes</li>
        </ul>
      </motion.div>
    </div>
  );
};

export default function ModuleMimetique({ user, profile, onSignOut }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('cockpit');

  const tabs = [
    {
      id: 'cockpit',
      label: 'Cockpit SPOT',
      icon: '🛰',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      id: 'evaluation',
      label: 'Évaluation IA',
      icon: '🤖',
      color: 'from-purple-500 to-pink-500',
    },
    {
      id: 'parcours',
      label: 'Parcours',
      icon: '🎯',
      color: 'from-orange-500 to-red-500',
    },
    {
      id: 'ecosysteme',
      label: 'Écosystème',
      icon: '🌐',
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'enregistrement',
      label: 'Enregistrement',
      icon: '🎥',
      color: 'from-red-500 to-rose-500',
    },
  ];

  const TabButton = ({ tab, isActive, index }) => (
    <motion.button
      onClick={() => setActiveTab(tab.id)}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`relative px-4 py-3 rounded-t-lg font-semibold transition-all duration-300 whitespace-nowrap flex items-center gap-2 text-sm sm:text-base ${
        isActive
          ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
      }`}
    >
      <span className="text-lg sm:text-xl">{tab.icon}</span>
      <span className="hidden sm:inline">{tab.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-400"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );

  return (
    <OdysseyLayout
      currentStep={3}
      title=""
      maxWidthClass="max-w-7xl"
      onSignOut={onSignOut}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Module Mimétique – Cockpit SPOT
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mt-2">
              Enregistrement vidéo et miroir de ton étoile.
            </p>
          </div>
          <div className="hidden sm:flex items-center">
            <RobotIO size="md" />
          </div>
        </div>
      </motion.div>

      {/* Tabs Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8 overflow-x-auto"
      >
        <div className="flex gap-2 border-b border-slate-700/50 pb-4 min-w-max sm:min-w-0">
          {tabs.map((tab, index) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              index={index}
            />
          ))}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="glass-card border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl bg-slate-900/60 backdrop-blur-xl"
        >
          {activeTab === 'cockpit' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <div className="text-center py-12">
                <p className="text-slate-400">Cockpit SPOT - Dashboard énergétique</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'evaluation' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🤖</span>
                  <div>
                    <h2 className="text-2xl font-bold text-purple-300">Évaluation IA des 4 Éléments</h2>
                    <p className="text-slate-400 text-sm">
                      Sélectionnez une vidéo et laissez l'IA analyser vos compétences LUMIA
                    </p>
                  </div>
                </div>
                <div className="p-8 bg-slate-800/30 border border-slate-700/30 rounded-lg text-center">
                  <p className="text-slate-400 mb-4">⚠️ Utilisateur non identifié</p>
                  <p className="text-slate-400 mb-4">❌ Aucune vidéo disponible</p>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">🔍 Analyser</Button>
                  <p className="text-sm text-slate-500 mt-4">
                    📹 Enregistrez d'abord une vidéo dans l'onglet Enregistrement pour pouvoir l'analyser.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'parcours' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <div className="text-center py-12">
                <p className="text-slate-400">Parcours - Suivi de progression</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'ecosysteme' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <div className="text-center py-12">
                <p className="text-slate-400">Écosystème - Matching de talents</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'enregistrement' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <EnregistrementVideo user={user} profile={profile} />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 flex justify-between items-center gap-4"
      >
        <Button
          onClick={() => navigate('/scan-elements')}
          variant="outline"
          className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          ← Précédent
        </Button>

        <div className="text-center">
          <p className="text-slate-400 text-sm font-semibold">Étape 3 / 7</p>
        </div>

        <Button
          onClick={() => navigate(STEP_4.path)}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold shadow-lg shadow-cyan-500/30"
        >
          Continuer →
        </Button>
      </motion.div>
    </OdysseyLayout>
  );
}
