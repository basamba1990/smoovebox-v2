/**
 * RobotIO - ANIMATION NATURELLE
 * Mascotte robot bleu avec animations fluides et adaptées
 * Mouvements: respiration, clignotement, rotation légère
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function RobotIONaturel({ size = 'md', interactive = true }) {
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
    sm: { container: 'w-16 h-16', head: 'w-12 h-12', eye: 'w-2 h-2' },
    md: { container: 'w-24 h-24', head: 'w-20 h-20', eye: 'w-3 h-3' },
    lg: { container: 'w-32 h-32', head: 'w-28 h-28', eye: 'w-4 h-4' },
  };

  const currentSize = sizes[size];

  return (
    <motion.div
      onHoverStart={() => interactive && setIsHovered(true)}
      onHoverEnd={() => interactive && setIsHovered(false)}
      className={`${currentSize.container} relative flex items-center justify-center`}
    >
      {/* Aura de fond */}
      <motion.div
        animate={{
          boxShadow: isHovered
            ? '0 0 40px rgba(6, 182, 212, 0.6), 0 0 80px rgba(6, 182, 212, 0.3)'
            : '0 0 20px rgba(6, 182, 212, 0.3), 0 0 40px rgba(6, 182, 212, 0.1)',
        }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 rounded-full"
      />

      {/* Corps principal */}
      <motion.div
        animate={{
          scale: isHovered ? 1.05 : 1,
          rotateZ: isHovered ? 5 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative w-full h-full flex flex-col items-center justify-center"
      >
        {/* Tête */}
        <motion.div
          animate={{
            y: isHovered ? -2 : 0,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          className={`${currentSize.head} bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl relative shadow-lg shadow-cyan-500/50 flex items-center justify-center`}
        >
          {/* Yeux */}
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            {/* Oeil gauche */}
            <motion.div
              animate={{
                scaleY: blink ? 0.1 : 1,
              }}
              transition={{ duration: 0.15 }}
              className={`${currentSize.eye} bg-white rounded-full shadow-lg shadow-white/50`}
            />

            {/* Oeil droit */}
            <motion.div
              animate={{
                scaleY: blink ? 0.1 : 1,
              }}
              transition={{ duration: 0.15 }}
              className={`${currentSize.eye} bg-white rounded-full shadow-lg shadow-white/50`}
            />
          </div>

          {/* Sourire */}
          <motion.div
            animate={{
              scaleY: isHovered ? 1.2 : 1,
            }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-2 w-2 h-1 bg-white rounded-full"
          />
        </motion.div>

        {/* Antennes */}
        <motion.div
          animate={{
            rotateZ: isHovered ? 10 : 0,
          }}
          transition={{ duration: 0.5 }}
          className="absolute -top-1 left-2 w-1 h-3 bg-cyan-400 rounded-full"
        />
        <motion.div
          animate={{
            rotateZ: isHovered ? -10 : 0,
          }}
          transition={{ duration: 0.5 }}
          className="absolute -top-1 right-2 w-1 h-3 bg-cyan-400 rounded-full"
        />

        {/* Corps */}
        <motion.div
          animate={{
            scaleY: isHovered ? 1.1 : 1,
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          className="w-3/4 h-1/3 bg-gradient-to-b from-blue-500 to-blue-600 rounded-lg mt-1 shadow-lg shadow-blue-500/30"
        />

        {/* Bras */}
        <div className="absolute inset-0 flex items-center justify-between px-1">
          {/* Bras gauche */}
          <motion.div
            animate={{
              rotateZ: isHovered ? -20 : 0,
              y: isHovered ? -2 : 0,
            }}
            transition={{ duration: 0.5 }}
            className="w-1 h-2 bg-cyan-400 rounded-full origin-top"
            style={{ transformOrigin: 'top center' }}
          />

          {/* Bras droit */}
          <motion.div
            animate={{
              rotateZ: isHovered ? 20 : 0,
              y: isHovered ? -2 : 0,
            }}
            transition={{ duration: 0.5 }}
            className="w-1 h-2 bg-cyan-400 rounded-full origin-top"
            style={{ transformOrigin: 'top center' }}
          />
        </div>
      </motion.div>

      {/* Pulsation énergétique */}
      <motion.div
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [0.8, 1.1, 0.8],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute inset-0 border-2 border-cyan-400 rounded-full"
      />

      {/* Particules d'énergie au survol */}
      {isHovered && (
        <>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 1, scale: 1 }}
              animate={{
                opacity: 0,
                scale: 0,
                x: Math.cos((i / 3) * Math.PI * 2) * 40,
                y: Math.sin((i / 3) * Math.PI * 2) * 40,
              }}
              transition={{
                duration: 1,
                delay: i * 0.1,
                repeat: Infinity,
              }}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full"
            />
          ))}
        </>
      )}
    </motion.div>
  );
}
