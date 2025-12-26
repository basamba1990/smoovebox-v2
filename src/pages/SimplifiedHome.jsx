// src/pages/SimplifiedHome.jsx
import React, { useState, useEffect, useMemo } from "react";
import Dashboard from "../components/Dashboard.jsx";
import RecordVideo from "./record-video.jsx";
import ProfessionalHeader from "../components/ProfessionalHeader.jsx";
import ProfileForm from "../components/ProfileForm.jsx";
import VideoVault from "./video-vault.jsx";
import { Button } from "../components/ui/button-enhanced.jsx";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useVideos } from "../hooks/useVideos.js";
import { useQueryClient } from "@tanstack/react-query";
import { checkCompanyMembershipAndRedirect } from "../utils/companyRedirect.js";
import { AlertCircle } from "lucide-react";

// ✅ TOUS LES IMPORTS DES COMPOSANTS
import Questionnaire from "../components/Questionnaire.jsx";
import SeminarsList from "../components/SeminarsList.jsx";
import Certification from "../components/Certification.jsx";
import ImmersionSimulator from "../components/ImmersionSimulator.jsx";
import ComplementaryMatches from "../components/ComplementaryMatches.jsx";
import LanguageSelector from "../components/LanguageSelector.jsx";
import PersonasSelector from "../components/PersonasSelector.jsx";
import SoftPowerPassions from "../components/SoftPowerPassions.jsx";
import PitchRecording from "../components/PitchRecording.jsx";
import FootballChatModal from "../components/FootballChatModal.jsx";
import QuickActions from "../components/QuickActions.jsx";
import VideoGenerationPanel from "../components/VideoGenerationPanel.jsx";
import FutureJobsStats from "../components/FutureJobsStats.jsx";

// ✅ Navigation simplifiée complète
const simplifiedTabs = [
  {
    id: "record",
    name: "🎥 Enregistrer",
    icon: "🎥",
    priority: 1,
    description: "Créer une nouvelle vidéo",
  },
  {
    id: "vault",
    name: "📁 Mes Vidéos",
    icon: "📁",
    priority: 2,
    description: "Gérer toutes mes vidéos",
  },
  {
    id: "dashboard",
    name: "📊 Tableau de bord",
    icon: "📊",
    priority: 3,
    description: "Voir mes statistiques",
  },
  {
    id: "profile",
    name: "👤 Profil",
    icon: "👤",
    priority: 4,
    description: "Gérer mon compte",
  },
  {
    id: "community",
    name: "👥 Communauté",
    icon: "👥",
    priority: 5,
    description: "Trouver des synergies",
  },
  {
    id: "more",
    name: "☰ Menu",
    icon: "☰",
    priority: 6,
    description: "Autres fonctionnalités",
  },
];

