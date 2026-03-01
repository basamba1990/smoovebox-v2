import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * RobotIO - Mascotte Joueur Numéro 10
 * Robot bleu avec jersey, shorts, antenne et ballon de foot
 * Design exact de l'image fournie
 */
export default function RobotIO({ size = 'md', interactive = true, message = null }) {
  const [isHovered, setIsHovered] = useState(false);
  const [blink, setBlink] = useState(false);

  // Clignotement naturel
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 4000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // Tailles
  const sizes = {
    sm: 'w-20 h-28',
    md: 'w-32 h-44',
    lg: 'w-48 h-64',
  };

  const currentSize = sizes[size];

  return (
    <motion.div
      onHoverStart={() => interactive && setIsHovered(true)}
      onHoverEnd={() => interactive && setIsHovered(false)}
      className="flex flex-col items-center gap-6"
    >
      {/* Conteneur Robot */}
      <motion.div
        animate={{
          y: isHovered ? -8 : 0,
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`${currentSize} relative flex items-center justify-center`}
      >
        {/* SVG Robot Joueur 10 */}
        <svg
          viewBox="0 0 200 280"
          className="w-full h-full drop-shadow-2xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Dégradé pour la tête */}
          <defs>
            <radialGradient id="headGradient" cx="40%" cy="40%">
              <stop offset="0%" stopColor="#87CEEB" />
              <stop offset="100%" stopColor="#4A90E2" />
            </radialGradient>
            <radialGradient id="ballGradient" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#F0F0F0" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Antenne */}
          <motion.g
            animate={{
              rotate: isHovered ? [0, -10, 10, 0] : 0,
            }}
            transition={{ duration: 0.6, repeat: isHovered ? Infinity : 0 }}
            style={{ transformOrigin: '100px 30px' }}
          >
            <line x1="100" y1="30" x2="100" y2="0" stroke="#4A90E2" strokeWidth="6" strokeLinecap="round" />
            {/* Boule antenne */}
            <circle cx="100" cy="-5" r="12" fill="url(#headGradient)" filter="url(#shadow)" />
          </motion.g>

          {/* Tête - Sphère bleue */}
          <circle cx="100" cy="60" r="45" fill="url(#headGradient)" filter="url(#shadow)" />

          {/* Sourcils */}
          <path d="M 75 45 Q 80 40 90 42" stroke="#2C5AA0" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 110 42 Q 120 40 125 45" stroke="#2C5AA0" strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* Yeux gauche */}
          <motion.g
            animate={{
              scaleY: blink ? 0.1 : 1,
            }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: '80px 60px' }}
          >
            <circle cx="80" cy="60" r="10" fill="#000080" />
            <circle cx="82" cy="58" r="5" fill="#00FFFF" />
            <circle cx="84" cy="56" r="2" fill="#FFFFFF" />
          </motion.g>

          {/* Oeil droit */}
          <motion.g
            animate={{
              scaleY: blink ? 0.1 : 1,
            }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: '120px 60px' }}
          >
            <circle cx="120" cy="60" r="10" fill="#000080" />
            <circle cx="122" cy="58" r="5" fill="#00FFFF" />
            <circle cx="124" cy="56" r="2" fill="#FFFFFF" />
          </motion.g>

          {/* Sourire */}
          <motion.path
            d="M 85 75 Q 100 85 115 75"
            stroke="#FFFFFF"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            animate={{
              d: isHovered ? "M 85 75 Q 100 88 115 75" : "M 85 75 Q 100 85 115 75",
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Corps - Jersey bleu numéro 10 */}
          <g>
            {/* Jersey */}
            <ellipse cx="100" cy="130" rx="35" ry="45" fill="#1E3A8A" filter="url(#shadow)" />
            {/* Bandes latérales jersey */}
            <rect x="65" y="110" width="4" height="50" fill="#87CEEB" opacity="0.6" />
            <rect x="131" y="110" width="4" height="50" fill="#87CEEB" opacity="0.6" />
            {/* Numéro 10 */}
            <text x="100" y="145" fontSize="28" fontWeight="bold" fill="#FFFFFF" textAnchor="middle" fontFamily="Arial, sans-serif">
              10
            </text>
          </g>

          {/* Bras gauche */}
          <motion.g
            animate={{
              rotate: isHovered ? -30 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '70px 120px' }}
          >
            {/* Bras */}
            <rect x="60" y="120" width="20" height="50" rx="10" fill="#4A90E2" filter="url(#shadow)" />
            {/* Main */}
            <circle cx="70" cy="175" r="12" fill="#87CEEB" />
            <circle cx="65" cy="180" r="5" fill="#4A90E2" />
            <circle cx="75" cy="180" r="5" fill="#4A90E2" />
          </motion.g>

          {/* Bras droit */}
          <motion.g
            animate={{
              rotate: isHovered ? 30 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '130px 120px' }}
          >
            {/* Bras */}
            <rect x="120" y="120" width="20" height="50" rx="10" fill="#4A90E2" filter="url(#shadow)" />
            {/* Main */}
            <circle cx="130" cy="175" r="12" fill="#87CEEB" />
            <circle cx="125" cy="180" r="5" fill="#4A90E2" />
            <circle cx="135" cy="180" r="5" fill="#4A90E2" />
          </motion.g>

          {/* Shorts */}
          <g>
            <rect x="75" y="165" width="50" height="35" rx="5" fill="#0F172A" filter="url(#shadow)" />
            {/* Bandes shorts */}
            <rect x="75" y="165" width="50" height="4" fill="#87CEEB" />
            <rect x="75" y="190" width="50" height="3" fill="#87CEEB" />
          </g>

          {/* Jambe gauche */}
          <motion.g
            animate={{
              rotate: isHovered ? -15 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '85px 200px' }}
          >
            <rect x="80" y="200" width="10" height="50" rx="5" fill="#4A90E2" filter="url(#shadow)" />
            {/* Chaussure */}
            <ellipse cx="85" cy="255" rx="10" ry="8" fill="#1E3A8A" />
            <rect x="78" y="250" width="14" height="6" fill="#87CEEB" />
          </motion.g>

          {/* Jambe droite */}
          <motion.g
            animate={{
              rotate: isHovered ? 15 : 0,
            }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: '115px 200px' }}
          >
            <rect x="110" y="200" width="10" height="50" rx="5" fill="#4A90E2" filter="url(#shadow)" />
            {/* Chaussure */}
            <ellipse cx="115" cy="255" rx="10" ry="8" fill="#1E3A8A" />
            <rect x="108" y="250" width="14" height="6" fill="#87CEEB" />
          </motion.g>
        </svg>
      </motion.div>

      {/* Ballon de foot */}
      <motion.div
        animate={{
          y: isHovered ? [0, -15, 0] : 0,
          rotate: isHovered ? 360 : 0,
        }}
        transition={{
          y: { duration: 0.8, repeat: isHovered ? Infinity : 0, ease: 'easeInOut' },
          rotate: { duration: 2, repeat: isHovered ? Infinity : 0 },
        }}
        className="relative"
      >
        <svg viewBox="0 0 100 100" className={`${size === 'sm' ? 'w-12 h-12' : size === 'md' ? 'w-16 h-16' : 'w-24 h-24'} drop-shadow-lg`}>
          {/* Ballon */}
          <circle cx="50" cy="50" r="48" fill="url(#ballGradient)" />
          {/* Pentagones noirs */}
          <circle cx="50" cy="25" r="6" fill="#000000" />
          <circle cx="70" cy="35" r="6" fill="#000000" />
          <circle cx="65" cy="55" r="6" fill="#000000" />
          <circle cx="35" cy="55" r="6" fill="#000000" />
          <circle cx="30" cy="35" r="6" fill="#000000" />
          {/* Reflet */}
          <ellipse cx="35" cy="35" rx="15" ry="12" fill="#FFFFFF" opacity="0.3" />
        </svg>
      </motion.div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/80 backdrop-blur-md border border-cyan-500/30 p-4 rounded-2xl max-w-xs text-center shadow-xl"
        >
          <p className="text-cyan-100 text-sm font-medium leading-relaxed">
            {message}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
