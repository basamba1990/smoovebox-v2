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
  const [transcribing, setTranscribing] = useState(false);
  const fileInputRef = useRef(null);
  
  // Fonction pour appeler l'Edge Function de rafraîchissement des stats
  const refreshStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        console.error("Impossible de récupérer le token d'authentification");
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-user-video-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erreur lors du rafraîchissement des stats:', errorData);
      } else {
        console.log('Stats rafraîchies avec succès');
      }
    } catch (error) {
      console.error('Erreur réseau lors du rafraîchissement des stats:', error);
    }
  };

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

  const uploadWithProgress = (file, filePath, onProgress) => {
    return new Promise(async (resolve, reject) => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          reject(new Error('Session d\'authentification non trouvée'));
          return;
        }

        const xhr = new XMLHttpRequest();
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const url = `${supabaseUrl}/storage/v1/object/videos/${filePath}`;
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = xhr.responseText ? JSON.parse(xhr.responseText) : {};
              resolve(response);
            } catch (parseError) {
              resolve({ success: true });
            }
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status} - ${xhr.responseText}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });
        
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.setRequestHeader('Cache-Control', '3600');
        xhr.send(file);
        
      } catch (error) {
        reject(error);
      }
    });
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
      setUploadPhase('uploading');
      setProgress(0);
      
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      
      await uploadWithProgress(file, filePath, (percent) => {
        setProgress(percent);
      });
      
      setUploadPhase('processing');
      
      const { data: publicUrl, error: urlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, 365 * 24 * 60 * 60);
      
      if (urlError) {
        console.warn("Impossible de générer l'URL signée:", urlError);
      }
      
      const { data: videoData, error: dbError } = await supabase
        .from('videos')
        .insert([
          {
            user_id: user.id,
            title: title.trim(),
            description: description.trim() || null,
            storage_path: filePath,
            file_path: filePath,
            url: publicUrl?.signedUrl || null,
            status: 'ready',
            original_file_name: file.name,
            file_size: file.size,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (dbError) {
        throw new Error(`Erreur lors de la création de l'entrée: ${dbError.message}`);
      }
      
      // Appeler la transcription avec la fonction Edge
      try {
        setTranscribing(true);
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        
        if (accessToken) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                videoId: videoData.id,
                videoUrl: publicUrl?.signedUrl || null
              })
            }
          );
        }
      } catch (transcribeError) {
        console.error('Erreur lors de l\'appel à la fonction de transcription:', transcribeError);
      } finally {
        setTranscribing(false);
      }
      
      // Rafraîchir les statistiques après l'upload réussi
      await refreshStats();
      
      setUploadPhase('success');
      setSuccess("Vidéo uploadée avec succès! La transcription est en cours...");
      
      // Réinitialiser le formulaire
      setFile(null);
      setTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
      
      if (onUploadComplete && videoData) {
        onUploadComplete(videoData);
      }
      
    } catch (err) {
      setUploadPhase('error');
      setError(`Erreur lors de l'upload: ${err.message}`);
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
    setTranscribing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
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
        <div className={`text-center p-3 rounded-lg ${getPhaseColor()}`}>
          <p className="font-medium">{getPhaseMessage()}</p>
        </div>

        {(uploading || uploadPhase === 'processing' || transcribing) && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-gray-600 text-center">
              {uploadPhase === 'uploading' ? `${progress}% uploadé` : 
               transcribing ? 'Démarrage de la transcription...' : 'Traitement en cours...'}
            </p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-green-800">Succès !</h4>
                <p className="text-sm text-green-700 mt-1">{success}</p>
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

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-red-800">Erreur d'upload</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
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
              disabled={uploading || transcribing}
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
              disabled={uploading || transcribing}
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
              disabled={uploading || transcribing}
              placeholder="Décrivez votre vidéo (optionnel)"
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              maxLength={500}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={!file || !title.trim() || uploading || transcribing}
              className="flex-1"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {uploadPhase === 'uploading' ? 
                    `Upload en cours... ${progress}%` : 
                    'Traitement en cours...'}
                </>
              ) : transcribing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Démarrage transcription...
                </>
              ) : (
                'Uploader la vidéo'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={uploading || transcribing}
              className="flex-1"
            >
              Réinitialiser
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default VideoUploader;
