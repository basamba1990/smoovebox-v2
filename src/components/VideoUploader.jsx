// src/components/VideoUpload.jsx

import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function VideoUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  
  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current.files[0];
    
    if (!file) {
      setError("Veuillez sélectionner un fichier vidéo");
      return;
    }
    
    if (!file.type.startsWith('video/')) {
      setError("Le fichier doit être une vidéo");
      return;
    }
    
    try {
      setUploading(true);
      setError(null);
      setSuccess(false);
      
      // 1. Créer l'entrée vidéo dans la base de données
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          title: file.name.split('.')[0],
          user_id: user.id,
          original_file_name: file.name,
          file_size: file.size,
          format: file.type.split('/')[1],
          status: 'uploading'
        })
        .select()
        .single();
      
      if (videoError) throw new Error(`Erreur de création vidéo: ${videoError.message}`);
      
      // 2. Générer un chemin de stockage unique
      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop();
      const storagePath = `${user.id}/${timestamp}-${videoData.id}.${fileExt}`;
      
      // 3. Uploader le fichier avec suivi de progression
      const { error: uploadError, data } = await supabase.storage
        .from('videos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
          }
        });
      
      if (uploadError) throw new Error(`Erreur d'upload: ${uploadError.message}`);
      
      // 4. Mettre à jour l'entrée vidéo avec le chemin de stockage
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          file_path: storagePath,
          storage_path: storagePath,
          status: 'ready'
        })
        .eq('id', videoData.id);
      
      if (updateError) throw new Error(`Erreur de mise à jour: ${updateError.message}`);
      
      // 5. Déclencher la transcription
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({ video_id: videoData.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erreur de transcription: ${errorData.error || response.statusText}`);
      }
      
      setSuccess(true);
      fileInputRef.current.value = '';
      
    } catch (err) {
      console.error("Erreur d'upload:", err);
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  
  return (
    <div className="upload-container">
      <h2>Uploader une vidéo</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Vidéo uploadée avec succès! La transcription est en cours.</div>}
      
      <form onSubmit={handleUpload}>
        <input 
          type="file" 
          ref={fileInputRef}
          accept="video/*"
          disabled={uploading}
        />
        
        <button 
          type="submit" 
          disabled={uploading}
        >
          {uploading ? 'Upload en cours...' : 'Uploader'}
        </button>
        
        {uploading && (
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
            <span>{uploadProgress}%</span>
          </div>
        )}
      </form>
    </div>
  );
}
