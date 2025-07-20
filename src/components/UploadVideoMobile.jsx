import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { uploadVideo, getTranscription, analyzePitch } from '../lib/supabase.js';
import { useAuth } from '../AuthContext.jsx';

const UploadVideoMobile = () => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, processing, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
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

    processVideo(file);
  };

  const processVideo = async (file) => {
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
      // Étape 1: Upload de la vidéo
      setUploadProgress(25);
      const uploadResult = await uploadVideo(file, user.id);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      // Étape 2: Transcription
      setUploadStatus('processing');
      setUploadProgress(50);
      
      const transcriptionResult = await getTranscription(file);
      
      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error);
      }

      // Étape 3: Analyse IA
      setUploadProgress(75);
      
      const analysisResult = await analyzePitch(transcriptionResult.data.text);
      
      if (!analysisResult.success) {
        throw new Error(analysisResult.error);
      }

      // Étape 4: Sauvegarde des résultats
      setUploadProgress(100);
      
      // Ici vous pourriez sauvegarder la transcription et l'analyse en base
      // const { data, error } = await supabase.from('transcriptions').insert({...})

      setUploadStatus('success');
      setSuccessMessage('Vidéo uploadée et analysée avec succès !');
      
      // Reset après 3 secondes
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || 'Une erreur est survenue lors du traitement.');
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

  const handleDragLeave = () => {
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
        return <Upload className="h-12 w-12 text-gray-400" />;
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
        return 'Glissez votre vidéo ici';
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/quicktime"
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragging ? 'border-blue-500 bg-blue-50' : 
          uploadStatus === 'success' ? 'border-green-500 bg-green-50' :
          uploadStatus === 'error' ? 'border-red-500 bg-red-50' :
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
        
        {uploadStatus === 'idle' && (
          <>
            <p className="text-gray-600 mb-4">ou cliquez pour sélectionner</p>
            <Button onClick={openFileDialog} disabled={uploadStatus !== 'idle'}>
              Sélectionner un fichier
            </Button>
          </>
        )}

        {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        {successMessage && (
          <p className="text-green-600 text-sm mt-4">{successMessage}</p>
        )}

        {errorMessage && (
          <p className="text-red-600 text-sm mt-4">{errorMessage}</p>
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

