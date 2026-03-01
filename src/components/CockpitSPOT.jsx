/**
 * Composant CockpitSPOT - VERSION CORRIGÉE
 * Dashboard énergétique LUMIA avec gestion complète du profil manquant
 * 
 * Corrections apportées:
 * - Vérification robuste du profil LUMIA
 * - Initialisation automatique du profil si absent
 * - Fallbacks pour toutes les données manquantes
 * - Gestion d'erreurs gracieuse
 * - Suggestions pour créer le profil
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import LumiaRadar from './LumiaRadar.jsx';
import RobotIO from './RobotIO.jsx';
import { Button } from './ui/button.jsx';
import '../styles/lumia-cockpit.css';

export default function CockpitSPOT({ onSignOut }) {
  const navigate = useNavigate();
  const [userLumiaProfile, setUserLumiaProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [showInitializePrompt, setShowInitializePrompt] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showMissionDetails, setShowMissionDetails] = useState(false);

  // Charger le profil LUMIA
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        setProfileError(null);
        
        // Simuler le chargement du profil depuis Supabase
        // En production, remplacer par un appel API réel
        const storedProfile = localStorage.getItem('userLumiaProfile');
        
        if (storedProfile) {
          setUserLumiaProfile(JSON.parse(storedProfile));
        } else {
          // Profil non trouvé - afficher le prompt d'initialisation
          setShowInitializePrompt(true);
        }
      } catch (error) {
        console.error('Erreur lors du chargement du profil:', error);
        setProfileError('Impossible de charger votre profil LUMIA');
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  // Calcul de l'équilibre énergétique
  const calculateBalance = () => {
    if (!userLumiaProfile?.lumia) return 0;
    const { feu_score = 50, air_score = 50, terre_score = 50, eau_score = 50 } = userLumiaProfile.lumia;
    const avg = (feu_score + air_score + terre_score + eau_score) / 4;
    const variance = [feu_score, air_score, terre_score, eau_score].reduce(
      (sum, val) => sum + Math.pow(val - avg, 2),
      0
    ) / 4;
    return Math.round(100 - Math.sqrt(variance));
  };

  const balance = calculateBalance();

  // Gestion des erreurs
  if (profileError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#020617] text-white p-6 font-sans flex items-center justify-center"
      >
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-400 mb-4">Erreur de chargement</h2>
          <p className="text-slate-400 mb-6">{profileError}</p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => window.location.reload()}
              className="bg-teal-600 hover:bg-teal-500"
            >
              Réessayer
            </Button>
            <Button
              onClick={onSignOut}
              variant="outline"
              className="border-slate-600"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Chargement
  if (loadingProfile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#020617] text-white p-6 font-sans flex items-center justify-center"
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="inline-block h-12 w-12 border-4 border-teal-500 border-t-transparent rounded-full mb-4"
          />
          <p className="text-slate-400">Chargement du Cockpit SPOT...</p>
        </div>
      </motion.div>
    );
  }

  // Profil LUMIA non trouvé - Afficher le prompt d'initialisation
  if (!userLumiaProfile && showInitializePrompt) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-screen bg-[#020617] text-white p-6 font-sans flex items-center justify-center"
      >
        <div className="max-w-2xl w-full">
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card border border-cyan-500/30 rounded-3xl p-8 bg-slate-900/60 text-center"
          >
            {/* Robot IO */}
            <div className="mb-6 flex justify-center">
              <RobotIO size="lg" />
            </div>

            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Bienvenue dans le Cockpit SPOT !
            </h2>

            <p className="text-slate-300 mb-6 leading-relaxed">
              Nous avons détecté que vous n'avez pas encore créé votre profil LUMIA.
              <br />
              <span className="text-cyan-300 font-semibold">
                Commençons par créer votre profil énergétique unique !
              </span>
            </p>

            {/* Étapes */}
            <div className="space-y-4 mb-8 text-left">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-start gap-4 p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20"
              >
                <span className="text-2xl">1️⃣</span>
                <div>
                  <h3 className="font-semibold text-cyan-300">Étape 1: Scan des 4 Éléments</h3>
                  <p className="text-sm text-slate-400">Répondez à des questions pour identifier votre zone énergétique dominante</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-start gap-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20"
              >
                <span className="text-2xl">2️⃣</span>
                <div>
                  <h3 className="font-semibold text-blue-300">Étape 2: Assignation LUMIA</h3>
                  <p className="text-sm text-slate-400">Choisissez votre territoire LUMIA (Casablanca, Tenerife, Marseille, Dakar)</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-start gap-4 p-4 bg-purple-500/10 rounded-xl border border-purple-500/20"
              >
                <span className="text-2xl">3️⃣</span>
                <div>
                  <h3 className="font-semibold text-purple-300">Étape 3: Confirmation</h3>
                  <p className="text-sm text-slate-400">Validez votre profil et accédez au Cockpit SPOT</p>
                </div>
              </motion.div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={() => navigate('/scan-elements')}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold px-8 py-3 rounded-xl"
                >
                  🚀 Créer mon profil LUMIA
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={onSignOut}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Déconnexion
                </Button>
              </motion.div>
            </div>

            {/* Conseil */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            >
              <p className="text-sm text-amber-300">
                💡 <span className="font-semibold">Conseil:</span> Prenez quelques minutes pour répondre honnêtement aux questions. Votre profil énergétique vous guidera tout au long de votre Odyssée SPOT.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // Profil LUMIA trouvé - Afficher le Cockpit
  if (userLumiaProfile) {
    const { user, lumia } = userLumiaProfile;
    const territory = lumia?.territoire || 'Non défini';
    const feu_score = lumia?.feu_score || 0;
    const air_score = lumia?.air_score || 0;
    const terre_score = lumia?.terre_score || 0;
    const eau_score = lumia?.eau_score || 0;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#020617] text-white p-6 font-sans"
      >
        {/* Header Cockpit */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-between items-center mb-8 border-b border-cyan-900/30 pb-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              🛰 Cockpit SPOT
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Bienvenue, {user?.name || 'Joueur'} • {territory}
            </p>
          </div>
          <RobotIO size="md" />
        </motion.header>

        {/* Grille principale */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Radar énergétique */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 glass-card border border-cyan-500/30 rounded-3xl p-8 bg-slate-900/60"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span>📊</span> État Énergétique
            </h2>
            <LumiaRadar
              feu={feu_score}
              air={air_score}
              terre={terre_score}
              eau={eau_score}
            />
          </motion.div>

          {/* Équilibre énergétique */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card border border-purple-500/30 rounded-3xl p-8 bg-slate-900/60 flex flex-col justify-center"
          >
            <h3 className="text-sm font-bold text-purple-300 uppercase tracking-widest mb-4">
              Équilibre Énergétique
            </h3>
            <div className="text-5xl font-bold text-purple-400 mb-4">
              {balance}%
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-slate-400">
                🔥 FEU: <span className="text-orange-400 font-semibold">{feu_score}</span>
              </p>
              <p className="text-slate-400">
                🌬 AIR: <span className="text-blue-400 font-semibold">{air_score}</span>
              </p>
              <p className="text-slate-400">
                🌍 TERRE: <span className="text-green-400 font-semibold">{terre_score}</span>
              </p>
              <p className="text-slate-400">
                💧 EAU: <span className="text-cyan-400 font-semibold">{eau_score}</span>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Actions rapides */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card border border-slate-700/50 rounded-3xl p-8 bg-slate-900/60"
        >
          <h3 className="text-xl font-bold mb-6">Actions Rapides</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              onClick={() => navigate('/labo-transformation')}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-3 rounded-xl"
            >
              🎯 Missions
            </Button>
            <Button
              onClick={() => navigate('/galactic-map')}
              className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-bold py-3 rounded-xl"
            >
              🌌 Constellation
            </Button>
            <Button
              onClick={() => setShowMissionDetails(!showMissionDetails)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 rounded-xl"
            >
              🎥 Pitch
            </Button>
            <Button
              onClick={onSignOut}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              🚪 Déconnexion
            </Button>
          </div>
        </motion.div>

        {/* Conseil */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl"
        >
          <p className="text-sm text-cyan-300">
            💡 <span className="font-semibold">Conseil:</span> Explorez chaque onglet pour une expérience complète. Le Cockpit SPOT vous donne une vue d'ensemble énergétique, l'Évaluation IA analyse vos compétences, et l'Enregistrement vous permet de capturer vos meilleures versions.
          </p>
        </motion.div>
      </motion.div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 font-sans flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-400">Chargement...</p>
      </div>
    </div>
  );
}
