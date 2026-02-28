/**
 * CATALOGUE INTERNE - Configuration des 10 Étapes
 * Mapping des modules existants aux étapes du parcours élève
 */

export const CATALOGUE_ETAPES = [
  {
    id: 1,
    label: '🎤 Le Pitch',
    subtitle: 'Capsule physique',
    description: 'L\'élève s\'enregistre et reçoit sa Carte Talent',
    objectif: 'Confiance + visibilité',
    modules: ['SimplifiedHome', 'record-video', 'enhanced-record-video', 'VideoManagement'],
    outputs: ['Carte Talent', 'Profil énergétique', 'User ID'],
    energies: ['feu', 'air', 'terre', 'eau'],
  },
  {
    id: 2,
    label: '🤖 SpotCoach',
    subtitle: 'Compétences XXIe siècle',
    description: 'Analyse du pitch et extraction des compétences dominantes',
    objectif: 'Talent → Compétence structurée',
    modules: ['SpotCoach', 'PitchAnalysisPage', 'UpdateDISC'],
    outputs: ['Compétences dominantes', 'Compétences à développer', 'Feedback IA'],
    energies: ['feu', 'air', 'terre', 'eau'],
  },
  {
    id: 3,
    label: '🌐 Métiers 2035',
    subtitle: 'Projection vers métiers hybrides',
    description: 'Mise en perspective et dialogue avec GPT',
    objectif: 'Orientation dynamique, pas figée',
    modules: ['future-jobs-generator'],
    outputs: ['Métiers hybrides', 'Orientation personnalisée'],
    energies: ['air', 'feu'],
  },
  {
    id: 4,
    label: '🎯 Micro-missions',
    subtitle: 'Missions personnalisées',
    description: 'Missions selon talent, élément dominant et passion',
    objectif: 'Transformer théorie en action',
    modules: ['galactic-map', 'LaboTransformation'],
    outputs: ['Missions personnalisées', 'Preuves de production'],
    energies: ['feu', 'air', 'terre', 'eau'],
  },
  {
    id: 5,
    label: '📂 Portfolio',
    subtitle: 'Dossier vivant',
    description: 'Import des preuves et valorisation des compétences',
    objectif: 'Construction d\'un dossier vivant',
    modules: ['genupPortfolioPage', 'video-vault'],
    outputs: ['Portfolio complet', 'Historique évolution', 'Badge mission'],
    energies: ['terre', 'eau'],
  },
  {
    id: 6,
    label: '✔ Certification SpotCoach',
    subtitle: 'Vérification IA',
    description: 'Attribution de points et répartition dans 4 éléments',
    objectif: 'Transformation en énergie',
    modules: ['video-analysis', 'video-status', 'video-success'],
    outputs: ['Points attribués', 'Scores énergétiques', 'Certification'],
    energies: ['feu', 'air', 'terre', 'eau'],
  },
  {
    id: 7,
    label: '⚡ Transfert Lumia',
    subtitle: 'Planète territoriale',
    description: 'Les points alimentent la planète locale',
    objectif: 'L\'individuel nourrit le collectif',
    modules: ['LumiUnifiedProfile', 'lumi-onboarding', 'CockpitPage'],
    outputs: ['Agrégation territoriale', 'Dashboard admin', 'Leaderboard'],
    energies: ['feu', 'air', 'terre', 'eau'],
  },
  {
    id: 8,
    label: '🤝 Projet Collectif',
    subtitle: 'Formation de constellations',
    description: 'Filtre par territoire et élément, formation groupes complémentaires',
    objectif: 'Passage du solo au groupe',
    modules: ['ModuleMimetique'],
    outputs: ['Constellations formées', 'Groupes complémentaires'],
    energies: ['eau', 'terre'],
  },
  {
    id: 9,
    label: '🏆 Score Projet',
    subtitle: 'Classement territorial',
    description: 'Calcul des points collectifs et équilibre des 4 éléments',
    objectif: 'Sélection des projets forts',
    modules: ['TrendsDashboard'],
    outputs: ['Score collectif', 'Classement territorial', 'Équilibre énergétique'],
    energies: ['feu', 'air', 'terre', 'eau'],
  },
  {
    id: 10,
    label: '🔟 SpotBulle Executive',
    subtitle: 'Incubateur premium',
    description: 'Rendez-vous, pitch devant jury, accompagnement réel',
    objectif: 'Passage à l\'impact concret',
    modules: ['SpotBullePremium', 'company-record', 'company-signin'],
    outputs: ['Rendez-vous agendé', 'Accompagnement', 'Déploiement'],
    energies: ['feu', 'air'],
  },
];

