// src/components/VideoUploader.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, toDatabaseStatus } from '../constants/videoStatus';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

// Fonction de validation d'URL
const validateVideoUrl = (url) => {
  if (!url || url.trim() === '') {
    return 'L\'URL de la vidéo est requise';
  }
  
  // Si c'est une URL HTTP/HTTPS
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      new URL(url); // Vérifie si l'URL est valide
      return null; // Pas d'erreur
    } catch (e) {
      return 'Format d\'URL invalide';
    }
  }
  
  // Si c'est un chemin de stockage (bucket/path)
  if (!url.match(/^[^/]+\/.*$/)) {
    return 'Format de chemin de stockage invalide. Doit être au format bucket/path';
  }
  
  return null; // Pas d'erreur
};

const VideoUploader = ({ onUploadComplete }) => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const fileInputRef = useRef(null);

  // Configurer la base de données au chargement du composant
  useEffect(() => {
    const setupDatabase = async () => {
      if (!user) return;
      
      try {
        setIsSettingUp(true);
        
        // Récupérer le token d'authentification
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('Aucune session utilisateur trouvée');
          setError('Session d\'authentification manquante !');
          return;
        }
        
        console.log("Setup - Token disponible:", !!session.access_token);
        
        // Appeler l'Edge Function pour configurer la base de données
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-database`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Erreur ${response.status}` }));
            console.warn(`Configuration de la base de données: ${response.status}`, errorData);
            setError(`Erreur de configuration: ${errorData.error || response.statusText}`);
          } else {
            const result = await response.json();
            console.log('Configuration de la base de données réussie:', result);
            setSuccess('Base de données configurée avec succès');
          }
        } catch (fetchError) {
          console.error('Erreur lors de l\'appel à setup-database:', fetchError);
          setError(`Erreur de connexion: ${fetchError.message}`);
        }
      } catch (err) {
        console.error('Erreur lors de la configuration de la base de données:', err);
        setError(`Erreur: ${err.message}`);
      } finally {
        setIsSettingUp(false);
      }
    };
    
    setupDatabase();
  }, [user]);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    setSuccess(null);
    
    if (!selectedFile) {
      setFile(null);
      return;
    }
    
    // Vérifier le type de fichier
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Format de fichier non supporté. Veuillez utiliser MP4, MOV, AVI ou WebM.');
      setFile(null);
      e.target.value = null;
      return;
    }
    
    // Vérifier la taille du fichier (100MB max)
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('Le fichier est trop volumineux. La taille maximale est de 100MB.');
      setFile(null);
      e.target.value = null;
      return;
    }
    
    setFile(selectedFile);
    
    // Utiliser le nom du fichier comme titre par défaut si aucun titre n'est défini
    if (!title) {
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, ''); // Enlever l'extension
      setTitle(fileName);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!user) {
      setError('Vous devez être connecté pour uploader une vidéo');
      return;
    }
    
    if (!file) {
      setError('Veuillez sélectionner une vidéo à uploader');
      return;
    }
    
    if (!title.trim()) {
      setError('Veuillez entrer un titre pour la vidéo');
      return;
    }
    
    try {
      setUploading(true);
      setProgress(0);
      
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session d\'authentification manquante !');
      }
      
      // Préparer les données pour l'upload
      const formData = new FormData();
      formData.append('video', file);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      
      // Simuler la progression pendant l'upload
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 5;
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 300);
      
      // Appeler l'Edge Function pour gérer l'upload et l'insertion
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-video`, {
        method: 'POST',
        headers: {
          // Ne pas inclure Content-Type pour les requêtes multipart/form-data
          // Le navigateur le définira automatiquement avec la boundary
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });
      
      // Arrêter la simulation de progression
      clearInterval(progressInterval);
      
      // Traiter la réponse
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error(`Erreur de parsing de la réponse: ${await response.text()}`);
      }
      
      if (!response.ok) {
        throw new Error(result.error || `Erreur ${response.status}: ${response.statusText}`);
      }
      
      setProgress(100);
      
      // Réinitialiser le formulaire
      setFile(null);
      setTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Notifier le parent avec les données de la vidéo
      if (onUploadComplete && result.video) {
        onUploadComplete(result.video);
      }
      
      // Afficher un message de succès
      setSuccess("Vidéo uploadée avec succès et en cours de traitement!");
      setTimeout(() => {
        setSuccess('Vous pouvez maintenant voir votre vidéo dans l\'onglet "Mes Vidéos"');
      }, 2000);
      
    } catch (err) {
      console.error('Erreur lors de l\'upload:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  // Fonction pour tester l'authentification
  const testAuth = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session d\'authentification manquante !');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-auth`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json'
        }
      });
      
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        throw new Error(`Erreur de parsing de la réponse: ${await response.text()}`);
      }
      
      console.log('Test d\'authentification:', result);
      
      if (response.ok && result.authInfo?.user) {
        setSuccess(`Authentification réussie! Utilisateur: ${result.authInfo.user.email || result.authInfo.user.id}`);
      } else {
        setError(`Échec de l'authentification: ${result.error || result.details || 'Raison inconnue'}`);
        console.error('Détails de l\'erreur:', result);
      }
    } catch (err) {
      console.error('Erreur lors du test d\'authentification:', err);
      setError(`Erreur: ${err.message}`);
    }
  };
  
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Uploader une nouvelle vidéo</h1>
      
      {isSettingUp && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 flex items-center">
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          <p>Configuration de la base de données en cours...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          <p>{success}</p>
        </div>
      )}
      
      {/* Bouton de test d'authentification */}
      <div className="mb-6">
        <Button 
          type="button" 
          onClick={testAuth}
          className="w-full bg-blue-500 hover:bg-blue-600"
          variant="outline"
        >
          Tester l'authentification
        </Button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">Fichier vidéo</label>
          <input 
            type="file" 
            id="file" 
            ref={fileInputRef}
            accept="video/*" 
            onChange={handleFileChange} 
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={uploading || isSettingUp}
          />
          <p className="mt-1 text-xs text-gray-500">Formats acceptés: MP4, MOV, AVI, WebM (max 100MB)</p>
        </div>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Titre de la vidéo</label>
          <input 
            type="text" 
            id="title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Entrez un titre pour votre vidéo"
            disabled={uploading || isSettingUp}
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
          <textarea 
            id="description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            rows="3" 
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Ajoutez une description à votre vidéo"
            disabled={uploading || isSettingUp}
          ></textarea>
        </div>
        
        {uploading && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 text-center">{progress}% complété</p>
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          disabled={uploading || !file || isSettingUp}
        >
          {uploading ? `Upload en cours...` : isSettingUp ? 'Configuration en cours...' : 'Uploader la vidéo'}
        </Button>
      </form>
    </div>
  );
};

export default VideoUploader;
