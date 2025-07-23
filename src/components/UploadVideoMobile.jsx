import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Upload, CheckCircle, AlertCircle, Loader2, FileVideo, X, Info, Database } from 'lucide-react';
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
  const [dbError, setDbError] = useState(null);
  const fileInputRef = useRef(null);

  // Vérifier la disponibilité de l'IA au chargement
  React.useEffect(() => {
    const checkAI = async () => {
      try {
        const availability = await checkOpenAIAvailability();
        setAiAvailable(availability.available);
      } catch (error) {
        console.warn('Erreur lors de la vérification de l\'IA:', error);
        setAiAvailable(false);
      }
    };
    checkAI();
  }, []);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Vérifier le type de fichier
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage('Format de fichier non supporté. Utilisez MP4, MOV, AVI ou WebM.');
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
    setDbError(null);
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
    setDbError(null);

    try {
      // Test de connexion à la base de données
      const { data: testConnection, error: connectionError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
        
      if (connectionError && connectionError.code === 'PGRST116') {
        setDbError({
          type: 'missing_tables',
          message: 'Les tables de base de données ne sont pas configurées',
          details: 'Il semble que les tables Supabase (profiles, videos, transcriptions) ne soient pas créées.'
        });
        setUploadStatus('error');
        setErrorMessage('Base de données non configurée. Contactez l\'administrateur.');
        return;
      }

      // Récupérer le profile_id de l'utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (profileError) {
        if (profileError.code === 'PGRST301') {
          // Profil n'existe pas, essayer de le créer
          setProcessingStep('Création du profil utilisateur...');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              email: user.email,
              username: user.email.split('@')[0],
              full_name: user.user_metadata?.full_name || user.email.split('@')[0]
            })
            .select()
            .single();
            
          if (createError) {
            throw new Error(`Erreur lors de la création du profil: ${createError.message}`);
          }
          
          const profileId = newProfile.id;
        } else {
          throw new Error(`Profil utilisateur non trouvé: ${profileError.message}`);
        }
      }
      
      const profileId = profileData?.id;

      // Étape 1: Upload de la vidéo avec callback de progression
      setProcessingStep('Upload de la vidéo en cours...');
      const uploadResult = await uploadVideo(selectedFile, {
        title: selectedFile.name,
        description: '',
        generateThumbnail: true,
        isPublic: false,
        profile_id: profileId // Ajouter le profile_id
      }, (progress) => {
        if (progress.phase === 'video') {
          setUploadProgress(Math.min(progress.progress * 0.4, 40)); // 40% pour l'upload
        }
      });
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      // Mise à jour du statut pour le traitement
      try {
        await supabase
          .from("videos")
          .update({ status: VIDEO_STATUS.PROCESSING })
          .eq('id', uploadResult.video.id);
      } catch (updateError) {
        console.warn('Erreur lors de la mise à jour du statut:', updateError);
        // Continuer même si la mise à jour échoue
      }

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
          try {
            const { error: transcriptionError } = await supabase
              .from('transcriptions')
              .insert({
                video_id: uploadResult.video.id,
                transcription_text: basicTranscription,
                confidence_score: 50,
                analysis_result: basicAnalysis.data,
                processing_status: 'completed_basic'
              });

            if (transcriptionError) {
              console.warn('Erreur lors de l\'enregistrement de l\'analyse basique:', transcriptionError);
            }
          } catch (dbInsertError) {
            console.warn('Table transcriptions non disponible:', dbInsertError);
          }
        }
        
        // Marquer comme publié avec analyse basique
        try {
          await supabase
            .from("videos")
            .update({ 
              status: VIDEO_STATUS.PUBLISHED,
              processing_notes: 'Analyse basique - IA indisponible'
            })
            .eq('id', uploadResult.video.id);
        } catch (updateError) {
          console.warn('Erreur lors de la mise à jour finale:', updateError);
        }

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
            try {
              await supabase
                .from('transcriptions')
                .insert({
                  video_id: uploadResult.video.id,
                  transcription_text: 'Transcription échouée',
                  confidence_score: 25,
                  analysis_result: basicAnalysis.data,
                  processing_status: 'failed_transcription'
                });
            } catch (dbInsertError) {
              console.warn('Erreur d\'insertion transcription:', dbInsertError);
            }
          }
          
          try {
            await supabase
              .from("videos")
              .update({ 
                status: VIDEO_STATUS.PUBLISHED,
                processing_notes: 'Transcription échouée - Analyse basique'
              })
              .eq('id', uploadResult.video.id);
          } catch (updateError) {
            console.warn('Erreur de mise à jour:', updateError);
          }

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
              try {
                await supabase
                  .from('transcriptions')
                  .insert({
                    video_id: uploadResult.video.id,
                    transcription_text: transcriptionResult.data,
                    confidence_score: 75,
                    analysis_result: basicAnalysis.data,
                    processing_status: 'transcription_only'
                  });
              } catch (dbInsertError) {
                console.warn('Erreur d\'insertion transcription:', dbInsertError);
              }
            }
            
            try {
              await supabase
                .from("videos")
                .update({ 
                  status: VIDEO_STATUS.PUBLISHED,
                  processing_notes: 'Transcription OK - Analyse IA échouée'
                })
                .eq('id', uploadResult.video.id);
            } catch (updateError) {
              console.warn('Erreur de mise à jour:', updateError);
            }

            setUploadProgress(100);
            setUploadStatus('success');
            setSuccessMessage('Vidéo uploadée et transcrite ! Analyse IA échouée, analyse basique effectuée.');
            
          } else {
            // Succès complet
            try {
              await supabase
                .from('transcriptions')
                .insert({
                  video_id: uploadResult.video.id,
                  transcription_text: transcriptionResult.data,
                  confidence_score: 90,
                  analysis_result: analysisResult.data,
                  processing_status: 'completed_full'
                });
            } catch (dbInsertError) {
              console.warn('Erreur d\'insertion transcription:', dbInsertError);
            }

            try {
              await supabase
                .from("videos")
                .update({ status: VIDEO_STATUS.PUBLISHED })
                .eq('id', uploadResult.video.id);
            } catch (updateError) {
              console.warn('Erreur de mise à jour finale:', updateError);
            }

            setUploadProgress(100);
            setUploadStatus('success');
            setSuccessMessage('Vidéo uploadée et analysée avec succès !');
          }
        }
      }
      
      // Déclencher un événement pour rafraîchir le dashboard
      window.dispatchEvent(new CustomEvent('videoUploaded', {
        detail: { videoId: uploadResult.video.id }
      }));
      
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
        
        // Déclencher un autre événement pour s'assurer que les données sont rafraîchies
        window.dispatchEvent(new CustomEvent('refreshDashboard'));
      }, 5000);
      
    } catch (error) {
      console.error('Erreur lors du traitement de la vidéo:', error);
      
      let userMessage = 'Une erreur est survenue lors du traitement de la vidéo.';
      
      if (error.message.includes('not found') || error.message.includes('PGRST116')) {
        userMessage = 'Configuration de base de données incomplète. Contactez l\'administrateur.';
        setDbError({
          type: 'missing_tables',
          message: 'Tables de base de données manquantes',
          details: error.message
        });
      } else if (error.message.includes('permission') || error.message.includes('RLS')) {
        userMessage = 'Permissions insuffisantes. Vérifiez votre connexion.';
      } else if (error.message.includes('storage') || error.message.includes('bucket')) {
        userMessage = 'Erreur de stockage. Vérifiez la configuration Supabase Storage.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage = 'Problème de connexion réseau. Vérifiez votre connexion internet.';
      }
      
      setErrorMessage(userMessage);
      setUploadStatus('error');
      setUploadProgress(0);
      setProcessingStep('');
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
    setDbError(null);
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
        return dbError ? <Database className="h-12 w-12 text-yellow-500" /> : <AlertCircle className="h-12 w-12 text-red-500" />;
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
        return dbError ? 'Problème de configuration' : 'Erreur';
      default:
        return selectedFile ? 'Fichier sélectionné' : 'Glissez votre vidéo ici';
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Indicateur de statut IA */}
      {aiAvailable !== null && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          aiAvailable 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
        }`}>
          <Info className="h-4 w-4" />
          {aiAvailable 
            ? 'Service d\'analyse IA disponible' 
            : 'Service IA indisponible - Analyse basique disponible'
          }
        </div>
      )}

      {/* Erreur de base de données */}
      {dbError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-800 text-sm">{dbError.message}</h4>
              <p className="text-yellow-700 text-xs mt-1">{dbError.details}</p>
              <Button 
                onClick={() => window.open('https://supabase.com/docs/guides/database', '_blank')}
                variant="outline" 
                size="sm" 
                className="mt-2 text-xs"
              >
                Documentation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Input file caché mais accessible pour les tests */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/quicktime,video/webm"
        onChange={handleFileInputChange}
        className="sr-only"
        data-testid="file-input"
      />
      
      {/* Zone de drop */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragging ? 'border-blue-500 bg-blue-50' : 
          uploadStatus === 'success' ? 'border-green-500 bg-green-50' :
          uploadStatus === 'error' ? (dbError ? 'border-yellow-500 bg-yellow-50' : 'border-red-500 bg-red-50') :
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
        
        {/* Étape de traitement */}
        {processingStep && (
          <p className="text-sm text-blue-600 mb-2">{processingStep}</p>
        )}
        
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

        {uploadStatus === 'idle' && selectedFile && !dbError && (
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
              <div className="mt-3 space-y-2">
                <Button 
                  onClick={() => {
                    setUploadStatus('idle');
                    setErrorMessage('');
                    setProcessingStep('');
                    setDbError(null);
                  }} 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  Réessayer
                </Button>
                {!aiAvailable && (
                  <p className="text-xs text-gray-600">
                    Note: Le service d'analyse IA est temporairement indisponible. 
                    L'analyse basique sera utilisée.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {uploadStatus === 'idle' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Formats supportés: MP4, MOV, AVI, WebM (max 100MB)
            </p>
            {!aiAvailable && (
              <p className="text-xs text-yellow-600">
                Service IA indisponible - Analyse basique sera effectuée
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadVideoMobile;

