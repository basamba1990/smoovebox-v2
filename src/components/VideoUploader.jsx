import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const UploadPage = () => {
  const { user } = useAuth();
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

      console.log('Début de l\'upload du fichier:', filePath);
      
      // Upload vers Supabase Storage AVEC gestion de progression
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          // Correction: Utiliser la syntaxe correcte pour le suivi de progression
          onProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100
            );
            setUploadProgress(progress);
            console.log(`Progression de l\'upload: ${progress}%`);
          },
        });

      if (uploadError) {
        console.error('Erreur Supabase Storage lors de l\'upload:', uploadError);
        throw new Error(`Erreur lors de l\'upload: ${uploadError.message}`);
      }

      console.log('Fichier uploadé avec succès dans le stockage Supabase');

      // Enregistrer les informations de la vidéo dans la base de données
      console.log('Enregistrement des informations vidéo dans la base de données...');
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          title: title,
          description: description,
          path: `videos/${filePath}`, // Stocker le chemin complet
          status: 'PENDING'
        })
        .select();

      if (videoError) {
        console.error('Erreur Supabase DB lors de l\'enregistrement de la vidéo:', videoError);
        throw new Error(`Erreur lors de l\'enregistrement de la vidéo: ${videoError.message}`);
      }

      console.log('Informations vidéo enregistrées avec succès:', videoData);
      toast.success('Vidéo uploadée avec succès! Démarrage du traitement...');

      // Récupérer l'ID de la vidéo
      const videoId = videoData?.[0]?.id;
      if (!videoId) {
        throw new Error("Impossible de récupérer l'ID de la vidéo après l'insertion");
      }

      // Récupérer le token d'accès pour l'authentification
      const session = await supabase.auth.getSession();
      const accessToken = session?.data?.session?.access_token;
      
      if (!accessToken) {
        throw new Error("Aucun token d'accès trouvé. L'utilisateur doit être reconnecté.");
      }

      // Appeler la fonction Edge pour le traitement vidéo
      console.log("Appel de la fonction Edge pour le traitement vidéo...");
      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`;
      
      // CORRECTION: Envoyer seulement video_id comme requis par l'Edge Function
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          video_id: videoId
        }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        console.error("Erreur fonction edge:", errorResult);
        throw new Error(`Erreur traitement vidéo: ${errorResult.error || response.statusText}`);
      }

      const result = await response.json();
      console.log("Traitement vidéo démarré:", result);
      toast.success('Traitement vidéo lancé avec succès!');

      // Réinitialiser le formulaire
      setFile(null);
      setTitle('');
      setDescription('');
      setUploadProgress(0);

      // Message d'information
      setTimeout(() => {
        toast.info('Vous pouvez suivre la progression dans l\'onglet "Mes Vidéos"');
      }, 2000);

    } catch (err) {
      console.error('Erreur lors du processus:', err);
      toast.error(`Erreur: ${err.message || 'Une erreur est survenue'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Uploader une nouvelle vidéo</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700">
            Fichier vidéo
          </label>
          <input
            type="file"
            id="file"
            accept="video/*"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={uploading}
          />
        </div>
        
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Titre de la vidéo
          </label>
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
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description (optionnel)
          </label>
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
          <div className="pt-2">
            <div className="text-sm text-gray-600 mb-1">
              Progression: {uploadProgress}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={uploading || !file}
        >
          {uploading ? `Upload en cours (${uploadProgress}%)` : 'Uploader et traiter la vidéo'}
        </button>
      </form>
    </div>
  );
};

export default UploadPage;
