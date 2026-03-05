import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * RobotIO - Mascotte Joueur Numéro 10 AMÉLIORÉE
 * Design étoilé, innovant, intelligent et animé
 * Guidé par l'utilisateur avec interactions intelligentes
 */
export default function RobotIO({
  size = 'md',
  interactive = true,
  message = null,
  onInteraction = null,
  useGif = false // Option pour utiliser le GIF animé au lieu du SVG
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [blink, setBlink] = useState(false);
  const [isKicking, setIsKicking] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(0.5);
  const [particlesActive, setParticlesActive] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Clignotement naturel
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 4000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Glow pulsant intelligent
  useEffect(() => {
    const glowInterval = setInterval(() => {
      setGlowIntensity(prev => {
        const next = prev + 0.1;
        return next > 1 ? 0.5 : next;
      });
    }, 100);

    return () => clearInterval(glowInterval);
  }, []);

  // Suivi de la souris pour interactions intelligentes
  const handleMouseMove = (e) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  // Interaction intelligente au clic
  const handleClick = () => {
    if (interactive) {
      setIsKicking(true);
      setParticlesActive(true);
      setTimeout(() => setIsKicking(false), 600);
      setTimeout(() => setParticlesActive(false), 1000);

      if (onInteraction) {
        onInteraction('kick');
      }
    }
  };

  // Tailles
  const sizes = {
    sm: 'w-24 h-32',
    md: 'w-40 h-56',
    lg: 'w-56 h-72',
  };

  const currentSize = sizes[size];

  if (useGif) {
    return (
      <motion.div
        onHoverStart={() => interactive && setIsHovered(true)}
        onHoverEnd={() => interactive && setIsHovered(false)}
        onClick={handleClick}
        className={`flex flex-col items-center gap-4 ${interactive ? 'cursor-pointer' : ''}`}
      >
        <motion.div
          animate={{
            y: isHovered ? -10 : 0,
            scale: isHovered ? 1.05 : 1,
          }}
          className={`${currentSize} relative flex items-center justify-center`}
        >
          <img 
            src="/robot_spotbulle_animation.gif" 
            alt="Robot SpotBulle" 
            className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]"
          />
        </motion.div>
        {message && (
          <div className="bg-slate-800/90 backdrop-blur-md border border-cyan-500/40 p-3 rounded-xl max-w-xs text-center text-cyan-100 text-sm">
            {message}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      onHoverStart={() => interactive && setIsHovered(true)}
      onHoverEnd={() => interactive && setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={`flex flex-col items-center gap-6 ${interactive ? 'cursor-pointer' : ''}`}
    >
      {/* Conteneur Robot avec Glow */}
      <motion.div
        animate={{
          y: isHovered ? -12 : 0,
          scale: isHovered ? 1.08 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`${currentSize} relative flex items-center justify-center`}
        style={{
          filter: `drop-shadow(0 0 ${20 + glowIntensity * 20}px rgba(6, 182, 212, ${0.4 + glowIntensity * 0.3}))`,
        }}
      >
        {/* Particules d'énergie au kick */}
        {particlesActive && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  scale: 1
                }}
                animate={{
                  x: Math.cos((i / 8) * Math.PI * 2) * 100,
                  y: Math.sin((i / 8) * Math.PI * 2) * 100,
                  opacity: 0,
                  scale: 0
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute w-3 h-3 rounded-full bg-cyan-400 blur-sm"
              />
            ))}
          </>
        )}

        {/* SVG Robot Joueur 10 - Design Étoilé */}
        <svg
          viewBox="0 0 200 280"
          className="w-full h-full drop-shadow-2xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Dégradés avancés */}
            <radialGradient id="headGradient" cx="40%" cy="40%">
              <stop offset="0%" stopColor="#87CEEB" />
              <stop offset="50%" stopColor="#4A90E2" />
              <stop offset="100%" stopColor="#1E3A8A" />
            </radialGradient>

            <radialGradient id="eyeGlowGradient" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#00FFFF" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </radialGradient>

            <radialGradient id="ballGradient" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#F0F0F0" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>

            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.4" />
            </filter>

            {/* Étoiles de décoration */}
            <pattern id="starPattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1" fill="#00FFFF" opacity="0.6" />
              <circle cx="50" cy="30" r="1" fill="#00FFFF" opacity="0.4" />
              <circle cx="80" cy="50" r="1" fill="#00FFFF" opacity="0.5" />
            </pattern>
          </defs>

          {/* Antenne avec glow */}
          <motion.g
            animate={{
              rotate: isHovered ? [0, -15, 15, 0] : 0,
            }}
            transition={{ duration: 0.8, repeat: isHovered ? Infinity : 0 }}
            style={{ transformOrigin: '100px 30px' }}
          >
            <line x1="100" y1="30" x2="100" y2="0" stroke="#4A90E2" strokeWidth="8" strokeLinecap="round" filter="url(#glow)" />
            {/* Boule antenne lumineuse */}
            <motion.circle
              cx="100"
              cy="-5"
              r="14"
              fill="url(#eyeGlowGradient)"
              filter="url(#shadow)"
              animate={{
                r: [14, 16, 14],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            {/* Reflet antenne */}
            <circle cx="98" cy="-7" r="4" fill="#FFFFFF" opacity="0.6" />
          </motion.g>

          {/* Tête - Sphère bleue brillante */}
          <circle cx="100" cy="60" r="48" fill="url(#headGradient)" filter="url(#shadow)" />

          {/* Reflet tête */}
          <ellipse cx="85" cy="45" rx="18" ry="15" fill="#FFFFFF" opacity="0.25" />

          {/* Sourcils expressifs */}
          <motion.path
            d="M 75 42 Q 80 38 90 40"
            stroke="#2C5AA0"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            animate={{
              d: isHovered ? "M 75 38 Q 80 34 90 36" : "M 75 42 Q 80 38 90 40",
            }}
            transition={{ duration: 0.3 }}
          />
          <motion.path
            d="M 110 40 Q 120 38 125 42"
            stroke="#2C5AA0"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            animate={{
              d: isHovered ? "M 110 36 Q 120 34 125 38" : "M 110 40 Q 120 38 125 42",
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Oeil gauche - Glow intelligent */}
          <motion.g
            animate={{
              scaleY: blink ? 0.1 : 1,
            }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: '80px 60px' }}
          >
            {/* Blanc de l'oeil */}
            <circle cx="80" cy="60" r="13" fill="#FFFFFF" />
            {/* Iris bleu foncé */}
            <circle cx="80" cy="60" r="10" fill="#000080" />
            {/* Pupille */}
            <motion.circle
              cx="80"
              cy="60"
              r="6"
              fill="url(#eyeGlowGradient)"
              animate={{
                cx: 80 + (mousePosition.x - 0.5) * 4,
                cy: 60 + (mousePosition.y - 0.5) * 4,
              }}
            />
            {/* Reflet oeil */}
            <circle cx="82" cy="58" r="3" fill="#FFFFFF" opacity="0.8" />
          </motion.g>

          {/* Oeil droit - Glow intelligent */}
          <motion.g
            animate={{
              scaleY: blink ? 0.1 : 1,
            }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: '120px 60px' }}
          >
            {/* Blanc de l'oeil */}
            <circle cx="120" cy="60" r="13" fill="#FFFFFF" />
            {/* Iris bleu foncé */}
            <circle cx="120" cy="60" r="10" fill="#000080" />
            {/* Pupille */}
            <motion.circle
              cx="120"
              cy="60"
              r="6"
              fill="url(#eyeGlowGradient)"
              animate={{
                cx: 120 + (mousePosition.x - 0.5) * 4,
                cy: 60 + (mousePosition.y - 0.5) * 4,
              }}
            />
            {/* Reflet oeil */}
            <circle cx="122" cy="58" r="3" fill="#FFFFFF" opacity="0.8" />
          </motion.g>

          {/* Sourire expressif */}
          <motion.path
            d="M 85 75 Q 100 88 115 75"
            stroke="#FFFFFF"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            animate={{
              d: isHovered ? "M 85 75 Q 100 92 115 75" : "M 85 75 Q 100 88 115 75",
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Corps - Jersey bleu numéro 10 */}
          <g>
            {/* Jersey */}
            <ellipse cx="100" cy="135" rx="38" ry="48" fill="#1E3A8A" filter="url(#shadow)" />
            {/* Bandes latérales jersey */}
            <rect x="62" y="110" width="5" height="55" fill="#87CEEB" opacity="0.7" />
            <rect x="133" y="110" width="5" height="55" fill="#87CEEB" opacity="0.7" />
            {/* Numéro 10 - Brillant */}
            <text
              x="100"
              y="150"
              fontSize="36"
              fontWeight="bold"
              fill="#FFFFFF"
              textAnchor="middle"
              fontFamily="Arial, sans-serif"
              filter="url(#glow)"
            >
              10
            </text>
          </g>

          {/* Bras gauche - Articulé */}
          <motion.g
            animate={{
              rotate: isKicking ? -60 : isHovered ? -25 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '68px 125px' }}
          >
            {/* Bras */}
            <rect x="58" y="125" width="22" height="55" rx="11" fill="#4A90E2" filter="url(#shadow)" />
            {/* Main robotique */}
            <circle cx="69" cy="185" r="14" fill="#87CEEB" />
            <circle cx="63" cy="191" r="6" fill="#4A90E2" />
            <circle cx="75" cy="191" r="6" fill="#4A90E2" />
          </motion.g>

          {/* Bras droit - Articulé */}
          <motion.g
            animate={{
              rotate: isKicking ? 60 : isHovered ? 25 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '132px 125px' }}
          >
            {/* Bras */}
            <rect x="120" y="125" width="22" height="55" rx="11" fill="#4A90E2" filter="url(#shadow)" />
            {/* Main robotique */}
            <circle cx="131" cy="185" r="14" fill="#87CEEB" />
            <circle cx="125" cy="191" r="6" fill="#4A90E2" />
            <circle cx="137" cy="191" r="6" fill="#4A90E2" />
            <circle cx="131" cy="200" r="5" fill="#4A90E2" />
          </motion.g>

          {/* Shorts */}
          <g>
            <rect x="72" y="170" width="56" height="38" rx="6" fill="#0F172A" filter="url(#shadow)" />
            {/* Bandes shorts */}
            <rect x="72" y="170" width="56" height="5" fill="#87CEEB" opacity="0.8" />
            <rect x="72" y="195" width="56" height="4" fill="#87CEEB" opacity="0.6" />
          </g>

          {/* Jambe gauche - Articulée */}
          <motion.g
            animate={{
              rotate: isKicking ? -30 : isHovered ? -12 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '82px 208px' }}
          >
            <rect x="77" y="208" width="12" height="55" rx="6" fill="#4A90E2" filter="url(#shadow)" />
            {/* Chaussure */}
            <ellipse cx="83" cy="268" rx="12" ry="10" fill="#1E3A8A" />
            <rect x="75" y="262" width="16" height="7" fill="#87CEEB" opacity="0.8" />
          </motion.g>

          {/* Jambe droite - Articulée */}
          <motion.g
            animate={{
              rotate: isKicking ? 30 : isHovered ? 12 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '118px 208px' }}
          >
            <rect x="111" y="208" width="12" height="55" rx="6" fill="#4A90E2" filter="url(#shadow)" />
            {/* Chaussure */}
            <ellipse cx="117" cy="268" rx="12" ry="10" fill="#1E3A8A" />
            <rect x="109" y="262" width="16" height="7" fill="#87CEEB" opacity="0.8" />
          </motion.g>
        </svg>
      </motion.div>

      {/* Ballon de foot avec glow doré */}
      <motion.div
        animate={{
          y: isKicking ? [-20, -40, 0] : isHovered ? [0, -20, 0] : 0,
          rotate: isKicking ? 720 : isHovered ? 360 : 0,
        }}
        transition={{
          y: isKicking
            ? { duration: 0.8, ease: 'easeInOut' }
            : { duration: 2, repeat: isHovered ? Infinity : 0, ease: 'easeInOut' },
          rotate: { duration: isKicking ? 0.8 : 2, repeat: isHovered ? Infinity : 0 },
        }}
        className="relative"
      >
        <svg viewBox="0 0 100 100" className={`${size === 'sm' ? 'w-14 h-14' : size === 'md' ? 'w-20 h-20' : 'w-28 h-28'} drop-shadow-lg`}>
          {/* Ballon avec glow doré */}
          <defs>
            <filter id="ballGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ballon principal */}
          <circle cx="50" cy="50" r="48" fill="url(#ballGradient)" filter="url(#ballGlow)" />

          {/* Pentagones noirs */}
          <circle cx="50" cy="25" r="7" fill="#000000" />
          <circle cx="72" cy="37" r="7" fill="#000000" />
          <circle cx="68" cy="63" r="7" fill="#000000" />
          <circle cx="32" cy="63" r="7" fill="#000000" />
          <circle cx="28" cy="37" r="7" fill="#000000" />

          {/* Reflet doré */}
          <ellipse cx="35" cy="35" rx="18" ry="14" fill="#FFD700" opacity="0.4" />

          {/* Glow doré autour */}
          <circle cx="50" cy="50" r="48" fill="none" stroke="#FFD700" strokeWidth="2" opacity="0.3" />
        </svg>
      </motion.div>

      {/* Message avec animation */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/90 backdrop-blur-md border border-cyan-500/40 p-5 rounded-2xl max-w-xs text-center shadow-2xl"
          style={{
            boxShadow: `0 0 20px rgba(6, 182, 212, ${0.3 + glowIntensity * 0.2})`,
          }}
        >
          <p className="text-cyan-100 text-sm font-medium leading-relaxed">
            {message}
          </p>
        </motion.div>
      )}

      {/* Indicateur interactivité */}
      {interactive && isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-cyan-400 font-semibold uppercase tracking-widest"
        >
          💫 Cliquez pour interagir
        </motion.div>
      )}
    </motion.div>
  );
}
