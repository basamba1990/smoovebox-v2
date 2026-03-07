import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * RobotIO - Mascotte Joueur Numéro 10
 * Utilise un GIF animé pour le robot, avec interactions et animations Framer Motion.
 */
export default function RobotIO({
  size = 'md',
  interactive = true,
  message = null,
  onInteraction = null
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isKicking, setIsKicking] = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(0.5);
  const [particlesActive, setParticlesActive] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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

  // Suivi de la souris pour interactions (optionnel)
  const handleMouseMove = (e) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  // Interaction au clic : déclenche le kick et les particules
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

  // Tailles pour le conteneur et le GIF
  const sizes = {
    sm: 'w-24 h-32',
    md: 'w-40 h-56',
    lg: 'w-56 h-72',
  };
  const currentSize = sizes[size];

  // Tailles pour le ballon (conservé en SVG)
  const ballSizes = {
    sm: 'w-14 h-14',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };
  const currentBallSize = ballSizes[size];

  return (
    <motion.div
      onHoverStart={() => interactive && setIsHovered(true)}
      onHoverEnd={() => interactive && setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      className={`flex flex-col items-center gap-6 ${interactive ? 'cursor-pointer' : ''}`}
    >
      {/* Conteneur Robot avec animations supplémentaires */}
      <motion.div
        animate={{
          y: isHovered ? -12 : isKicking ? [0, -15, 5, 0] : 0,
          rotate: isKicking ? [0, -3, 3, 0] : isHovered ? [0, -1, 1, 0] : 0,
          scale: isHovered ? 1.08 : 1,
        }}
        transition={{
          y: { type: 'spring', stiffness: 300, damping: 20 },
          rotate: { duration: 0.5, ease: 'easeInOut' },
        }}
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
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos((i / 8) * Math.PI * 2) * 100,
                  y: Math.sin((i / 8) * Math.PI * 2) * 100,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute w-3 h-3 rounded-full bg-cyan-400 blur-sm"
              />
            ))}
          </>
        )}

        {/* GIF Robot animé */}
        <img
          src="/robot_spotbulle_animation.gif" // Placez le fichier GIF dans le dossier /public de votre projet
          alt="Robot SpotBulle"
          className="w-full h-full object-contain drop-shadow-2xl"
          style={{
            filter: `brightness(${1 + glowIntensity * 0.1})`,
          }}
        />
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
        <svg viewBox="0 0 100 100" className={`${currentBallSize} drop-shadow-lg`}>
          <defs>
            <filter id="ballGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="ballGradient" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#F0F0F0" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#ballGradient)" filter="url(#ballGlow)" />
          <circle cx="50" cy="25" r="7" fill="#000000" />
          <circle cx="72" cy="37" r="7" fill="#000000" />
          <circle cx="68" cy="63" r="7" fill="#000000" />
          <circle cx="32" cy="63" r="7" fill="#000000" />
          <circle cx="28" cy="37" r="7" fill="#000000" />
          <ellipse cx="35" cy="35" rx="18" ry="14" fill="#FFD700" opacity="0.4" />
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
