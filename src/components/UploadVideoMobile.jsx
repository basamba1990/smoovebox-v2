import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Upload, CheckCircle, AlertCircle, Loader2, FileVideo, X } from 'lucide-react';
import { uploadVideo, getTranscription, analyzePitch } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

const UploadVideoMobile = () => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, processing, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Vérifier le type de fichier
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Format de fichier non supporté. Utilisez MP4, MOV ou AVI.');
      setUploadStatus('error');
      return;
    }

    // Vérifier la taille (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setErrorMessage('Le fichier est trop volumineux. Taille maximum: 100MB.');
      setUploadStatus('error');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');
    setUploadStatus('idle');
  };

  const processVideo = async () => {
    if (!selectedFile) return;
    
    if (!user) {
      setErrorMessage('Vous devez être connecté pour uploader une vidéo.');
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Étape 1: Upload de la vidéo avec callback de progression
      const uploadResult = await uploadVideo(selectedFile, {
        title: selectedFile.name,
        description: '',
        generateThumbnail: true,
        isPublic: false
      }, (progress) => {
        if (progress.phase === 'video') {
          setUploadProgress(Math.min(progress.progress * 0.4, 40)); // 40% pour l'upload
        }
      });
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      // Étape 2: Transcription
      setUploadStatus('processing');
      setUploadProgress(50);
      
      const transcriptionResult = await getTranscription(uploadResult.video.file_path);
      
      if (!transcriptionResult.success) {
        console.warn('Transcription échouée:', transcriptionResult.error);
        // Continuer même si la transcription échoue
      }

      // Étape 3: Analyse IA (seulement si transcription réussie)
      if (transcriptionResult.success) {
        setUploadProgress(75);
        
        const analysisResult = await analyzePitch(transcriptionResult.data);
        
        if (!analysisResult.success) {
          console.warn('Analyse IA échouée:', analysisResult.error);
        }
      }

      // Étape 4: Finalisation
      setUploadProgress(100);
      setUploadStatus('success');
      setSuccessMessage('Vidéo uploadée avec succès !');
      
      // Reset après 5 secondes
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
        setSuccessMessage('');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 5000);

    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      setUploadStatus('error');
      
      // Messages d'erreur plus explicites
      let errorMessage = 'Une erreur est survenue lors du traitement.';
      
      if (error.message.includes('storage') || error.message.includes('bucket')) {
        errorMessage = 'Erreur de stockage : Vérifiez la configuration Supabase Storage.';
      } else if (error.message.includes('profiles') || error.message.includes('user')) {
        errorMessage = 'Erreur de profil utilisateur : Problème d\'authentification.';
      } else if (error.message.includes('OpenAI') || error.message.includes('API')) {
        errorMessage = 'Service d\'analyse IA temporairement indisponible.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Erreur de connexion : Vérifiez votre connexion internet.';
      } else if (error.message.includes('size') || error.message.includes('large')) {
        errorMessage = 'Fichier trop volumineux ou format non supporté.';
      } else if (error.message) {
        errorMessage = `Erreur : ${error.message}`;
      }
      
      setErrorMessage(errorMessage);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setErrorMessage('');
    setUploadStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-12 w-12 text-red-500" />;
      default:
        return selectedFile ? <FileVideo className="h-12 w-12 text-blue-500" /> : <Upload className="h-12 w-12 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Upload en cours...';
      case 'processing':
        return 'Analyse IA en cours...';
      case 'success':
        return 'Traitement terminé !';
      case 'error':
        return 'Erreur';
      default:
        return selectedFile ? 'Fichier sélectionné' : 'Glissez votre vidéo ici';
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Input file caché mais accessible pour les tests */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/quicktime"
        onChange={handleFileInputChange}
        className="sr-only"
        data-testid="file-input"
      />
      
      {/* Zone de drop */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragging ? 'border-blue-500 bg-blue-50' : 
          uploadStatus === 'success' ? 'border-green-500 bg-green-50' :
          uploadStatus === 'error' ? 'border-red-500 bg-red-50' :
          selectedFile ? 'border-blue-500 bg-blue-50' :
          'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mb-4">
          {getStatusIcon()}
        </div>
        
        <h3 className="text-lg font-semibold mb-2">{getStatusText()}</h3>
        
        {/* Affichage du fichier sélectionné */}
        {selectedFile && uploadStatus === 'idle' && (
          <div className="bg-white rounded-lg p-4 mb-4 border">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-left">
                <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button
                onClick={removeSelectedFile}
                className="ml-2 p-1 hover:bg-gray-100 rounded"
                title="Supprimer le fichier"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
        
        {uploadStatus === 'idle' && !selectedFile && (
          <>
            <p className="text-gray-600 mb-4">ou cliquez pour sélectionner</p>
            <Button onClick={openFileDialog} disabled={uploadStatus !== 'idle'}>
              Sélectionner un fichier
            </Button>
          </>
        )}

        {uploadStatus === 'idle' && selectedFile && (
          <div className="space-y-2">
            <Button onClick={processVideo} className="w-full">
              Uploader et analyser
            </Button>
            <Button onClick={openFileDialog} variant="outline" className="w-full">
              Choisir un autre fichier
            </Button>
          </div>
        )}

        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
            <p className="text-sm text-gray-600 mt-2">{uploadProgress}%</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
            <p className="text-red-700 text-sm">{errorMessage}</p>
            {uploadStatus === 'error' && (
              <Button 
                onClick={() => {
                  setUploadStatus('idle');
                  setErrorMessage('');
                }} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Réessayer
              </Button>
            )}
          </div>
        )}

        {uploadStatus === 'idle' && (
          <p className="text-xs text-gray-500 mt-4">
            Formats supportés: MP4, MOV, AVI (max 100MB)
          </p>
        )}
      </div>
    </div>
  );
};

export default UploadVideoMobile;


