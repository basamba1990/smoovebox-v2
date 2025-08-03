// src/lib/storageUtils.js - Utilitaires pour la gestion du stockage
/**
 * Utilitaires pour gérer les chemins de stockage et les URLs dans Supabase
 */

import { supabase } from './supabase';

/**
 * Extrait le bucket et le chemin à partir d'un chemin de stockage complet
 * @param {string} storagePath - Chemin au format 'bucket/path' ou simplement 'path'
 * @param {string} defaultBucket - Bucket par défaut si non spécifié dans storagePath
 * @returns {Object} { bucket, path }
 */
export const extractBucketAndPath = (storagePath, defaultBucket = 'videos') => {
  if (!storagePath) {
    return { bucket: defaultBucket, path: '' };
  }
  
  // Si storagePath contient un format bucket/path
  if (storagePath.includes('/')) {
    const parts = storagePath.split('/', 1);
    if (parts.length > 0) {
      const bucket = parts[0];
      const path = storagePath.substring(bucket.length + 1);
      return { bucket, path };
    }
  }
  
  // Si pas de séparateur, considérer que c'est juste un chemin dans le bucket par défaut
  return { bucket: defaultBucket, path: storagePath };
};

/**
 * Génère une URL publique pour un fichier dans le stockage Supabase
 * @param {string} storagePath - Chemin au format 'bucket/path' ou simplement 'path'
 * @param {string} defaultBucket - Bucket par défaut si non spécifié dans storagePath
 * @returns {string|null} URL publique ou null en cas d'erreur
 */
export const getPublicUrl = (storagePath, defaultBucket = 'videos') => {
  if (!storagePath) return null;
  
  try {
    const { bucket, path } = extractBucketAndPath(storagePath, defaultBucket);
    
    if (!path) return null;
    
    // Extraire le projectRef de l'URL Supabase
    const url = new URL(import.meta.env.VITE_SUPABASE_URL);
    const projectRef = url.hostname.split('.')[0];
    
    return `https://${projectRef}.supabase.co/storage/v1/object/public/${bucket}/${path}`;
  } catch (e) {
    console.error("Erreur de construction de l'URL publique:", e);
    return null;
  }
};

/**
 * Crée une URL signée pour un fichier dans le stockage Supabase
 * @param {string} storagePath - Chemin au format 'bucket/path' ou simplement 'path'
 * @param {string} defaultBucket - Bucket par défaut si non spécifié dans storagePath
 * @param {number} expiresIn - Durée de validité de l'URL en secondes (défaut: 3600)
 * @returns {Promise<string|null>} URL signée ou null en cas d'erreur
 */
export const createSignedUrl = async (storagePath, defaultBucket = 'videos', expiresIn = 3600) => {
  try {
    if (!storagePath) return null;
    
    const { bucket, path } = extractBucketAndPath(storagePath, defaultBucket);
    
    if (!path) return null;
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
      
    if (error) throw error;
    
    return data?.signedUrl || null;
  } catch (err) {
    console.error('Erreur lors de la création de l\'URL signée:', err);
    return null;
  }
};

/**
 * Détermine la meilleure source vidéo à partir des données disponibles
 * @param {Object} options - Options de la source vidéo
 * @param {Object} options.video - Objet vidéo complet (optionnel)
 * @param {string} options.url - URL directe de la vidéo (http/https)
 * @param {string} options.storagePath - Chemin de stockage Supabase
 * @param {boolean} options.preferPublic - Si true, essaie d'abord l'URL publique
 * @returns {Promise<string|null>} URL à utiliser pour la vidéo ou null si aucune source valide
 */
export const getBestVideoSource = async ({ video, url, storagePath, preferPublic = true }) => {
  // Sources possibles par ordre de priorité
  const sources = [];
  
  // 1. URL directe fournie
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    sources.push(url);
  }
  
  // 2. URL de l'objet vidéo
  if (video?.url && (video.url.startsWith('http://') || video.url.startsWith('https://'))) {
    sources.push(video.url);
  }
  
  // 3. Chemin de stockage fourni
  if (storagePath) {
    if (preferPublic) {
      const publicUrl = getPublicUrl(storagePath);
      if (publicUrl) sources.push(publicUrl);
      
      const signedUrl = await createSignedUrl(storagePath);
      if (signedUrl) sources.push(signedUrl);
    } else {
      const signedUrl = await createSignedUrl(storagePath);
      if (signedUrl) sources.push(signedUrl);
      
      const publicUrl = getPublicUrl(storagePath);
      if (publicUrl) sources.push(publicUrl);
    }
  }
  
  // 4. Chemin de stockage de l'objet vidéo
  if (video?.storage_path) {
    if (preferPublic) {
      const publicUrl = getPublicUrl(video.storage_path);
      if (publicUrl) sources.push(publicUrl);
      
      const signedUrl = await createSignedUrl(video.storage_path);
      if (signedUrl) sources.push(signedUrl);
    } else {
      const signedUrl = await createSignedUrl(video.storage_path);
      if (signedUrl) sources.push(signedUrl);
      
      const publicUrl = getPublicUrl(video.storage_path);
      if (publicUrl) sources.push(publicUrl);
    }
  }
  
  // Retourner la première source valide
  return sources.length > 0 ? sources[0] : null;
};

/**
 * Supprime un fichier du stockage Supabase
 * @param {string} storagePath - Chemin au format 'bucket/path' ou simplement 'path'
 * @param {string} defaultBucket - Bucket par défaut si non spécifié dans storagePath
 * @returns {Promise<boolean>} true si suppression réussie, false sinon
 */
export const deleteFile = async (storagePath, defaultBucket = 'videos') => {
  try {
    if (!storagePath) return false;
    
    const { bucket, path } = extractBucketAndPath(storagePath, defaultBucket);
    
    if (!path) return false;
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
      
    if (error) throw error;
    
    return true;
  } catch (err) {
    console.error('Erreur lors de la suppression du fichier:', err);
    return false;
  }
};
