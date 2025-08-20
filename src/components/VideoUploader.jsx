import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import { Progress } from './ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

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
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    setSuccess(null);
    setUploadPhase('idle');
    setProgress(0);
    
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
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(fileName);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Vérifications préliminaires
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

    // Vérifier la session utilisateur
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setError('Session expirée. Veuillez vous reconnecter.');
        return;
      }
    } catch (err) {
      setError('Erreur de vérification de session. Veuillez vous reconnecter.');
      return;
    }
    
    try {
      setUploading(true);
      setUploadPhase('uploading');
      setProgress(0);
      
      // Créer d'abord l'entrée dans la base de données
      console.log('Creating database entry first...');
      
      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert([
          {
            user_id: user.id,
            title: title.trim(),
            description: description.trim() || null,
            status: 'uploading',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (dbError) {
        console.error('Erreur base de données:', dbError);
        throw new Error(`Erreur lors de la création de l'entrée: ${dbError.message}`);
      }
      
      console.log('Video entry created:', videoData);
      setProgress(20);
      
      // Upload du fichier avec un nom basé sur l'ID de la vidéo
      const filePath = `${user.id}/${videoData.id}_${Date.now()}_${file.name}`;
      console.log('Uploading file to path:', filePath);
      
      // Simuler la progression
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 80) {
            return prev + Math.random() * 10;
          }
          return prev;
        });
      }, 300);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });
      
      clearInterval(progressInterval);
      
      if (uploadError) {
        console.error('Erreur d\'upload Supabase:', uploadError);
        
        // Supprimer l'entrée de la base de données en cas d'échec d'upload
        await supabase.from('videos').delete().eq('id', videoData.id);
        
        // Messages d'erreur spécifiques
        if (uploadError.message.includes('Duplicate')) {
          throw new Error('Un fichier avec ce nom existe déjà. Veuillez renommer votre fichier.');
        } else if (uploadError.message.includes('size')) {
          throw new Error('Le fichier est trop volumineux pour être uploadé.');
        } else if (uploadError.message.includes('type')) {
          throw new Error('Type de fichier non autorisé.');
        } else {
          throw new Error(`Erreur d'upload: ${uploadError.message}`);
        }
      }
      
      console.log('Upload Supabase réussi:', uploadData);
      setProgress(90);
      
      // Mettre à jour l'entrée avec les informations d'upload
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          file_path: uploadData.path,
          storage_path: uploadData.path,
          status: 'uploaded',
          updated_at: new Date().toISOString()
        })
        .eq('id', videoData.id);
      
      if (updateError) {
        console.error('Erreur mise à jour:', updateError);
        throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`);
      }
      
      setProgress(100);
      setUploadPhase('success');
      setSuccess({
        message: 'Vidéo uploadée avec succès !',
        details: `La vidéo "${title}" a été uploadée et est prête pour la transcription.`,
        videoId: videoData.id
      });
      
      // Réinitialiser le formulaire
      setFile(null);
      setTitle('');
      setDescription('');
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
      
      // Notifier le parent du succès
      if (onUploadComplete) {
        onUploadComplete({ ...videoData, file_path: uploadData.path, storage_path: uploadData.path });
      }
      
    } catch (err) {
      console.error('Erreur lors de l\'upload:', err);
      setUploadPhase('error');
      setError(err.message || 'Une erreur inattendue s\'est produite');
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
      fileInputRef.current.value = null;
    }
  };

  const getPhaseMessage = () => {
    switch (uploadPhase) {
      case 'uploading':
        return `Upload en cours... ${Math.round(progress)}%`;
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
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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
        {/* Messages d'état */}
        <div className={`text-center p-3 rounded-lg ${getPhaseColor()}`}>
          <p className="font-medium">{getPhaseMessage()}</p>
        </div>

        {/* Barre de progression */}
        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-600 text-center">
              {Math.round(progress)}% uploadé
            </p>
          </div>
        )}

        {/* Message de succès détaillé */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-green-800">{success.message}</h4>
                <p className="text-sm text-green-700 mt-1">{success.details}</p>
                {success.videoId && (
                  <p className="text-xs text-green-600 mt-2">ID: {success.videoId}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSuccess(null)}
                className="text-green-600 hover:text-green-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Message d'erreur détaillé */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800">Erreur d'upload</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <div className="mt-2 text-xs text-red-600">
                  <p>Vérifications à effectuer :</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Connexion internet stable</li>
                    <li>Fichier non corrompu</li>
                    <li>Espace de stockage suffisant</li>
                    <li>Session utilisateur valide</li>
                  </ul>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Formulaire d'upload */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="video-file" className="block text-sm font-medium text-gray-700 mb-2">
              Fichier vidéo *
            </label>
            <input
              ref={fileInputRef}
              id="video-file"
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formats supportés: MP4, MOV, AVI, WebM. Taille max: 100MB
            </p>
          </div>

          <div>
            <label htmlFor="video-title" className="block text-sm font-medium text-gray-700 mb-2">
              Titre de la vidéo *
            </label>
            <input
              id="video-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Entrez le titre de votre vidéo"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="video-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnel)
            </label>
            <textarea
              id="video-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              placeholder="Décrivez votre vidéo (optionnel)"
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={!file || !title.trim() || uploading}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Uploader la vidéo
                </>
              )}
            </Button>

            {(file || success || error) && (
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                disabled={uploading}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </form>

        {/* Informations sur le fichier sélectionné */}
        {file && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2">Fichier sélectionné:</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Nom:</span> {file.name}</p>
              <p><span className="font-medium">Taille:</span> {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              <p><span className="font-medium">Type:</span> {file.type}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoUploader;
