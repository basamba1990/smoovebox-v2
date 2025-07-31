// src/constants/videoStatus.js

// Constantes pour les statuts vidéo alignées avec les valeurs de la base de données
// La table videos a une contrainte check: status = ANY (ARRAY['processing'::text, 'published'::text, 'draft'::text, 'failed'::text])
export const VIDEO_STATUS = {
  // Statuts utilisés dans l'application
  UPLOADING: 'uploading',
  READY: 'ready',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  ERROR: 'failed',
  TRANSCRIBED: 'published',
  
  // Statuts correspondant aux valeurs de la base de données
  PENDING: 'draft',
  UPLOADED: 'draft',
  COMPLETED: 'published'
};

// Constantes pour les statuts de transcription
export const TRANSCRIPTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'failed'
};

// Fonctions utilitaires pour vérifier les statuts
export const isProcessingStatus = (status) => {
  return status === VIDEO_STATUS.PROCESSING || 
         status === VIDEO_STATUS.PENDING || 
         status === VIDEO_STATUS.UPLOADED ||
         status === VIDEO_STATUS.UPLOADING;
};

export const isCompletedStatus = (status) => {
  return status === VIDEO_STATUS.COMPLETED || 
         status === VIDEO_STATUS.PUBLISHED ||
         status === VIDEO_STATUS.TRANSCRIBED;
};

export const isErrorStatus = (status) => {
  return status === VIDEO_STATUS.ERROR || 
         status === VIDEO_STATUS.FAILED;
};

// Obtenir le libellé d'un statut pour l'affichage
export const getStatusLabel = (status) => {
  const labels = {
    [VIDEO_STATUS.PENDING]: 'En attente',
    [VIDEO_STATUS.UPLOADING]: 'Téléchargement en cours',
    [VIDEO_STATUS.UPLOADED]: 'Téléchargée',
    [VIDEO_STATUS.PROCESSING]: 'En traitement',
    [VIDEO_STATUS.COMPLETED]: 'Analyse terminée',
    [VIDEO_STATUS.PUBLISHED]: 'Publiée',
    [VIDEO_STATUS.TRANSCRIBED]: 'Transcrite',
    [VIDEO_STATUS.FAILED]: 'Échec',
    [VIDEO_STATUS.ERROR]: 'Erreur',
    [VIDEO_STATUS.READY]: 'Prête'
  };
  
  return labels[status] || status;
};

// Obtenir la classe CSS pour un statut
export const getStatusClass = (status) => {
  const classes = {
    [VIDEO_STATUS.PENDING]: 'status-pending',
    [VIDEO_STATUS.UPLOADING]: 'status-uploading',
    [VIDEO_STATUS.UPLOADED]: 'status-uploaded',
    [VIDEO_STATUS.PROCESSING]: 'status-processing',
    [VIDEO_STATUS.COMPLETED]: 'status-completed',
    [VIDEO_STATUS.PUBLISHED]: 'status-published',
    [VIDEO_STATUS.TRANSCRIBED]: 'status-transcribed',
    [VIDEO_STATUS.FAILED]: 'status-error',
    [VIDEO_STATUS.ERROR]: 'status-error',
    [VIDEO_STATUS.READY]: 'status-ready'
  };
  
  return classes[status] || 'status-unknown';
};

// Convertir un statut d'application en statut de base de données valide
export const toDatabaseStatus = (appStatus) => {
  // Mapping des statuts d'application vers les statuts de base de données
  const statusMapping = {
    // Statuts d'application -> statuts DB
    'uploading': 'processing',
    'ready': 'draft',
    'processing': 'processing',
    'published': 'published',
    'failed': 'failed',
    'error': 'failed',
    'transcribed': 'published',
    // Déjà des statuts DB valides
    'draft': 'draft',
    'processing': 'processing',
    'published': 'published',
    'failed': 'failed'
  };
  
  return statusMapping[appStatus] || 'draft'; // Par défaut 'draft' si statut inconnu
};