export const ENERGIES = {
  feu: {
    label: 'FEU',
    icon: '🔥',
    color: '#F97316',
    description: 'Leadership & Impact',
    attributes: ['Leadership', 'Action', 'Pitch'],
  },
  air: {
    label: 'AIR',
    icon: '🌬',
    color: '#0EA5E9',
    description: 'Innovation & Vision',
    attributes: ['Innovation', 'Vision', 'Créativité'],
  },
  terre: {
    label: 'TERRE',
    icon: '🌍',
    color: '#22C55E',
    description: 'Structure & Organisation',
    attributes: ['Organisation', 'Structure', 'Économie'],
  },
  eau: {
    label: 'EAU',
    icon: '💧',
    color: '#06B6D4',
    description: 'Cohésion & Impact Social',
    attributes: ['Cohésion', 'Inclusion', 'Impact social'],
  },
};

export const MODULES_MAP = {
  'SimplifiedHome': { etape: 1, label: 'Accueil' },
  'record-video': { etape: 1, label: 'Enregistrement vidéo' },
  'enhanced-record-video': { etape: 1, label: 'Enregistrement amélioré' },
  'VideoManagement': { etape: 1, label: 'Gestion vidéos' },
  'SpotCoach': { etape: 2, label: 'Coach IA' },
  'PitchAnalysisPage': { etape: 2, label: 'Analyse pitch' },
  'UpdateDISC': { etape: 2, label: 'Mise à jour DISC' },
  'future-jobs-generator': { etape: 3, label: 'Générateur métiers' },
  'galactic-map': { etape: 4, label: 'Carte galactique' },
  'LaboTransformation': { etape: 4, label: 'Labo transformation' },
  'genupPortfolioPage': { etape: 5, label: 'Portfolio' },
  'video-vault': { etape: 5, label: 'Coffre vidéos' },
  'video-analysis': { etape: 6, label: 'Analyse vidéo' },
  'video-status': { etape: 6, label: 'Statut vidéo' },
  'video-success': { etape: 6, label: 'Succès vidéo' },
  'LumiUnifiedProfile': { etape: 7, label: 'Profil LUMIA' },
  'lumi-onboarding': { etape: 7, label: 'Onboarding LUMIA' },
  'CockpitPage': { etape: 7, label: 'Cockpit SPOT' },
  'ModuleMimetique': { etape: 8, label: 'Module mimétique' },
  'TrendsDashboard': { etape: 9, label: 'Dashboard tendances' },
  'SpotBullePremium': { etape: 10, label: 'Premium' },
  'company-record': { etape: 10, label: 'Enregistrement entreprise' },
  'company-signin': { etape: 10, label: 'Connexion entreprise' },
};

export const getEtapeByModule = (moduleName) => {
  const moduleInfo = MODULES_MAP[moduleName];
  if (!moduleInfo) return null;
  return CATALOGUE_ETAPES.find(e => e.id === moduleInfo.etape);
};

export const getModulesByEtape = (etapeId) => {
  const etape = CATALOGUE_ETAPES.find(e => e.id === etapeId);
  if (!etape) return [];
  return etape.modules.map(m => MODULES_MAP[m]);
};

export const getNextEtape = (currentEtapeId) => {
  return CATALOGUE_ETAPES.find(e => e.id === currentEtapeId + 1);
};

export const getPreviousEtape = (currentEtapeId) => {
  return CATALOGUE_ETAPES.find(e => e.id === currentEtapeId - 1);
};
