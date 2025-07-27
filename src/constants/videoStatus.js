// src/constants/videoStatus.js

// Constantes pour les statuts des vidéos
export const VIDEO_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing', 
  PUBLISHED: 'published',
  FAILED: 'failed',
  ARCHIVED: 'archived'
};

// Constantes pour les statuts de traitement des transcriptions
export const TRANSCRIPTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED_FULL: 'completed_full',
  COMPLETED_BASIC: 'completed_basic',
  TRANSCRIPTION_ONLY: 'transcription_only',
  FAILED_TRANSCRIPTION: 'failed_transcription',
  FAILED: 'failed'
};

// Messages d'état pour l'interface utilisateur
export const STATUS_MESSAGES = {
  [VIDEO_STATUS.DRAFT]: 'Brouillon',
  [VIDEO_STATUS.PROCESSING]: 'En cours de traitement',
  [VIDEO_STATUS.PUBLISHED]: 'Publié',
  [VIDEO_STATUS.FAILED]: 'Échec du traitement',
  [VIDEO_STATUS.ARCHIVED]: 'Archivé'
};

export const TRANSCRIPTION_MESSAGES = {
  [TRANSCRIPTION_STATUS.PENDING]: 'En attente',
  [TRANSCRIPTION_STATUS.PROCESSING]: 'Traitement en cours',
  [TRANSCRIPTION_STATUS.COMPLETED_FULL]: 'Analyse complète',
  [TRANSCRIPTION_STATUS.COMPLETED_BASIC]: 'Analyse basique',
  [TRANSCRIPTION_STATUS.TRANSCRIPTION_ONLY]: 'Transcription seule',
  [TRANSCRIPTION_STATUS.FAILED_TRANSCRIPTION]: 'Transcription échouée',
  [TRANSCRIPTION_STATUS.FAILED]: 'Échec de l\'analyse'
};
