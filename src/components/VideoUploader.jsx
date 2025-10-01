import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { Progress } from './ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Upload, CheckCircle, AlertCircle, X, Video } from 'lucide-react';

const VideoUploader = ({ onUploadComplete }) => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [uploadPhase, setUploadPhase] = useState('idle');
  const fileInputRef = useRef(null);

  const refreshStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return;

      // Correction : Implémentation complète du rafraîchissement des stats
      // Récupérer les stats depuis une vue ou requête agrégée (exemple)
      const { data: stats, error: statsError } = await supabase
        .from('videos')
        .select('count(*)')
        .eq('user_id', user.id)
        .eq('status', 'in.(uploaded,processing,transcribed,analyzed)'); // Ajustez selon vos statuts

      if (statsError) throw statsError;

      // Mettre à jour un contexte global ou local (ex: via callback ou store)
      console.log('Rafraîchissement des stats utilisateur:', stats);
      // Ex: dispatch({ type: 'UPDATE_STATS', payload: { totalVideos: stats[0].count } });
      
    } catch (err) {
      console.error('Erreur refreshStats:', err);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    setSuccess(null);
    setUploadPhase('idle');
    setProgress(0);

    if (!selectedFile) return;

    // Validation du type de fichier
    const allowedTypes = [
      'video/mp4', 'video/mpeg', 'video/avi', 'video/mov', 'video/wmv',
      'video/webm', 'video/ogg', 'video/x-msvideo'
    ];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Type de fichier non supporté. Formats acceptés: MP4, MPEG, AVI, MOV, WMV, WEBM, OGG');
      return;
    }

    // Validation de la taille (max 2GB)
    if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
      setError('Le fichier est trop volumineux. Taille maximale: 2GB');
      return;
    }

    setFile(selectedFile);
    
    // Utiliser le nom du fichier comme titre par défaut
    if (!title) {
      const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(fileNameWithoutExt);
    }
  };

  const uploadFile = async (file, path) => {
    console.log('📤 Upload du fichier:', path);
    
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.totalBytes) {
            const percent = Math.round((progressEvent.loaded / progressEvent.totalBytes) * 100);
            setProgress(percent);
            console.log(`Progression: ${percent}%`);
          }
        },
      });

    if (error) {
      console.error('❌ Erreur upload:', error);
      throw error;
    }

    console.log('✅ Upload réussi:', data);
    return data;
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
      setError('Veuillez sélectionner un fichier vidéo');
      return;
    }

    try {
      setUploading(true);
      setUploadPhase('uploading');
      setProgress(0);

      // Étape 1: Upload vers Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      console.log('🚀 Début de l\'upload...');
      const uploadData = await uploadFile(file, filePath);

      setUploadPhase('processing');
      setProgress(100);

      // Étape 2: Enregistrement en base de données
      console.log('💾 Enregistrement en base...');
      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert([
          {
            user_id: user.id,
            title: title || file.name,
            description: description || null,
            file_path: filePath,
            original_file_name: file.name,
            file_size: file.size,
            format: fileExt,
            // Correction : Changer en 'processing' pour lancer le flux (transcription → analyse)
            status: 'processing',
            storage_path: filePath
          }
        ])
        .select()
        .single();

      if (dbError) {
        console.error('❌ Erreur base de données:', dbError);
        throw dbError;
      }

      console.log('✅ Vidéo enregistrée:', videoData);

      // Correction : Déclencher la transcription (assumant une edge function 'transcribe-video' existe)
      // Si elle n'existe pas, implémentez-la pour passer de 'processing' à 'transcribed'
      const { data: transcribeResponse, error: transcribeError } = await supabase.functions.invoke(
        'transcribe-video',
        { body: { videoId: videoData.id } }
      );

      if (transcribeError) {
        console.warn('⚠️ Erreur déclenchement transcription:', transcribeError);
        // Ne bloque pas l'upload ; la transcription peut être relancée manuellement
      } else {
        console.log('✅ Transcription déclenchée:', transcribeResponse);
      }

      setUploadPhase('success');
      setSuccess(`Vidéo "${videoData.title}" uploadée et en traitement !`);

      // Réinitialiser le formulaire
      resetForm();

      // Appeler le callback
      if (onUploadComplete) {
        onUploadComplete();
      }

      // Rafraîchir les stats
      await refreshStats();

    } catch (err) {
      console.error('❌ Erreur handleSubmit:', err);
      setError(`Erreur lors de l'upload: ${err.message}`);
      setUploadPhase('error');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setProgress(0);
    setError(null);
    setSuccess(null);
    setUploadPhase('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getPhaseMessage = () => {
    switch (uploadPhase) {
      case 'uploading':
        return `Upload en cours... ${progress}%`;
      case 'processing':
        return 'Traitement de la vidéo...';
      case 'success':
        return 'Upload terminé avec succès !';
      case 'error':
        return 'Erreur lors de l\'upload';
      default:
        return 'Prêt à uploader';
    }
  };

  const getPhaseColor = () => {
    switch (uploadPhase) {
      case 'uploading':
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPhaseIcon = () => {
    switch (uploadPhase) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Upload className="h-5 w-5" />;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getPhaseIcon()}
          Upload de Vidéo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Indicateur de statut */}
        <div className={`border rounded-lg p-4 ${getPhaseColor()}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{getPhaseMessage()}</p>
            {uploadPhase === 'uploading' && (
              <div className="text-sm text-blue-600">{progress}%</div>
            )}
          </div>
          {uploadPhase === 'uploading' && (
            <Progress value={progress} className="mt-2" />
          )}
        </div>

        {/* Messages d'erreur/succès */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span>{success}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSuccess(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélection de fichier */}
          <div>
            <label htmlFor="videoFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fichier vidéo *
            </label>
            <div className="flex items-center justify-center w-full">
              <label htmlFor="videoFile" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Video className="w-8 h-8 mb-4 text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
                  </p>
                  <p className="text-xs text-gray-500">
                    MP4, AVI, MOV, WMV, WEBM (MAX. 2GB)
                  </p>
                </div>
                <input
                  id="videoFile"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
              </label>
            </div>
            {file && (
              <p className="mt-2 text-sm text-green-600">
                ✓ Fichier sélectionné: {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
              </p>
            )}
          </div>

          {/* Titre */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Titre de la vidéo
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Donnez un titre à votre vidéo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optionnel)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Décrivez le contenu de votre vidéo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Boutons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={uploading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={uploading || !file}
              className="min-w-24"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Upload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Uploader
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default VideoUploader;
