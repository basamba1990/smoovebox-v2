// src/components/VideoUploader.jsx
import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Progress } from './ui/progress.jsx';
import { Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { VIDEO_STATUS } from '../constants/videoStatus.js';
import { v4 as uuidv4 } from 'uuid';

const VideoUploader = ({ onUploadComplete }) => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Vérifier si c'est bien une vidéo
      if (!selectedFile.type.startsWith('video/')) {
        setError('Veuillez sélectionner un fichier vidéo valide.');
        return;
      }
      
      // Vérifier la taille (limite à 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB en octets
      if (selectedFile.size > maxSize) {
        setError('La taille du fichier ne doit pas dépasser 100MB.');
        return;
      }
      
      setFile(selectedFile);
      setTitle(selectedFile.name.split('.')[0]); // Utiliser le nom du fichier comme titre par défaut
      setError(null);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setProgress(0);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    try {
      // 1. D'abord, récupérer le profil de l'utilisateur
      let profileId = null;
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (profileError) {
        // Si le profil n'existe pas, le créer
        if (profileError.code === 'PGRST116' || profileError.code === 'PGRST301') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              email: user.email,
              username: user.email?.split('@')[0] || 'user',
              full_name: user.user_metadata?.full_name || 
                        `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || null
            })
            .select()
            .single();
            
          if (createError) {
            throw new Error(`Erreur lors de la création du profil: ${createError.message}`);
          }
          
          profileId = newProfile.id;
        } else {
          throw new Error(`Erreur lors de la récupération du profil: ${profileError.message}`);
        }
      } else {
        profileId = profileData.id;
      }
      
      // 2. Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      // 3. Créer l'entrée dans la table videos
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          title: title || file.name,
          file_name: file.name,
          file_path: null, // Sera mis à jour après l'upload
          format: fileExt,
          file_size: file.size,
          status: VIDEO_STATUS.PENDING,
          user_id: user.id,
          profile_id: profileId
        })
        .select()
        .single();
      
      if (videoError) {
        throw new Error(`Erreur lors de la création de l'entrée vidéo: ${videoError.message}`);
      }
      
      // 4. Upload du fichier avec suivi de progression
      const { error: uploadError, data } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setProgress(percent);
          },
        });
      
      if (uploadError) {
        // En cas d'erreur, supprimer l'entrée vidéo
        await supabase.from('videos').delete().eq('id', videoData.id);
        throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
      }
      
      // 5. Obtenir l'URL publique
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);
      
      // 6. Mettre à jour l'entrée vidéo avec le chemin du fichier
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          file_path: publicUrlData.publicUrl,
          status: VIDEO_STATUS.PROCESSING // Passer au statut "en traitement"
        })
        .eq('id', videoData.id);
      
      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour de l'entrée vidéo: ${updateError.message}`);
      }
      
      // 7. Déclencher l'Edge Function pour le traitement
      try {
        const response = await fetch('/api/process-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabase.auth.session()?.access_token}`
          },
          body: JSON.stringify({
            videoId: videoData.id,
            videoUrl: publicUrlData.publicUrl
          })
        });
        
        if (!response.ok) {
          console.warn('Avertissement: La fonction de traitement vidéo n\'a pas répondu correctement. Le traitement pourrait être retardé.');
        }
      } catch (functionError) {
        console.warn('Avertissement: Impossible de contacter la fonction de traitement vidéo. Le traitement sera effectué par le job planifié.');
      }
      
      setSuccess(true);
      setTimeout(() => {
        resetForm();
        if (onUploadComplete) onUploadComplete();
      }, 2000);
      
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Déposez votre fichier vidéo ici</h3>
          <p className="text-gray-500 mb-4">ou cliquez pour sélectionner un fichier</p>
          <p className="text-xs text-gray-400">MP4, MOV, AVI, WebM (max 100MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-2 rounded-md">
                <video className="h-16 w-16 object-cover rounded" src={URL.createObjectURL(file)} />
              </div>
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetForm}
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre de la vidéo</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Entrez un titre pour votre vidéo"
                disabled={uploading}
              />
            </div>
            
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progression</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 p-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Erreur</p>
                  <p className="text-xs text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 p-3 rounded-md flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Succès</p>
                  <p className="text-xs text-green-700 mt-1">
                    Votre vidéo a été uploadée avec succès et est en cours de traitement.
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex justify-end">
              <Button 
                onClick={handleUpload} 
                disabled={uploading || !file || success}
              >
                {uploading ? 'Upload en cours...' : 'Uploader la vidéo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
