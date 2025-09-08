// src/constants/videoStatus.js

// Constantes pour les statuts vidéo alignées avec les valeurs de la base de données
export const VIDEO_STATUS = {
  // Statuts utilisés dans l'application
  UPLOADING: 'draft',       // Pendant l'upload, considéré comme brouillon
  UPLOADED: 'uploaded',     // Nouveau statut: Fichier uploadé, prêt pour traitement
  PROCESSING: 'processing', // En cours de traitement (général)
  TRANSCRIBING: 'transcribing', // Nouveau statut: Transcription en cours
  TRANSCRIBED: 'transcribed', // Nouveau statut: Transcription terminée
  ANALYZING: 'analyzing',   // Nouveau statut: Analyse en cours
  ANALYZED: 'published',    // Analyse terminée (correspond à 'published' en DB)
  FAILED: 'failed',         // Échec du traitement
  ERROR: 'failed',          // Alias pour FAILED
  
  // Statuts correspondant aux valeurs de la base de données
  PENDING: 'draft',
  COMPLETED: 'published'
};

// Constantes pour les statuts de transcription
export const TRANSCRIPTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Fonctions utilitaires pour vérifier les statuts
export const isProcessingStatus = (status) => {
  return status === VIDEO_STATUS.PROCESSING || 
         status === VIDEO_STATUS.TRANSCRIBING ||
         status === VIDEO_STATUS.ANALYZING ||
         status === 'processing';
};

export const isCompletedStatus = (status) => {
  return status === VIDEO_STATUS.PUBLISHED || 
         status === VIDEO_STATUS.COMPLETED ||
         status === VIDEO_STATUS.TRANSCRIBED ||
         status === VIDEO_STATUS.ANALYZED ||
         status === 'published';
};

export const isErrorStatus = (status) => {
  return status === VIDEO_STATUS.ERROR || 
         status === VIDEO_STATUS.FAILED ||
         status === 'failed';
};

export const isDraftStatus = (status) => {
  return status === VIDEO_STATUS.PENDING ||
         status === VIDEO_STATUS.UPLOADING ||
         status === 'draft';
};

// Obtenir le libellé d'un statut pour l'affichage
export const getStatusLabel = (status) => {
  // Normaliser le statut pour la comparaison
  const normalizedStatus = status?.toLowerCase();
  
  const labels = {
    'draft': 'En attente',
    'uploading': 'Téléchargement en cours',
    'uploaded': 'Téléchargée',
    'processing': 'En traitement',
    'published': 'Analyse terminée',
    'completed': 'Analyse terminée',
    'transcribing': 'Transcription en cours',
    'transcribed': 'Transcrite',
    'analyzing': 'Analyse en cours',
    'analyzed': 'Analyse terminée',
    'failed': 'Échec',
    'error': 'Erreur',
  };
  
  return labels[normalizedStatus] || status || 'Inconnu';
};

// Obtenir la classe CSS pour un statut
export const getStatusClass = (status) => {
  // Normaliser le statut pour la comparaison
  const normalizedStatus = status?.toLowerCase();
  
  const classes = {
    'draft': 'bg-gray-100 text-gray-800',
    'uploading': 'bg-blue-100 text-blue-800',
    'uploaded': 'bg-purple-100 text-purple-800',
    'processing': 'bg-yellow-100 text-yellow-800',
    'published': 'bg-green-100 text-green-800',
    'completed': 'bg-green-100 text-green-800',
    'transcribing': 'bg-indigo-100 text-indigo-800',
    'transcribed': 'bg-teal-100 text-teal-800',
    'analyzing': 'bg-orange-100 text-orange-800',
    'analyzed': 'bg-green-100 text-green-800',
    'failed': 'bg-red-100 text-red-800',
    'error': 'bg-red-100 text-red-800',
  };
  
  return classes[normalizedStatus] || 'bg-gray-100 text-gray-800';
};

// Convertir un statut d'application en statut de base de données valide
export const toDatabaseStatus = (appStatus) => {
  // Normaliser le statut pour la comparaison
  const normalizedStatus = appStatus?.toLowerCase();
  
  // Mapping des statuts d'application vers les statuts de base de données
  const statusMapping = {
    // Statuts d'application -> statuts DB
    'uploading': 'draft',
    'uploaded': 'draft', // Le fichier est uploadé, mais le traitement n'a pas commencé
    'processing': 'processing',
    'transcribing': 'processing',
    'transcribed': 'published',
    'analyzing': 'processing',
    'analyzed': 'published',
    'failed': 'failed',
    'error': 'failed',
    'published': 'published',
    'completed': 'published',
    'pending': 'draft',
    // Déjà des statuts DB valides
    'draft': 'draft',
  };
  
  return statusMapping[normalizedStatus] || 'draft'; // Par défaut 'draft' si statut inconnu
};

// Convertir un statut de base de données en statut d'application
export const fromDatabaseStatus = (dbStatus) => {
  // Normaliser le statut pour la comparaison
  const normalizedStatus = dbStatus?.toLowerCase();
  
  // Mapping des statuts de base de données vers les statuts d'application
  const statusMapping = {
    'draft': VIDEO_STATUS.UPLOADED,
    'uploaded': VIDEO_STATUS.UPLOADED,
    'processing': VIDEO_STATUS.PROCESSING,
    'transcribing': VIDEO_STATUS.TRANSCRIBING,
    'transcribed': VIDEO_STATUS.TRANSCRIBED,
    'analyzing': VIDEO_STATUS.ANALYZING,
    'published': VIDEO_STATUS.ANALYZED,
    'failed': VIDEO_STATUS.FAILED
  };
  
  return statusMapping[normalizedStatus] || VIDEO_STATUS.UPLOADED;
};
