// src/constants/videoStatus.js

// Constantes pour les statuts vidéo alignées avec les valeurs de la base de données
// La table videos a une contrainte check: status = ANY (ARRAY['processing'::text, 'published'::text, 'draft'::text, 'failed'::text])
export const VIDEO_STATUS = {
  // Statuts utilisés dans l'application
  UPLOADING: 'draft',       // Pendant l'upload, considéré comme brouillon
  READY: 'draft',           // Prêt pour traitement
  PROCESSING: 'processing', // En cours de traitement
  PUBLISHED: 'published',   // Traitement terminé avec succès
  FAILED: 'failed',         // Échec du traitement
  ERROR: 'failed',          // Alias pour FAILED
  TRANSCRIBED: 'published', // Alias pour PUBLISHED
  
  // Statuts correspondant aux valeurs de la base de données
  PENDING: 'draft',
  UPLOADED: 'draft',
  COMPLETED: 'published'
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
  return status === VIDEO_STATUS.PROCESSING || 
         status === 'processing';
};

export const isCompletedStatus = (status) => {
  return status === VIDEO_STATUS.PUBLISHED || 
         status === VIDEO_STATUS.COMPLETED ||
         status === VIDEO_STATUS.TRANSCRIBED ||
         status === 'published';
};

export const isErrorStatus = (status) => {
  return status === VIDEO_STATUS.ERROR || 
         status === VIDEO_STATUS.FAILED ||
         status === 'failed';
};

export const isDraftStatus = (status) => {
  return status === VIDEO_STATUS.PENDING ||
         status === VIDEO_STATUS.READY ||
         status === VIDEO_STATUS.UPLOADING ||
         status === VIDEO_STATUS.UPLOADED ||
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
    'transcribed': 'Transcrite',
    'failed': 'Échec',
    'error': 'Erreur',
    'ready': 'Prête'
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
    'uploaded': 'bg-blue-100 text-blue-800',
    'processing': 'bg-yellow-100 text-yellow-800',
    'published': 'bg-green-100 text-green-800',
    'completed': 'bg-green-100 text-green-800',
    'transcribed': 'bg-green-100 text-green-800',
    'failed': 'bg-red-100 text-red-800',
    'error': 'bg-red-100 text-red-800',
    'ready': 'bg-blue-100 text-blue-800'
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
    'ready': 'draft',
    'processing': 'processing',
    'published': 'published',
    'failed': 'failed',
    'error': 'failed',
    'transcribed': 'published',
    'completed': 'published',
    'uploaded': 'draft',
    'pending': 'draft',
    // Déjà des statuts DB valides
    'draft': 'draft',
    'processing': 'processing',
    'published': 'published',
    'failed': 'failed'
  };
  
  return statusMapping[normalizedStatus] || 'draft'; // Par défaut 'draft' si statut inconnu
};

// Convertir un statut de base de données en statut d'application
export const fromDatabaseStatus = (dbStatus) => {
  // Normaliser le statut pour la comparaison
  const normalizedStatus = dbStatus?.toLowerCase();
  
  // Mapping des statuts de base de données vers les statuts d'application
  const statusMapping = {
    'draft': 'READY',
    'processing': 'PROCESSING',
    'published': 'PUBLISHED',
    'failed': 'FAILED'
  };
  
  return statusMapping[normalizedStatus] || 'READY'; // Par défaut 'READY' si statut inconnu
};
