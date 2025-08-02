import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

const VideoUploader = () => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  
  // Configurer la base de données au chargement du composant
  useEffect(() => {
    const setupDatabase = async () => {
      if (!user) return;
      
      try {
        setIsSettingUp(true);
        
        // Récupérer le token d'authentification
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error('Aucune session utilisateur trouvée');
          return;
        }
        
        // Appeler l'Edge Function pour configurer la base de données avec gestion CORS
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-database`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'Accept': 'application/json',
          },
          mode: 'cors', // Explicitement spécifier le mode CORS
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error('Erreur lors de la configuration de la base de données:', result);
        } else {
          console.log('Configuration de la base de données réussie:', result);
        }
      } catch (err) {
        console.error('Erreur lors de la configuration de la base de données:', err);
        // Ne pas bloquer l'interface si la configuration échoue
        console.log('Continuons sans la configuration automatique de la base de données');
      } finally {
        setIsSettingUp(false);
      }
    };
    
    setupDatabase();
  }, [user]);
  
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
    
    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Générer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      console.log('Début de l\'upload du fichier:', filePath);
      
      // Upload du fichier directement vers Supabase Storage
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
      const { data: publicURLData } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);
      
      const publicUrl = publicURLData?.publicUrl || null;
      console.log('URL publique de la vidéo:', publicUrl);
      
      // Enregistrer les informations de la vidéo dans la base de données
      console.log('Enregistrement des informations vidéo dans la base de données...');
      
      // CORRECTION: Utiliser 'processing' au lieu de 'PENDING' pour respecter la contrainte
      const videoData = {
        user_id: user.id,
        title: title,
        description: description,
        storage_path: filePath,
        status: 'processing' // Valeur correcte selon la contrainte de la base de données
      };
      
      // Ajouter public_url si possible
      try {
        const { data: insertData, error: insertError } = await supabase
          .from('videos')
          .insert({
            ...videoData,
            public_url: publicUrl
          })
          .select();
          
        if (insertError) {
          // Si l'erreur concerne la colonne public_url, essayer sans cette colonne
          if (insertError.message && insertError.message.includes('public_url')) {
            console.log('Tentative d\'insertion sans la colonne public_url...');
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('videos')
              .insert(videoData)
              .select();
              
            if (fallbackError) {
              throw new Error(`Erreur lors de l'enregistrement de la vidéo: ${fallbackError.message}`);
            }
            
            console.log('Informations vidéo enregistrées avec succès (sans public_url):', fallbackData);
          } else {
            throw new Error(`Erreur lors de l'enregistrement de la vidéo: ${insertError.message}`);
          }
        } else {
          console.log('Informations vidéo enregistrées avec succès:', insertData);
        }
      } catch (dbError) {
        console.error('Erreur lors de l\'insertion dans la base de données:', dbError);
        
        // Essayer de configurer la base de données via l'Edge Function avec gestion d'erreur améliorée
        try {
          console.log('Tentative de configuration de la base de données via Edge Function...');
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('Aucune session utilisateur trouvée');
          }
          
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-database`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'Accept': 'application/json',
            },
            mode: 'cors',
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
          }
          
          const result = await response.json();
          console.log('Configuration de la base de données réussie, nouvelle tentative d\'insertion...');
          
          // Réessayer l'insertion après la configuration
          const { data: retryData, error: retryError } = await supabase
            .from('videos')
            .insert({
              ...videoData,
              public_url: publicUrl
            })
            .select();
            
          if (retryError) {
            // Si l'erreur persiste avec public_url, essayer sans cette colonne
            if (retryError.message && retryError.message.includes('public_url')) {
              const { data: finalData, error: finalError } = await supabase
                .from('videos')
                .insert(videoData)
                .select();
                
              if (finalError) {
                throw new Error(`Erreur finale lors de l'enregistrement de la vidéo: ${finalError.message}`);
              }
              
              console.log('Informations vidéo enregistrées avec succès (dernière tentative):', finalData);
            } else {
              throw new Error(`Erreur lors de la nouvelle tentative d'enregistrement: ${retryError.message}`);
            }
          } else {
            console.log('Informations vidéo enregistrées avec succès après configuration:', retryData);
          }
        } catch (setupError) {
          console.error('Erreur lors de la configuration et nouvelle tentative:', setupError);
          
          // Dernière tentative : essayer d'insérer sans configuration
          try {
            const { data: lastResortData, error: lastResortError } = await supabase
              .from('videos')
              .insert(videoData)
              .select();
              
            if (lastResortError) {
              throw new Error(`Échec final de l'enregistrement: ${lastResortError.message}`);
            }
            
            console.log('Informations vidéo enregistrées avec succès (dernière tentative):', lastResortData);
          } catch (finalError) {
            throw new Error(`Échec de la configuration et de l'enregistrement: ${finalError.message}`);
          }
        }
      }
      
      setSuccess("Vidéo uploadée avec succès et en cours de traitement!");

      // Déclencher la fonction Edge pour la transcription
      try {
        const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
          'transcribe-video',
          {
            body: { videoId: insertedVideo.id, videoUrl: publicUrl },
          }
        );

        if (invokeError) {
          console.error('Erreur lors de l\'appel de la fonction transcribe-video:', invokeError);
        } else {
          console.log('Fonction transcribe-video appelée avec succès:', invokeData);
        }
      } catch (invokeCatchError) {
        console.error('Erreur inattendue lors de l\'appel de la fonction transcribe-video:', invokeCatchError);
      }

      
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
      
      {isSettingUp && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 flex items-center">
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          <p>Configuration de la base de données en cours...</p>
        </div>
      )}
      
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
            disabled={uploading || isSettingUp}
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
            disabled={uploading || isSettingUp}
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
            disabled={uploading || isSettingUp}
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
          disabled={uploading || !file || isSettingUp}
        >
          {uploading ? `Upload en cours...` : isSettingUp ? 'Configuration en cours...' : 'Uploader la vidéo'}
        </Button>
      </form>
    </div>
  );
};

export default VideoUploader;
