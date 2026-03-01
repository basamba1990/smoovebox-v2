/**
 * ModuleMimetique - VERSION REFACTOREE
 * Page principale du 3ème module avec système d'onglets :
 * - Cockpit SPOT (Tableau de bord énergétique)
 * - Évaluation IA (Analyse des compétences)
 * - Parcours (Missions prioritaires)
 * - Écosystème (LUMIA Territoriale)
 * - Enregistrement (Capture vidéo)
 */

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import OdysseyLayout from "../components/OdysseyLayout.jsx";
import { Button } from "../components/ui/button.jsx";
import EnhancedRecordVideo from "./enhanced-record-video.jsx";
import CockpitSPOT from "../components/CockpitSPOT.jsx";
import AISkillsEvaluator from "../components/AISkillsEvaluator.jsx";
import { useLumiaFlow } from "../hooks/useLumiaFlow.js";
import { 
  LayoutDashboard, 
  BrainCircuit, 
  Target, 
  Globe, 
  Video,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function ModuleMimetique({ 
  user, 
  profile, 
  onSignOut, 
  onVideoUploaded, 
  cameraChecked 
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cockpit");
  const { userLumiaProfile, isLoading } = useLumiaFlow();

  const tabs = [
    { id: "cockpit", label: "Cockpit SPOT", icon: <LayoutDashboard size={18} />, color: "teal" },
    { id: "evaluation", label: "Évaluation IA", icon: <BrainCircuit size={18} />, color: "purple" },
    { id: "parcours", label: "Parcours", icon: <Target size={18} />, color: "orange" },
    { id: "ecosysteme", label: "Écosystème", icon: <Globe size={18} />, color: "blue" },
    { id: "enregistrement", label: "Enregistrement", icon: <Video size={18} />, color: "cyan" },
  ];

  const handleNavigatePrevious = () => navigate("/scan-elements");
  const handleNavigateNext = () => navigate("/labo-transformation");

  return (
    <OdysseyLayout
      currentStep={3}
      title=""
      maxWidthClass="max-w-6xl"
      onSignOut={onSignOut}
    >
      {/* Header Section - Alignement sur l'image fournie */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Module Mimétique – <span className="text-cyan-400">Cockpit SPOT</span>
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Pilotez votre énergie, enregistrez vos pitchs, explorez votre potentiel.
            </p>
          </div>
          
          {/* Navigation par onglets - Style professionnel */}
          <nav className="flex flex-wrap gap-2 p-1 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300
                  ${activeTab === tab.id 
                    ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/30 shadow-lg shadow-${tab.color}-500/10` 
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent"}
                `}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </motion.header>

      {/* Zone de Contenu Dynamique */}
      <main className="min-h-[600px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {activeTab === "cockpit" && (
              <div className="glass-card rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                <CockpitSPOT />
              </div>
            )}

            {activeTab === "evaluation" && (
              <div className="glass-card p-8 rounded-3xl border border-purple-500/20 bg-slate-900/40 backdrop-blur-xl">
                <AISkillsEvaluator userId={user?.id} />
              </div>
            )}

            {activeTab === "parcours" && (
              <div className="glass-card p-8 rounded-3xl border border-orange-500/20 bg-slate-900/40 backdrop-blur-xl text-center">
                <Target className="mx-auto text-orange-400 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-white mb-2">Missions Prioritaires</h2>
                <p className="text-slate-400 max-w-md mx-auto">
                  Consultez vos missions en cours et votre progression dans le parcours SPOT.
                </p>
                {/* Intégration future des missions ici */}
              </div>
            )}

            {activeTab === "ecosysteme" && (
              <div className="glass-card p-8 rounded-3xl border border-blue-500/20 bg-slate-900/40 backdrop-blur-xl text-center">
                <Globe className="mx-auto text-blue-400 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-white mb-2">Écosystème LUMIA</h2>
                <p className="text-slate-400 max-w-md mx-auto">
                  Visualisez l'impact de vos actions sur votre territoire énergétique.
                </p>
                {/* Intégration future de la carte ici */}
              </div>
            )}

            {activeTab === "enregistrement" && (
              <div className="glass-card rounded-3xl border border-cyan-500/20 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
                <EnhancedRecordVideo
                  user={user}
                  profile={profile}
                  onSignOut={onSignOut}
                  onVideoUploaded={onVideoUploaded}
                  cameraChecked={cameraChecked}
                  embedInOdyssey
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Navigation */}
      <footer className="mt-12 flex justify-between items-center border-t border-slate-800 pt-8">
        <Button
          onClick={handleNavigatePrevious}
          variant="outline"
          className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl px-6"
        >
          <ChevronLeft className="mr-2" size={18} /> Précédent
        </Button>

        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-full">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Étape 3 sur 7 : Miroir de l'Étoile
          </span>
        </div>

        <Button
          onClick={handleNavigateNext}
          className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl px-8 font-bold shadow-lg shadow-cyan-500/20"
        >
          Continuer <ChevronRight className="ml-2" size={18} />
        </Button>
      </footer>

      {/* Styles additionnels pour les couleurs dynamiques Tailwind */}
      <style dangerouslySetInnerHTML={{ __html: `
        .bg-teal-500\\/20 { background-color: rgba(20, 184, 166, 0.2); }
        .text-teal-400 { color: rgb(45, 212, 191); }
        .border-teal-500\\/30 { border-color: rgba(20, 184, 166, 0.3); }
        .shadow-teal-500\\/10 { shadow-color: rgba(20, 184, 166, 0.1); }

        .bg-purple-500\\/20 { background-color: rgba(168, 85, 247, 0.2); }
        .text-purple-400 { color: rgb(192, 132, 252); }
        .border-purple-500\\/30 { border-color: rgba(168, 85, 247, 0.3); }
        .shadow-purple-500\\/10 { shadow-color: rgba(168, 85, 247, 0.1); }

        .bg-orange-500\\/20 { background-color: rgba(249, 115, 22, 0.2); }
        .text-orange-400 { color: rgb(251, 146, 60); }
        .border-orange-500\\/30 { border-color: rgba(249, 115, 22, 0.3); }
        .shadow-orange-500\\/10 { shadow-color: rgba(249, 115, 22, 0.1); }

        .bg-blue-500\\/20 { background-color: rgba(59, 130, 246, 0.2); }
        .text-blue-400 { color: rgb(96, 165, 250); }
        .border-blue-500\\/30 { border-color: rgba(59, 130, 246, 0.3); }
        .shadow-blue-500\\/10 { shadow-color: rgba(59, 130, 246, 0.1); }

        .bg-cyan-500\\/20 { background-color: rgba(6, 182, 212, 0.2); }
        .text-cyan-400 { color: rgb(34, 211, 238); }
        .border-cyan-500\\/30 { border-color: rgba(6, 182, 212, 0.3); }
        .shadow-cyan-500\\/10 { shadow-color: rgba(6, 182, 212, 0.1); }
      `}} />
    </OdysseyLayout>
  );
}
