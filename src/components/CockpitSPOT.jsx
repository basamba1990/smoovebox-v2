import React, { useState } from 'react';
import RobotIO from './RobotIO';

/**
 * CockpitSPOT - Interface principale avec la mascotte robot
 */
export default function CockpitSPOT() {
  const [robotMessage, setRobotMessage] = useState("Salut, je suis prêt à jouer ! ⚽");

  // Gestion des interactions avec le robot
  const handleRobotInteraction = (action) => {
    console.log('Interaction robot :', action);
    if (action === 'kick') {
      setRobotMessage("But ! Incroyable frappe ! 🚀");
      setTimeout(() => setRobotMessage("Encore une ? Clique sur moi !"), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-white mb-8">Cockpit SPOT</h1>
      
      {/* Mascotte robot */}
      <RobotIO
        size="lg"               // Taille : sm, md, lg
        interactive={true}
        message={robotMessage}
        onInteraction={handleRobotInteraction}
      />

      {/* Autres contrôles du cockpit (exemple) */}
      <div className="mt-12 grid grid-cols-2 gap-4 max-w-md">
        <button
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-6 rounded-xl transition"
          onClick={() => setRobotMessage("En avant ! 💨")}
        >
          Avancer
        </button>
        <button
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-xl transition"
          onClick={() => setRobotMessage("Tire au but ! ⚽")}
        >
          Tirer
        </button>
      </div>

      <p className="text-slate-400 text-sm mt-8">
        Clique sur le robot pour le voir frapper dans le ballon !
      </p>
    </div>
  );
}
