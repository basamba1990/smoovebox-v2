// src/components/VideoUploader.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';

const VideoUploader = () => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Vérifier si le bucket "videos" existe, sinon le créer
  useEffect(() => {
    const checkBucket = async () => {
      try {
        const { data, error } = await supabase.storage.getBucket('videos');
        if (error && error.code === 'PGRST116') {
          // Le bucket n'existe pas, on le crée
          const { error: createError } = await supabase.storage.createBucket('videos', {
            public: true,
            fileSizeLimit: 100 * 1024 * 1024 // 100MB
          });
          if (createError) throw createError;
          console.log('Bucket "videos" créé avec succès');
        }
      } catch (err) {
        console.error('Erreur lors de la vérification/création du bucket:', err);
      }
    };
    
    if (user) {
      checkBucket();
    }
  }, [user]);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    
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
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      console.log('Début de l\'upload du fichier:', filePath);
      
      // Vérifier si la table videos existe
      const { error: tableCheckError } = await supabase
        .from('videos')
        .select('id')
        .limit(1);
      
      if (tableCheckError) {
        console.log('La table videos n\'existe pas, création en cours...');
        // Créer la table videos si elle n'existe pas
        const { error: createTableError } = await supabase.rpc('create_videos_table_if_not_exists');
        if (createTableError) {
          console.error('Erreur lors de la création de la table videos:', createTableError);
          // Continuer quand même, car l'erreur peut être due à une fonction RPC manquante
        }
      }
      
      // Upload du fichier
      const { error: uploadError, data } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
            console.log(`Progression de l\'upload: ${percent}%`);
          },
        });
      
      if (uploadError) {
        console.error('Erreur Supabase Storage lors de l\'upload:', uploadError);
        throw new Error(`Erreur lors de l\'upload: ${uploadError.message}`);
      }
      console.log('Fichier uploadé avec succès dans le stockage Supabase:', data);
      
      // Obtenir l'URL publique de la vidéo
      const { data: publicURL } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);
      
      // Enregistrer les informations de la vidéo dans la base de données
      console.log('Enregistrement des informations vidéo dans la base de données...');
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          title: title,
          description: description,
          storage_path: filePath,
          public_url: publicURL?.publicUrl || null,
          status: 'PENDING'
        })
        .select();
        
      if (videoError) {
        console.error('Erreur Supabase DB lors de l\'enregistrement de la vidéo:', videoError);
        
        // Si l'erreur est due à une table manquante, essayer de la créer
        if (videoError.code === '42P01') { // relation does not exist
          const createTableSQL = `
            CREATE TABLE IF NOT EXISTS public.videos (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
              title TEXT NOT NULL,
              description TEXT,
              storage_path TEXT NOT NULL,
              public_url TEXT,
              status TEXT NOT NULL DEFAULT 'PENDING',
              views INTEGER DEFAULT 0,
              engagement_score FLOAT DEFAULT 0,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
            CREATE POLICY "Users can view their own videos" ON public.videos
              FOR SELECT USING (auth.uid() = user_id);
            CREATE POLICY "Users can insert their own videos" ON public.videos
              FOR INSERT WITH CHECK (auth.uid() = user_id);
            CREATE POLICY "Users can update their own videos" ON public.videos
              FOR UPDATE USING (auth.uid() = user_id);
            CREATE POLICY "Users can delete their own videos" ON public.videos
              FOR DELETE USING (auth.uid() = user_id);
          `;
          
          console.log('Tentative de création de la table videos...');
          
          // Essayer à nouveau d'insérer après avoir créé la table
          const { data: retryData, error: retryError } = await supabase
            .from('videos')
            .insert({
              user_id: user.id,
              title: title,
              description: description,
              storage_path: filePath,
              public_url: publicURL?.publicUrl || null,
              status: 'PENDING'
            })
            .select();
            
          if (retryError) {
            throw new Error(`Erreur lors de l'enregistrement de la vidéo: ${retryError.message}`);
          }
          
          videoData = retryData;
        } else {
          throw new Error(`Erreur lors de l'enregistrement de la vidéo: ${videoError.message}`);
        }
      }
      
      console.log('Informations vidéo enregistrées avec succès:', videoData);
      
      setSuccess('Vidéo uploadée avec succès et en cours de traitement!');
      
      // Réinitialiser le formulaire
      setFile(null);
      setTitle('');
      setDescription('');
      setUploadProgress(0);
      
      // Afficher un message pour informer l'utilisateur
      setTimeout(() => {
        setSuccess('Vous pouvez maintenant voir votre vidéo dans l\'onglet "Mes Vidéos"');
      }, 2000);
      
    } catch (err) {
      console.error('Erreur générale lors de l\'upload ou de l\'enregistrement:', err);
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
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 text-center">{uploadProgress}% complété</p>
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
