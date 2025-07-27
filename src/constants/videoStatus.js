// src/constants/videoStatus.js
// Mettre à jour les constantes pour qu'elles correspondent aux valeurs autorisées dans la base de données
export const VIDEO_STATUS = {
  PENDING: 'draft',      // Remplacer 'PENDING' par 'draft'
  UPLOADED: 'draft',     // Remplacer 'UPLOADED' par 'draft'
  PROCESSING: 'processing',
  COMPLETED: 'published', // Remplacer 'COMPLETED' par 'published'
  ERROR: 'failed'        // Remplacer 'ERROR' par 'failed'
};

// Constantes pour les statuts de transcription
export const TRANSCRIPTION_STATUS = {
  PENDING: 'draft',
  PROCESSING: 'processing',
  COMPLETED: 'published',
  ERROR: 'failed'
};

// Fonctions utilitaires pour vérifier les statuts
export const isProcessingStatus = (status) => {
  return status === VIDEO_STATUS.PROCESSING || status === VIDEO_STATUS.PENDING || status === VIDEO_STATUS.UPLOADED;
};

export const isCompletedStatus = (status) => {
  return status === VIDEO_STATUS.COMPLETED;
};

export const isErrorStatus = (status) => {
  return status === VIDEO_STATUS.ERROR;
};

// Obtenir le libellé d'un statut pour l'affichage
export const getStatusLabel = (status) => {
  const labels = {
    [VIDEO_STATUS.PENDING]: 'En attente',
    [VIDEO_STATUS.UPLOADED]: 'Téléchargée',
    [VIDEO_STATUS.PROCESSING]: 'En traitement',
    [VIDEO_STATUS.COMPLETED]: 'Analyse terminée',
    [VIDEO_STATUS.ERROR]: 'Erreur'
  };
  
  return labels[status] || status;
};

// Obtenir la classe CSS pour un statut
export const getStatusClass = (status) => {
  const classes = {
    [VIDEO_STATUS.PENDING]: 'status-pending',
    [VIDEO_STATUS.UPLOADED]: 'status-uploaded',
    [VIDEO_STATUS.PROCESSING]: 'status-processing',
    [VIDEO_STATUS.COMPLETED]: 'status-completed',
    [VIDEO_STATUS.ERROR]: 'status-error'
  };
  
  return classes[status] || 'status-unknown';
};
