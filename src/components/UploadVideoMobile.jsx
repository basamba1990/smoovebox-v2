import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Upload, CheckCircle, AlertCircle, Loader2, FileVideo, X, Info, RefreshCw } from 'lucide-react';
import { uploadVideo, getTranscription, analyzePitch, getBasicAnalysis, checkOpenAIAvailability, supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { VIDEO_STATUS } from '../constants/videoStatus.js';

const UploadVideoMobile = () => {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, processing, success, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(null);
  const [processingStep, setProcessingStep] = useState('');
  const fileInputRef = useRef(null);

  // Vérifier la disponibilité de l'IA au chargement
  React.useEffect(() => {
    const checkAI = async () => {
      const availability = await checkOpenAIAvailability();
      setAiAvailable(availability.available);
    };
    checkAI();
  }, []);

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
    setProcessingStep('Préparation de l\'upload...');

    try {
      // Étape 1: Upload de la vidéo avec callback de progression
      setProcessingStep('Upload de la vidéo en cours...');
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

      // Mise à jour du statut pour le traitement
      await supabase
        .from("videos")
        .update({ status: VIDEO_STATUS.PROCESSING })
        .eq('id', uploadResult.video.id);

      // Étape 2: Vérifier la disponibilité de l'IA
      setUploadStatus('processing');
      setUploadProgress(50);
      setProcessingStep('Vérification du service d\'analyse IA...');
      
      const aiCheck = await checkOpenAIAvailability();
      
      if (!aiCheck.available) {
        console.warn('IA non disponible, utilisation du mode dégradé:', aiCheck.error);
        
        // Mode dégradé : analyse basique
        setProcessingStep('Analyse basique en cours (IA indisponible)...');
        setUploadProgress(75);
        
        // Créer une transcription factice pour l'analyse basique
        const basicTranscription = `Transcription non disponible - Fichier: ${selectedFile.name}`;
        const basicAnalysis = getBasicAnalysis(basicTranscription);
        
        if (basicAnalysis.success) {
          // Enregistrer l'analyse basique
          const { error: transcriptionError } = await supabase
            .from('transcriptions')
            .insert({
              video_id: uploadResult.video.id,
              profile_id: uploadResult.video.profile_id,  // Utiliser profile_id
              transcription_text: basicTranscription,
              confidence_score: 50,
              analysis_result: basicAnalysis.data,
              processing_status: 'completed_basic'
            });

          if (transcriptionError) {
            console.warn('Erreur lors de l\'enregistrement de l\'analyse basique:', transcriptionError);
          }
        }
        
        // Marquer comme publié avec analyse basique
        await supabase
          .from("videos")
          .update({ 
            status: VIDEO_STATUS.PUBLISHED,
            processing_notes: 'Analyse basique - IA indisponible'
          })
          .eq('id', uploadResult.video.id);

        setUploadProgress(100);
        setUploadStatus('success');
        setSuccessMessage('Vidéo uploadée avec succès ! Analyse basique effectuée (service IA temporairement indisponible).');
        
      } else {
        // Mode normal avec IA
        setProcessingStep('Transcription audio en cours...');
        
        const transcriptionResult = await getTranscription(uploadResult.video.file_path);
        
        if (!transcriptionResult.success) {
          // En cas d'échec de transcription, essayer le mode dégradé
          console.warn('Transcription échouée, passage en mode dégradé:', transcriptionResult.error);
          
          const basicAnalysis = getBasicAnalysis(`Erreur de transcription - Fichier: ${selectedFile.name}`);
          
          if (basicAnalysis.success) {
            await supabase
              .from('transcriptions')
              .insert({
                video_id: uploadResult.video.id,
                profile_id: uploadResult.video.profile_id,  // Utiliser profile_id
                transcription_text: 'Transcription échouée',
                confidence_score: 25,
                analysis_result: basicAnalysis.data,
                processing_status: 'failed_transcription'
              });
          }
          
          await supabase
            .from("videos")
            .update({ 
              status: VIDEO_STATUS.PUBLISHED,
              processing_notes: 'Transcription échouée - Analyse basique'
            })
            .eq('id', uploadResult.video.id);

          setUploadProgress(100);
          setUploadStatus('success');
          setSuccessMessage('Vidéo uploadée ! Transcription échouée, analyse basique effectuée.');
          
        } else {
          // Étape 3: Analyse IA complète
          setUploadProgress(75);
          setProcessingStep('Analyse IA du contenu...');
          
          const analysisResult = await analyzePitch(transcriptionResult.data);
          
          if (!analysisResult.success) {
            // En cas d'échec d'analyse, utiliser l'analyse basique avec la transcription
            console.warn('Analyse IA échouée, utilisation de l\'analyse basique:', analysisResult.error);
            
            const basicAnalysis = getBasicAnalysis(transcriptionResult.data);
            
            if (basicAnalysis.success) {
              await supabase
                .from('transcriptions')
                .insert({
                  video_id: uploadResult.video.id,
                  profile_id: uploadResult.video.profile_id,  // Utiliser profile_id
                  transcription_text: transcriptionResult.data,
                  confidence_score: 75,
                  analysis_result: basicAnalysis.data,
                  processing_status: 'transcription_only'
                });
            }
            
            await supabase
              .from("videos")
              .update({ 
                status: VIDEO_STATUS.PUBLISHED,
                processing_notes: 'Transcription OK - Analyse IA échouée'
              })
              .eq('id', uploadResult.video.id);

            setUploadProgress(100);
            setUploadStatus('success');
            setSuccessMessage('Vidéo uploadée et transcrite ! Analyse IA échouée, analyse basique effectuée.');
            
          } else {
            // Succès complet
            await supabase
              .from('transcriptions')
              .insert({
                video_id: uploadResult.video.id,
                profile_id: uploadResult.video.profile_id,  // Utiliser profile_id
                transcription_text: transcriptionResult.data,
                confidence_score: 90,
                analysis_result: analysisResult.data,
                processing_status: 'completed_full'
              });

            await supabase
              .from("videos")
              .update({ status: VIDEO_STATUS.PUBLISHED })
              .eq('id', uploadResult.video.id);

            setUploadProgress(100);
            setUploadStatus('success');
            setSuccessMessage('Vidéo uploadée et analysée avec succès !');
          }
        }
      }
      
      // Reset après 5 secondes
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
        setSuccessMessage('');
        setSelectedFile(null);
        setProcessingStep('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 5000);

    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      setUploadStatus('error');
      setProcessingStep('');
      
      // Messages d'erreur plus explicites
      let errorMessage = 'Une erreur est survenue lors du traitement.';
      
      if (error.message.includes('videos_status_check')) {
        errorMessage = 'Erreur de statut vidéo : Configuration de base de données incorrecte.';
      } else if (error.message.includes('storage') || error.message.includes('bucket')) {
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
    setProcessingStep('');
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
        return 'Analyse en cours...';
      case 'success':
        return 'Traitement terminé !';
      case 'error':
        return 'Erreur';
      default:
        return selectedFile ? 'Fichier sélectionné' : 'Glissez votre vidéo ici';
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Indicateur de statut IA avec design moderne */}
      {aiAvailable !== null && (
        <div className={`flex items-center gap-3 p-4 rounded-xl text-sm shadow-lg border ${
          aiAvailable 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200' 
            : 'bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-700 border-yellow-200'
        }`}>
          <div className={`p-2 rounded-lg ${
            aiAvailable ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
            <Info className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">
              {aiAvailable 
                ? 'Service d\'analyse IA disponible' 
                : 'Service IA indisponible'
              }
            </p>
            <p className="text-xs opacity-75">
              {aiAvailable 
                ? 'Analyse complète activée' 
                : 'Analyse basique disponible'
              }
            </p>
          </div>
        </div>
      )}

      {/* Input file caché mais accessible pour les tests */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/quicktime"
        onChange={handleFileInputChange}
        className="sr-only"
        data-testid="file-input"
      />
      
      {/* Zone de drop avec design moderne */}
      <div 
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 overflow-hidden ${
          isDragging ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 scale-105' : 
          uploadStatus === 'success' ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-50' :
          uploadStatus === 'error' ? 'border-red-500 bg-gradient-to-br from-red-50 to-pink-50' :
          selectedFile ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50' :
          'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Effet de fond animé */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-4 w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="absolute bottom-4 right-4 w-6 h-6 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 right-8 w-4 h-4 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative z-10">
          <div className="mb-6">
            {getStatusIcon()}
          </div>
          
          <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
            {getStatusText()}
          </h3>
          
          {/* Étape de traitement avec design amélioré */}
          {processingStep && (
            <div className="mb-4 p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-white/20">
              <p className="text-sm text-blue-700 font-medium">{processingStep}</p>
            </div>
          )}
          
          {/* Affichage du fichier sélectionné avec design moderne */}
          {selectedFile && uploadStatus === 'idle' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 text-left">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                    <FileVideo className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={removeSelectedFile}
                  className="ml-3 p-2 hover:bg-red-100 rounded-lg transition-colors duration-200 group"
                  title="Supprimer le fichier"
                >
                  <X className="h-4 w-4 text-gray-500 group-hover:text-red-600" />
                </button>
              </div>
            </div>
          )}
          
          {uploadStatus === 'idle' && !selectedFile && (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">ou cliquez pour sélectionner</p>
              <Button 
                onClick={openFileDialog} 
                disabled={uploadStatus !== 'idle'}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <Upload className="h-4 w-4 mr-2" />
                Sélectionner un fichier
              </Button>
            </div>
          )}

          {uploadStatus === 'idle' && selectedFile && (
            <div className="space-y-3">
              <Button 
                onClick={processVideo} 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Upload className="h-4 w-4 mr-2" />
                Uploader et analyser
              </Button>
              <Button 
                onClick={openFileDialog} 
                variant="outline" 
                className="w-full hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
              >
                <FileVideo className="h-4 w-4 mr-2" />
                Choisir un autre fichier
              </Button>
            </div>
          )}

          {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {uploadProgress}% terminé
              </p>
            </div>
          )}

          {/* Messages de succès et d'erreur avec design amélioré */}
          {successMessage && (
            <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-800 font-medium text-sm">{successMessage}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800 font-medium text-sm">{errorMessage}</p>
              </div>
              {uploadStatus === 'error' && (
                <div className="space-y-2">
                  <Button 
                    onClick={() => {
                      setUploadStatus('idle');
                      setErrorMessage('');
                      setProcessingStep('');
                    }} 
                    variant="outline" 
                    size="sm" 
                    className="w-full hover:bg-red-50 hover:border-red-300"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réessayer
                  </Button>
                  {!aiAvailable && (
                    <p className="text-xs text-gray-600 bg-white/60 p-2 rounded">
                      Note: Le service d'analyse IA est temporairement indisponible. 
                      L'analyse basique sera utilisée.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Informations sur les formats supportés */}
          {uploadStatus === 'idle' && !selectedFile && (
            <div className="mt-6 p-4 bg-white/40 backdrop-blur-sm rounded-lg border border-white/20">
              <p className="text-xs text-gray-600 mb-2 font-medium">Formats supportés:</p>
              <div className="flex flex-wrap gap-2">
                {['MP4', 'MOV', 'AVI', 'QuickTime'].map((format) => (
                  <span 
                    key={format}
                    className="px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 text-xs rounded-full border border-blue-200"
                  >
                    {format}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Taille maximum: 100MB</p>
              {!aiAvailable && (
                <div className="mt-2 p-2 bg-yellow-100 rounded border border-yellow-200">
                  <p className="text-xs text-yellow-700">
                    Service IA indisponible - Analyse basique sera effectuée
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadVideoMobile;

