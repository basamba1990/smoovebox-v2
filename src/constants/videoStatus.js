// src/constants/videoStatus.js
// Constantes pour les statuts des vidéos
export const VIDEO_STATUS = {
  PENDING: 'PENDING',
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING', 
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
};

// Constantes pour les statuts de transcription
export const TRANSCRIPTION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR'
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
