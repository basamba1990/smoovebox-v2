import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { useRouter } from 'react-router-dom';

const UploadPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    if (!selectedFile) {
      setFile(null);
      return;
    }
    
    // Vérifier le type de fichier
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Format de fichier non supporté. Veuillez utiliser MP4, MOV, AVI ou WebM.');
      setFile(null);
      e.target.value = null;
      return;
    }
    
    // Vérifier la taille du fichier (100MB max)
    if (selectedFile.size > 100 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux. La taille maximale est de 100MB.');
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
    
    if (!user) {
      toast.error('Vous devez être connecté pour uploader une vidéo');
      return;
    }
    
    if (!file) {
      toast.error('Veuillez sélectionner une vidéo à uploader');
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Uploader le fichier dans le bucket "videos"
      const { error: uploadError, data } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setUploadProgress(percent);
          },
        });
      
      if (uploadError) {
        throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
      }
      
      // Enregistrer les informations de la vidéo dans la base de données
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          title: title,
          description: description,
          storage_path: filePath, // Chemin du fichier dans le stockage Supabase
          status: 'processing' // Statut initial
        })
        .select();
        
      if (videoError) {
        throw new Error(`Erreur lors de l'enregistrement de la vidéo: ${videoError.message}`);
      }
      
      toast.success('Vidéo uploadée avec succès et en cours de traitement!');
      
      // Réinitialiser le formulaire
      setFile(null);
      setTitle('');
      setDescription('');
      setUploadProgress(0);
      setUploading(false);
      
      // Rediriger vers la page des vidéos après un court délai
      setTimeout(() => {
        router.push('/videos');
      }, 2000);
      
    } catch (err) {
      toast.error(`Erreur: ${err.message}`);
      setUploading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Uploader une nouvelle vidéo</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700">Fichier vidéo</label>
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
        </div>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre de la vidéo</label>
          <input 
            type="text" 
            id="title" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Entrez un titre pour votre vidéo"
            disabled={uploading}
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description (optionnel)</label>
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
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        )}
        
        <button 
          type="submit" 
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={uploading || !file}
        >
          {uploading ? `Upload en cours (${uploadProgress}%)` : 'Uploader la vidéo'}
        </button>
      </form>
    </div>
  );
};

export default UploadPage;


