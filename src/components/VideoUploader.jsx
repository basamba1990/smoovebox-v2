// src/components/VideoUploader.jsx
import React, { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';

const VideoUploader = ({ onUploadComplete }) => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    setSuccess(null);
    
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
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, ''); // Enlever l'extension
      setTitle(fileName);
    }
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
      setProgress(0);
      
      // Simuler la progression pendant l'upload
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 5;
          return newProgress > 95 ? 95 : newProgress;
        });
      }, 300);
      
      // 1. Créer un enregistrement dans la base de données
      const { data: videoRecord, error: insertError } = await supabase
        .from('videos')
        .insert({
          title: title.trim(),
          description: description.trim(),
          user_id: user.id,
          status: 'processing'
        })
        .select()
        .single();
      
      if (insertError) {
        if (insertError.code === '42P01') { // Relation n'existe pas
          // Créer la table videos
          const { error: tableError } = await supabase.rpc('create_videos_table');
          
          if (tableError) {
            throw new Error(`Erreur lors de la création de la table: ${tableError.message}`);
          }
          
          // Réessayer l'insertion
          const { data: retryVideo, error: retryError } = await supabase
            .from('videos')
            .insert({
              title: title.trim(),
              description: description.trim(),
              user_id: user.id,
              status: 'processing'
            })
            .select()
            .single();
            
          if (retryError) {
            throw new Error(`Erreur lors de l'insertion: ${retryError.message}`);
          }
          
          videoRecord = retryVideo;
        } else {
          throw new Error(`Erreur lors de l'insertion: ${insertError.message}`);
        }
      }
      
      // 2. Uploader le fichier au Storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        // Si l'upload échoue, supprimer l'enregistrement de la base de données
        await supabase
          .from('videos')
          .delete()
          .eq('id', videoRecord.id);
          
        throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
      }
      
      // 3. Mettre à jour l'enregistrement avec le chemin de stockage
      const { data: publicUrl } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, 365 * 24 * 60 * 60); // URL valide pendant 1 an
      
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          storage_path: filePath,
          url: publicUrl?.signedUrl || null,
          status: 'ready'
        })
        .eq('id', videoRecord.id);
      
      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour: ${updateError.message}`);
      }
      
      // Arrêter la simulation de progression
      clearInterval(progressInterval);
      setProgress(100);
      
      // Réinitialiser le formulaire
      setFile(null);
      setTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Récupérer la vidéo mise à jour
      const { data: finalVideo } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoRecord.id)
        .single();
      
      // Notifier le parent avec les données de la vidéo
      if (onUploadComplete && finalVideo) {
        onUploadComplete(finalVideo);
      }
      
      // Afficher un message de succès
      setSuccess("Vidéo uploadée avec succès!");
      setTimeout(() => {
        setSuccess('Vous pouvez maintenant voir votre vidéo dans l\'onglet "Mes Vidéos"');
      }, 2000);
      
    } catch (err) {
      console.error('Erreur lors de l\'upload:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Uploader une nouvelle vidéo</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
          <p>{success}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">Fichier vidéo</label>
          <input 
            type="file" 
            id="file" 
            ref={fileInputRef}
            accept="video/*" 
            onChange={handleFileChange} 
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={uploading}
          />
          <p className="mt-1 text-xs text-gray-500">Formats acceptés: MP4, MOV, AVI, WebM (max 100MB)</p>
        </div>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Titre de la vidéo</label>
          <input 
            type="text" 
            id="title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Entrez un titre pour votre vidéo"
            disabled={uploading}
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
          <textarea 
            id="description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            rows="3" 
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Ajoutez une description à votre vidéo"
            disabled={uploading}
          ></textarea>
        </div>
        
        {uploading && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 text-center">{progress}% complété</p>
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          disabled={uploading || !file}
        >
          {uploading ? `Upload en cours...` : 'Uploader la vidéo'}
        </Button>
      </form>
    </div>
  );
};

export default VideoUploader;
