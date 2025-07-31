// src/components/VideoUpload.jsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, toDatabaseStatus } from '../constants/videoStatus';
import { FiUpload, FiX } from 'react-icons/fi';

const VideoUpload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Vérifier le type de fichier
      if (!selectedFile.type.startsWith('video/')) {
        setError('Veuillez sélectionner un fichier vidéo valide');
        return;
      }
      
      // Vérifier la taille du fichier (max 100MB)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('La taille du fichier ne doit pas dépasser 100MB');
        return;
      }
      
      setFile(selectedFile);
      // Utiliser le nom du fichier comme titre par défaut si aucun titre n'est défini
      if (!title) {
        const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
        setTitle(fileName);
      }
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier vidéo');
      return;
    }

    if (!title.trim()) {
      setError('Veuillez entrer un titre pour la vidéo');
      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      // 1. Créer l'entrée vidéo dans la base de données
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          status: toDatabaseStatus(VIDEO_STATUS.UPLOADING), // Utiliser la fonction de conversion
          user_id: user.id,
          original_file_name: file.name,
          file_size: file.size,
          format: file.type.split('/')[1] || 'mp4'
        })
        .select()
        .single();

      if (videoError) {
        throw new Error(`Erreur lors de la création de l'entrée vidéo: ${videoError.message}`);
      }

      // 2. Générer un nom de fichier unique pour le stockage
      const fileExt = file.name.split('.').pop();
      const filePath = `videos/${videoData.id}/${Date.now()}.${fileExt}`;
      const storagePath = `uploads/${filePath}`;

      // 3. Télécharger le fichier avec suivi de progression
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setProgress(percent);
          }
        });

      if (uploadError) {
        // En cas d'erreur d'upload, mettre à jour le statut de la vidéo
        await supabase
          .from('videos')
          .update({ 
            status: toDatabaseStatus(VIDEO_STATUS.ERROR),
            transcription_error: `Erreur d'upload: ${uploadError.message}`
          })
          .eq('id', videoData.id);
          
        throw new Error(`Erreur lors du téléchargement: ${uploadError.message}`);
      }

      // 4. Mettre à jour l'entrée vidéo avec le chemin de stockage
      const { error: updateError } = await supabase
        .from('videos')
        .update({ 
          storage_path: storagePath,
          file_path: storagePath, // Pour compatibilité avec le code existant
          status: toDatabaseStatus(VIDEO_STATUS.UPLOADED)
        })
        .eq('id', videoData.id);

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour des informations: ${updateError.message}`);
      }

      // 5. Déclencher la transcription via l'Edge Function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ video_id: videoData.id })
          }
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Erreur lors du déclenchement de la transcription:', errorData);
          // Ne pas bloquer le processus si la transcription échoue
        }
      } catch (transcriptionError) {
        console.error('Erreur lors de la demande de transcription:', transcriptionError);
        // Ne pas bloquer le processus si la transcription échoue
      }

      setSuccess(true);
      setFile(null);
      setTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Rediriger vers la page de détail de la vidéo après 2 secondes
      setTimeout(() => {
        navigate(`/videos/${videoData.id}`);
      }, 2000);
      
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Télécharger une vidéo</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 relative">
          <span className="block sm:inline">{error}</span>
          <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <FiX className="h-4 w-4" />
          </span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Vidéo téléchargée avec succès! Redirection en cours...
        </div>
      )}
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Titre</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Titre de la vidéo"
          disabled={uploading}
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Description (optionnelle)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          rows="3"
          placeholder="Description de la vidéo"
          disabled={uploading}
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Fichier vidéo</label>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="w-full"
          accept="video/*"
          disabled={uploading}
        />
        {file && (
          <div className="mt-2 flex items-center">
            <span className="text-sm">{file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            <button 
              onClick={handleCancel} 
              className="ml-2 text-red-500"
              disabled={uploading}
            >
              <FiX />
            </button>
          </div>
        )}
      </div>
      
      {uploading && progress > 0 && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-sm text-gray-500 mt-1">{progress}%</span>
        </div>
      )}
      
      <div className="flex justify-end">
        <button
          onClick={handleUpload}
          disabled={!file || uploading || success}
          className={`flex items-center gap-2 px-4 py-2 rounded-md ${
            !file || uploading || success 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <FiUpload className="h-4 w-4" />
          {uploading ? 'Téléchargement en cours...' : 'Télécharger'}
        </button>
      </div>
    </div>
  );
};

export default VideoUpload;