export default function SimplifiedHome({
  user,
  profile,
  connectionStatus,
  onSignOut,
  dashboardData,
  loading,
  error,
  onProfileUpdated,
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("record");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("main");
  const [activeImmersionTab, setActiveImmersionTab] = useState("parcours");
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [appError, setAppError] = useState(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);
  const [showVideoGeneration, setShowVideoGeneration] = useState(false);

  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  // ✅ Hook React Query pour les vidéos
  const { data: videos = [], isLoading: videosLoading, error: videosError } = useVideos();

  // ✅ Calcul des statistiques utilisateur
  const userStats = useMemo(() => {
    if (!videos || videos.length === 0) {
      return {
        totalVideos: 0,
        recentVideos: [],
        completedVideos: 0,
        processingVideos: 0,
      };
    }

    return {
      totalVideos: videos.length,
      recentVideos: videos.slice(0, 3).map(v => ({
        id: v.id,
        status: v.status,
        created_at: v.created_at,
        title: v.title,
      })),
      completedVideos: videos.filter((v) => v.status === "analyzed").length,
      processingVideos: videos.filter(
        (v) => v.status === "processing" || v.status === "analyzing"
      ).length,
    };
  }, [videos]);

  // ✅ Vérifier si l'utilisateur est une entreprise
  useEffect(() => {
    if (user) {
      checkCompanyMembershipAndRedirect(navigate);
    }
  }, [user, navigate]);

  // ✅ Gestion des erreurs
  useEffect(() => {
    if (videosError) {
      console.error("❌ Erreur chargement stats:", videosError);
      setAppError(`Erreur chargement statistiques: ${videosError.message}`);
    }
  }, [videosError]);

  const handleVideoUploaded = () => {
    console.log("🔄 Vidéo uploadée, rechargement des données");
    toast.success("Vidéo uploadée avec succès !");

    if (user) {
      queryClient.invalidateQueries({ queryKey: ['videos', user.id] });
    }

    setRefreshKey((prev) => prev + 1);
  };

  const handleProfileUpdated = () => {
    toast.success("Profil mis à jour !");
    if (onProfileUpdated) {
      onProfileUpdated();
    }
  };

  // ✅ Régénérer le DISC
  const handleRegenerateDISC = async () => {
    if (!user) {
      toast.error("Vous devez être connecté pour régénérer le DISC.");
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir régénérer votre DISC ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("questionnaire_responses")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      await supabase
        .from("profiles")
        .update({
          dominant_color: null,
        })
        .eq("id", user.id);

      toast.success("Ancien DISC supprimé. Redirection vers le questionnaire.");
      navigate("/update-disc");
    } catch (error) {
      console.error("Erreur lors de la régénération du DISC:", error);
      toast.error("Erreur lors de la suppression de l'ancien DISC.");
    }
  };

  const handleQuestionnaireComplete = () => {
    setShowQuestionnaire(false);
    toast.success("Questionnaire complété ! Votre profil est maintenant enrichi.");
  };

  // ✅ Gestionnaire de langue
  const handleLanguageChange = (languageCode) => {
    setSelectedLanguage(languageCode);
    console.log("🌐 Langue sélectionnée pour transcription:", languageCode);
    toast.success(`Langue sélectionnée: ${languageCode || "Détection automatique"}`);
  };

  // ✅ Scénarios d'enregistrement
  const recordingScenarios = {
    enfants: [
      "🎙 Dis-moi pourquoi tu aimes ton sport préféré.",
      "🎙 Qu'est-ce que tu ressens quand tu marques un but / réussis ton coup ?",
      "🎙 Si tu devais inventer ton club idéal, à quoi ressemblerait-il ?",
    ],
    adolescents: [
      "🎙 Comment le foot (ou ton sport) t'aide à grandir dans la vie ?",
      "🎙 Raconte un moment où tu as douté, mais où tu t'es relevé.",
      "🎙 Où te vois-tu dans 5 ans grâce à ta passion ?",
      "🎙 Quel joueur ou joueuse t'inspire le plus, et pourquoi ?",
    ],
    adultes: [
      "🎙 Comment ton sport reflète ta personnalité ?",
      "🎙 Quel lien fais-tu entre ton sport et ta vie professionnelle ?",
      "🎙 Que t'apprend ton sport sur la gestion de la pression, de l'échec ou du leadership ?",
    ],
  };

  // ✅ Navigation par actions rapides
  const onSelectQuickAction = (id) => {
    setActiveTab(id);
    if (id === "more") setActiveSubTab("main");
  };

  // ✅ Statistiques rapides
  const renderQuickStats = () => {
    if (!userStats || userStats.totalVideos === 0) return null;

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-900/30 rounded-lg p-4 text-center border border-blue-700">
          <div className="text-2xl font-bold text-white">{userStats.totalVideos}</div>
          <div className="text-blue-300 text-sm">Total Vidéos</div>
        </div>
        <div className="bg-green-900/30 rounded-lg p-4 text-center border border-green-700">
          <div className="text-2xl font-bold text-white">{userStats.completedVideos}</div>
          <div className="text-green-300 text-sm">Analysées</div>
        </div>
        <div className="bg-purple-900/30 rounded-lg p-4 text-center border border-purple-700">
          <div className="text-2xl font-bold text-white">{userStats.recentVideos.length}</div>
          <div className="text-purple-300 text-sm">Récentes</div>
        </div>
        <div className="bg-yellow-900/30 rounded-lg p-4 text-center border border-yellow-700">
          <div className="text-2xl font-bold text-white">{userStats.processingVideos}</div>
          <div className="text-yellow-300 text-sm">En traitement</div>
        </div>
      </div>
    );
  };

  // ✅ Contenu de l'onglet "Community"
  const renderCommunityContent = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-french font-bold text-white">👥 Communauté & Synergies</h2>
          <Button onClick={() => setActiveTab("record")} className="bg-blue-600 hover:bg-blue-700 text-white">
            🎥 Nouvelle Vidéo
          </Button>
        </div>
        <ComplementaryMatches user={user} profile={profile} />
      </div>
    );
  };

  // ✅ Contenu de l'onglet "Plus"
  const renderMoreContent = () => {
    switch (activeSubTab) {
      case "seminars":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎓 Séminaires & Formations</h2>
              <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                ← Retour
              </Button>
            </div>
            <SeminarsList user={user} profile={profile} onSignOut={onSignOut} />
          </div>
        );

      case "certification":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🏆 Certification</h2>
              <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                ← Retour
              </Button>
            </div>
            <Certification user={user} profile={profile} onSignOut={onSignOut} />
          </div>
        );

      case "immersion":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎮 Préparation & Immersion</h2>
              <div className="flex gap-2">
                <Button variant={activeImmersionTab === "parcours" ? "default" : "outline"} onClick={() => setActiveImmersionTab("parcours")} className="btn-spotbulle-dark">
                  🧭 Parcours
                </Button>
                <Button variant={activeImmersionTab === "scenarios" ? "default" : "outline"} onClick={() => setActiveImmersionTab("scenarios")} className="btn-spotbulle-dark">
                  🎬 Scénarios
                </Button>
                <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                  ← Retour
                </Button>
              </div>
            </div>
            {renderImmersionContent()}
          </div>
        );

      case "pitchrecording":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎤 Pitch Recording</h2>
              <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                ← Retour
              </Button>
            </div>
            <PitchRecording user={user} profile={profile} />
          </div>
        );

      case "softpower":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🌟 Soft Power Passions</h2>
              <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                ← Retour
              </Button>
            </div>
            <SoftPowerPassions user={user} profile={profile} />
          </div>
        );

      case "personas":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎭 Personas & Modèle M/T</h2>
              <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                ← Retour
              </Button>
            </div>
            <PersonasSelector user={user} profile={profile} />
          </div>
        );

      case "language":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🌐 Sélection de la Langue</h2>
              <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                ← Retour
              </Button>
            </div>
            <LanguageSelector selectedLanguage={selectedLanguage} onLanguageChange={handleLanguageChange} showAutoDetect={true} />
          </div>
        );

      case "futurejobs":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🚀 Métiers du Futur</h2>
              <Button onClick={() => setActiveSubTab("main")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">
                ← Retour
              </Button>
            </div>
            <FutureJobsStats user={user} profile={profile} />
            <div className="mt-6">
              <Button onClick={() => navigate("/future-jobs-generator")} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-3">
                🎬 Ouvrir le Générateur de Vidéos
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">➕ Fonctionnalités Avancées</h2>
              <Button onClick={() => setActiveTab("record")} className="bg-blue-600 hover:bg-blue-700 text-white">
                🎥 Nouvelle Vidéo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { id: "seminars", icon: "🎓", title: "Séminaires", desc: "Formations et ateliers", color: "from-purple-600 to-purple-700" },
                { id: "certification", icon: "🏆", title: "Certification", desc: "Obtenez votre certification", color: "from-green-600 to-green-700" },
                { id: "immersion", icon: "🎮", title: "Préparation", desc: "Exercices d'immersion", color: "from-orange-600 to-orange-700" },
                { id: "community", icon: "👥", title: "Communauté", desc: "Rencontrez d'autres passionnés", color: "from-blue-600 to-blue-700", action: () => setActiveTab("community") },
                { id: "questionnaire", icon: "🎨", title: "Test Personnalité", desc: "Découvrez votre profil", color: "from-pink-600 to-pink-700", action: () => setShowQuestionnaire(true) },
                { id: "language", icon: "🌐", title: "Langues", desc: "Sélectionnez votre langue", color: "from-cyan-600 to-cyan-700" },
                { id: "personas", icon: "🎭", title: "Personas & M/T", desc: "Configurez votre assistant", color: "from-red-600 to-red-700" },
                { id: "softpower", icon: "🌟", title: "Soft Power", desc: "Exprimez vos passions", color: "from-yellow-600 to-yellow-700" },
                { id: "pitchrecording", icon: "🎤", title: "Pitch Recording", desc: "Enregistrez votre pitch", color: "from-teal-600 to-teal-700" },
                { id: "futurejobs", icon: "🚀", title: "Métiers du Futur", desc: "Générez des vidéos IA", color: "from-indigo-600 to-indigo-700" },
                { id: "trends", icon: "📈", title: "Tendances", desc: "Visualisez le marché", color: "from-amber-600 to-amber-700", action: () => navigate("/trends-dashboard") },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => item.action ? item.action() : setActiveSubTab(item.id)}
                  className={`bg-gradient-to-br ${item.color} rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg`}
                >
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-white/90 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  // ✅ Contenu de l'immersion
  const renderImmersionContent = () => {
    switch (activeImmersionTab) {
      case "parcours":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: "concentration", name: "🧠 Concentration", desc: "Améliore ta concentration", duration: "2-3 min", color: "from-blue-500 to-cyan-600" },
                { id: "confiance", name: "💪 Confiance en soi", desc: "Développe ta confiance", duration: "2-3 min", color: "from-green-500 to-emerald-600" },
                { id: "relaxation", name: "🌊 Relaxation", desc: "Détends-toi naturellement", duration: "2-3 min", color: "from-purple-500 to-pink-600" },
              ].map((activity) => (
                <div key={activity.id} className={`bg-gradient-to-br ${activity.color} rounded-xl p-6 text-white cursor-pointer transform hover:scale-105 transition-all duration-300 shadow-lg`} onClick={() => { setActiveTab("record"); toast.info(`Activité ${activity.name} sélectionnée`); }}>
                  <div className="text-3xl mb-3">{activity.name.split(" ")[0]}</div>
                  <h3 className="font-bold text-lg mb-2">{activity.name}</h3>
                  <p className="text-white/90 text-sm mb-3">{activity.desc}</p>
                  <div className="text-xs bg-white/20 rounded-full px-3 py-1 inline-block">⏱️ {activity.duration}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "scenarios":
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-french font-bold text-white mb-4">🎬 Scénarios d'Expression Orale</h3>
            {Object.entries(recordingScenarios).map(([ageGroup, scenarios]) => (
              <div key={ageGroup} className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
                <h4 className="text-lg font-semibold text-white mb-4 capitalize">
                  {ageGroup === "enfants" ? "👦 Pour les Jeunes (8-12 ans)" : ageGroup === "adolescents" ? "👨‍🎓 Pour les Adolescents (13-17 ans)" : "👨‍💼 Pour les Adultes (18+)"}
                </h4>
                <div className="space-y-3">
                  {scenarios.map((scenario, index) => (
                    <div key={index} className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-blue-500 transition-colors cursor-pointer" onClick={() => { setActiveTab("record"); toast.info(`Scénario sélectionné: ${scenario}`); }}>
                      <p className="text-gray-200">{scenario}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-400">⏱️ 2 minutes maximum</span>
                        <Button size="sm" variant="outline" className="border-blue-500 text-blue-300 text-xs">Utiliser ce scénario →</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-white mb-2">Module d'Immersion</h3>
            <p className="text-gray-300 mb-4">Préparez-vous à l'enregistrement avec nos exercices d'immersion</p>
            <Button onClick={() => setActiveImmersionTab("parcours")} className="bg-blue-600 hover:bg-blue-700 text-white">Commencer l'immersion</Button>
          </div>
        );
    }
  };

  // ✅ Contenu des onglets principaux
  const renderTabContent = () => {
    switch (activeTab) {
      case "record":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">🎥 Enregistrer une Vidéo</h2>
              <div className="flex gap-2">
                <Button onClick={() => setShowLanguageOptions((v) => !v)} variant="outline" className="flex items-center gap-2 border-cyan-500 text-cyan-300 hover:bg-cyan-900">
                  {showLanguageOptions ? "Masquer" : "Afficher"} options langue
                </Button>
              </div>
            </div>

            {showLanguageOptions && (
              <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700">
                <LanguageSelector selectedLanguage={selectedLanguage} onLanguageChange={(lang) => { setSelectedLanguage(lang); console.log("🌐 Langue sélectionnée:", lang); }} showAutoDetect={true} compact={false} />
              </div>
            )}

            <RecordVideo user={user} onVideoUploaded={handleVideoUploaded} selectedLanguage={selectedLanguage} onError={(error) => { console.error("❌ Erreur RecordVideo:", error); setAppError(`Erreur enregistrement: ${error.message}`); }} />
          </div>
        );

      case "vault":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">📁 Mon Coffre-fort Vidéo</h2>
              <Button onClick={() => setActiveTab("record")} className="bg-blue-600 hover:bg-blue-700 text-white">🎥 Nouvelle Vidéo</Button>
            </div>
            <VideoVault user={user} profile={profile} onSignOut={onSignOut} onVideoAdded={handleVideoUploaded} />
          </div>
        );

      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">📊 Tableau de Bord Complet</h2>
              <div className="flex gap-2">
                <Button onClick={() => setActiveTab("record")} className="bg-blue-600 hover:bg-blue-700 text-white">🎥 Nouvelle Vidéo</Button>
                <Button onClick={() => navigate("/dashboard")} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">📈 Vue détaillée</Button>
              </div>
            </div>
            <Dashboard refreshKey={refreshKey} onVideoUploaded={handleVideoUploaded} />
          </div>
        );

      case "profile":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-french font-bold text-white">👤 Mon Profil</h2>
              <div className="flex gap-2">
                <Button onClick={() => navigate("/update-disc")} variant="outline" className="flex items-center gap-2 border-purple-400 text-purple-300 hover:bg-purple-900">📝 Voir / Mettre à jour le DISC</Button>
                <Button onClick={handleRegenerateDISC} variant="outline" className="flex items-center gap-2 border-red-400 text-red-300 hover:bg-red-900">🔄 Regénérer le DISC</Button>
                <Button onClick={() => setActiveTab("dashboard")} variant="outline" className="flex items-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700">← Retour</Button>
              </div>
            </div>
            <ProfileForm user={user} profile={profile} onProfileUpdated={handleProfileUpdated} />
          </div>
        );

      case "community":
        return renderCommunityContent();

      case "more":
        return renderMoreContent();

      default:
        return (
          <RecordVideo user={user} onVideoUploaded={handleVideoUploaded} selectedLanguage={selectedLanguage} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <ProfessionalHeader user={user} profile={profile} connectionStatus={connectionStatus} onSignOut={onSignOut} currentSection={activeTab} welcomeTitle={`🎯 Bienvenue${profile?.full_name ? `, ${profile.full_name}` : ""} !`} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* ✅ Affichage des erreurs globales */}
        {(appError || error) && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div>
                  <h4 className="font-semibold text-red-300">Erreur</h4>
                  <p className="text-red-200 text-sm mt-1">{appError || error}</p>
                </div>
              </div>
              <Button onClick={() => { setAppError(null); }} variant="outline" size="sm" className="border-red-600 text-red-300 hover:bg-red-800">×</Button>
            </div>
          </div>
        )}

        {/* ✅ Navigation par actions rapides */}
        <QuickActions simplifiedTabs={simplifiedTabs} activeTab={activeTab} onSelectTab={onSelectQuickAction} />

        {/* ✅ Statistiques rapides */}
        {userStats && userStats.totalVideos > 0 && renderQuickStats()}

        {/* ✅ Indicateur pour nouvelle utilisateur */}
        {userStats && userStats.totalVideos === 0 && activeTab !== "record" && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎥</span>
                <div>
                  <p className="font-semibold">Commencez par enregistrer votre première vidéo !</p>
                  <p className="text-sm opacity-90">Exprimez-vous devant la caméra et découvrez l'analyse automatique de votre contenu.</p>
                </div>
              </div>
              <Button onClick={() => setActiveTab("record")} className="bg-white text-blue-600 hover:bg-gray-100 border-0 font-semibold">🎥 Commencer</Button>
            </div>
          </div>
        )}

        {/* Contenu de l'onglet */}
        <div className="card-spotbulle-dark p-6 bg-gray-800 border-gray-700 rounded-xl">
          {renderTabContent()}
        </div>
      </main>

      {/* ✅ Boutons d'action rapide flottants */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <Button onClick={() => navigate("/lumi/onboarding")} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg text-lg py-3 px-4 rounded-full flex items-center gap-2 hover:scale-105 transition-transform" title="Découvre ta couleur DISC">🎨 DISC</Button>
        <Button onClick={() => navigate("/spotcoach")} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg text-lg py-3 px-4 rounded-full flex items-center gap-2 hover:scale-105 transition-transform" title="SpotCoach - Profil Symbolique">🎯 SpotCoach</Button>
        <Button onClick={() => navigate("/lumi/profile")} className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg text-lg py-3 px-4 rounded-full flex items-center gap-2 hover:scale-105 transition-transform" title="Découvre tes métiers du futur">🚀 Métiers</Button>
        <Button onClick={() => setShowChatModal(true)} className="bg-green-600 hover:bg-green-700 text-white shadow-lg text-lg py-3 px-4 rounded-full flex items-center gap-2 hover:scale-105 transition-transform" title="Assistant Football">⚽</Button>
        <Button onClick={() => setActiveTab("record")} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-lg py-4 px-6 rounded-full flex items-center gap-2 animate-bounce">🎥 Nouvelle Vidéo</Button>
      </div>

      {/* ✅ Modal Questionnaire */}
      {showQuestionnaire && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">🎨 Test de Personnalité</h2>
                <Button onClick={() => setShowQuestionnaire(false)} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">✕ Fermer</Button>
              </div>
              <Questionnaire onComplete={handleQuestionnaireComplete} showSkip={true} isModal={true} />
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal Chat Football */}
      <FootballChatModal isOpen={showChatModal} onClose={() => setShowChatModal(false)} />

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-gray-800 text-center text-gray-400">
        <p>© 2026 SpotBulle - Tous droits réservés</p>
      </footer>
    </div>
  );
}
