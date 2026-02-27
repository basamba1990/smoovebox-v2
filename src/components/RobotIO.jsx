import React from 'react';
import { motion } from 'framer-motion';

/**
 * Composant Mascotte Robot IO
 * Robot bleu turquoise animé et interactif.
 *
 * @param {string} message - Message à afficher dans la bulle.
 * @param {string} action - État d'anulation ('idle', 'thinking', 'speaking').
 */
export default function RobotIO({ message, action = 'idle' }) {
  // Variations d'animation selon l'action
  const getAnimation = () => {
    switch (action) {
      case 'thinking':
        return {
          y: [0, -5, 0],
          scale: [1, 1.02, 1],
          transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        };
      case 'speaking':
        return {
          scale: [1, 1.03, 1],
          transition: { duration: 0.5, repeat: Infinity },
        };
      default:
        return {
          y: [0, -8, 0],
          scale: 1,
          transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        };
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <motion.div
        animate={getAnimation()}
        className="relative w-32 h-32"
      >
        {/* Corps du Robot */}
        <div className="absolute inset-0 bg-cyan-400 rounded-full shadow-[0_0_30px_rgba(34,211,238,0.6)] border-2 border-cyan-200 overflow-hidden">
          {/* Yeux */}
          <div className="absolute top-1/3 left-1/4 w-4 h-4 bg-white rounded-full animate-pulse" />
          <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-white rounded-full animate-pulse" />
          {/* Écran Central */}
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-12 h-8 bg-slate-900/50 rounded-lg border border-cyan-300/30 flex items-center justify-center">
            <div className="w-6 h-1 bg-cyan-400 rounded-full animate-bounce" />
          </div>
        </div>
        {/* Antennes / Effets de brillance */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-6 bg-cyan-200 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
      </motion.div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-slate-800/80 backdrop-blur-md border border-cyan-500/30 p-4 rounded-2xl max-w-xs text-center shadow-xl"
        >
          <p className="text-cyan-100 text-sm font-medium leading-relaxed">{message}</p>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-slate-800/80" />
        </motion.div>
      )}
    </div>
  );
}
