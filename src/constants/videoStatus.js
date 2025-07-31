// src/constants/videoStatus.js
// Constantes pour les statuts vidéo alignées avec les valeurs de la base de données
export const VIDEO_STATUS = {
  PENDING: 'draft',      // Valeur acceptée par la contrainte check de la table videos
  UPLOADING: 'processing', // Utiliser 'processing' pendant l'upload
  UPLOADED: 'draft',     // Une fois uploadée mais pas encore traitée
  PROCESSING: 'processing', // En cours de traitement (transcription, analyse)
  COMPLETED: 'published', // Traitement terminé avec succès
  PUBLISHED: 'published', // Alias pour COMPLETED
  TRANSCRIBED: 'published', // Vidéo avec transcription terminée
  FAILED: 'failed',      // Échec du traitement
  ERROR: 'failed'        // Alias pour FAILED
};

// Constantes pour les statuts de transcription
export const TRANSCRIPTION_STATUS = {
  PENDING: 'pending',    // En attente de traitement
  PROCESSING: 'processing', // En cours de traitement
  COMPLETED: 'completed', // Traitement terminé avec succès
  ERROR: 'failed'        // Échec du traitement
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
    [VIDEO_STATUS.ERROR]: 'Erreur'
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
    [VIDEO_STATUS.ERROR]: 'status-error'
  };
  
  return classes[status] || 'status-unknown';
};

// Vérifier si un statut est valide selon la contrainte check de la base de données
export const isValidDatabaseStatus = (status) => {
  // Ces valeurs doivent correspondre exactement à celles définies dans la contrainte check
  // de la colonne status de la table videos
  const validStatuses = ['processing', 'published', 'draft', 'failed'];
  return validStatuses.includes(status);
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
