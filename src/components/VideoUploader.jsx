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
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Erreur refresh stats:', error);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Validation du type de fichier
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Type de fichier non supporté. Utilisez MP4, MOV, AVI ou MKV.');
      return;
    }

    // Validation de la taille (max 100MB)
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('Fichier trop volumineux. Maximum 100MB autorisé.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setUploadPhase('idle');
    setProgress(0);
    
    // Définir le titre par défaut
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
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
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          setProgress(Math.round(progress));
        }
      });

    if (error) {
      console.error('Erreur upload:', error);
      throw new Error(`Échec de l'upload: ${error.message}`);
    }

    return data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setError('Vous devez être connecté pour uploader une vidéo');
      return;
    }

    if (!file) {
      setError('Veuillez sélectionner un fichier vidéo');
      return;
    }

    if (!title.trim()) {
      setError('Veuillez donner un titre à votre vidéo');
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);
    setUploadPhase('uploading');

    try {
      // Étape 1: Upload du fichier
      const filePath = `videos/${user.id}/${Date.now()}_${file.name}`;
      const uploadData = await uploadFile(file, filePath);
      
      setUploadPhase('processing');

      // Étape 2: Créer l'entrée vidéo dans la base de données
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            video_url: uploadData.path,
            user_id: user.id,
            status: 'uploaded'
          }
        ])
        .select()
        .single();

      if (videoError) {
        console.error('Erreur création vidéo:', videoError);
        throw new Error(`Échec de l'enregistrement: ${videoError.message}`);
      }

      // Étape 3: Déclencher le traitement
      setUploadPhase('transcribing');
      
      // Simuler le traitement (à remplacer par votre logique réelle)
      setTimeout(async () => {
        try {
          // Mettre à jour le statut pour transcription
          await supabase
            .from('videos')
            .update({ status: 'transcribed' })
            .eq('id', videoData.id);

          // Appeler l'analyse IA
          const { error: analyzeError } = await supabase.functions.invoke('analyze-transcription', {
            body: { video_id: videoData.id }
          });

          if (analyzeError) {
            console.warn('Erreur analyse IA:', analyzeError);
            // Continuer même si l'analyse échoue
          }

          setUploadPhase('success');
          setSuccess('Vidéo uploadée et traitée avec succès!');
          
          // Rafraîchir les stats
          await refreshStats();
          
        } catch (processingError) {
          console.error('Erreur traitement:', processingError);
          setUploadPhase('error');
          setError('Erreur lors du traitement de la vidéo');
        }
      }, 2000);

    } catch (err) {
      console.error('Erreur upload complète:', err);
      setUploadPhase('error');
      setError(err.message || 'Erreur lors de l\'upload de la vidéo');
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
      case 'uploading': return `Upload en cours... ${progress}%`;
      case 'processing': return 'Enregistrement en base de données...';
      case 'transcribing': return 'Traitement et analyse de la vidéo...';
      case 'success': return 'Upload terminé avec succès !';
      case 'error': return 'Erreur lors de l\'upload';
      default: return 'Prêt à uploader';
    }
  };

  const getPhaseColor = () => {
    switch (uploadPhase) {
      case 'uploading':
      case 'processing':
      case 'transcribing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPhaseIcon = () => {
    switch (uploadPhase) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
      default: return <Upload className="h-5 w-5" />;
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
          {(uploadPhase === 'uploading' || uploadPhase === 'processing' || uploadPhase === 'transcribing') && (
            <Progress value={uploadPhase === 'uploading' ? progress : 100} className="mt-2" />
          )}
        </div>

        {/* Messages d'erreur/succès */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <p>{success}</p>
            </div>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sélection de fichier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fichier Vidéo *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="w-full p-2 border border-gray-300 rounded-lg"
              disabled={uploading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Formats supportés: MP4, MOV, AVI, MKV (max 100MB)
            </p>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Titre de la vidéo *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Donnez un titre à votre vidéo"
              className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le contenu de votre vidéo..."
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={resetForm}
              disabled={uploading}
              variant="outline"
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Traitement...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Uploader la vidéo
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
