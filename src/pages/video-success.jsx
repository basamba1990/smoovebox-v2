// src/pages/video-success.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button-enhanced.jsx';
import { supabase, refreshSession } from '../lib/supabase';
import ProfessionalHeader from '../components/ProfessionalHeader';

const VideoSuccess = ({ user, profile, onSignOut }) => {
  const [videoData, setVideoData] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoId = useMemo(() => searchParams.get('id'), [searchParams]);

  // ✅ CORRIGÉ : Fonction améliorée pour construire l'URL
  const buildAccessibleUrl = useCallback(async (video) => {
    try {
      console.log('🔗 Construction URL pour vidéo:', video);

      // Priorité 1: URL publique existante
      if (video?.public_url) {
        console.log('✅ Utilisation public_url existant:', video.public_url);
        return video.public_url;
      }

      // Priorité 2: Générer URL publique depuis storage_path
      if (video?.storage_path) {
        console.log('📁 Génération URL depuis storage_path:', video.storage_path);
        const { data: urlData } = supabase.storage
          .from('videos')
          .getPublicUrl(video.storage_path);
        
        if (urlData?.publicUrl) {
          console.log('✅ URL publique générée:', urlData.publicUrl);
          return urlData.publicUrl;
        }
      }

      // Priorité 3: Générer URL signée
      if (video?.file_path) {
        console.log('🔐 Génération URL signée depuis file_path:', video.file_path);
        const { data: signedData, error: signedError } = await supabase.storage
          .from('videos')
          .createSignedUrl(video.file_path, 3600); // 1 heure

        if (!signedError && signedData?.signedUrl) {
          console.log('✅ URL signée générée');
          return signedData.signedUrl;
        }
      }

      console.warn('❌ Aucune URL accessible générée');
      return '';
    } catch (e) {
      console.error('❌ Erreur buildAccessibleUrl:', e);
      return '';
    }
  }, []);

  // ✅ CORRIGÉ : Fonction fetchVideoData améliorée avec plus de colonnes
  const fetchVideoData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🎬 Recherche vidéo ID:', videoId);

      if (!videoId) {
        setError('ID de vidéo manquant');
        setLoading(false);
        return;
      }

      // Vérification de session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('❌ Erreur session:', sessionError);
        setError('Session invalide');
        toast.error('Veuillez vous reconnecter');
        return;
      }

      // ✅ CORRIGÉ : Sélection de TOUTES les colonnes possibles
      const { data, error } = await supabase
        .from('videos')
        .select(`
          id, 
          title, 
          description, 
          storage_path,
          file_path,
          public_url, 
          created_at, 
          status,
          analysis,
          ai_result,
          transcription_text,
          transcription_data,
          user_id,
          duration,
          file_size,
          format,
          tags,
          tone_analysis,
          use_avatar
        `)
        .eq('id', videoId)
        .single();

      if (error) {
        console.error('❌ Erreur Supabase détaillée:', error);
        
        if (error.code === 'PGRST116') {
          setError(`Vidéo non trouvée (ID: ${videoId})`);
          toast.error('Vidéo non trouvée dans la base de données');
        } else if (error.code === '42501') {
          setError('Accès non autorisé à cette vidéo');
          toast.error('Vous n\'avez pas l\'autorisation d\'accéder à cette vidéo');
        } else {
          setError(`Erreur base de données: ${error.message}`);
          toast.error('Erreur lors du chargement de la vidéo');
        }
        return;
      }

      if (!data) {
        setError('Aucune donnée vidéo retournée');
        toast.error('Vidéo introuvable');
        return;
      }

      console.log('✅ Vidéo trouvée:', data);
      setVideoData(data);

      // Génération de l'URL
      const url = await buildAccessibleUrl(data);
      if (!url) {
        console.warn('⚠️ Impossible de générer l\'URL de la vidéo');
        setError('Impossible de générer le lien de partage');
        toast.warning('Vidéo trouvée mais lien de partage indisponible');
      } else {
        console.log('✅ URL vidéo générée:', url);
        setVideoUrl(url);
      }

      // Tentative d'incrémentation des vues (silencieuse)
      try {
        const { error: viewError } = await supabase
          .from('videos')
          .update({ views: (data.views || 0) + 1 })
          .eq('id', videoId);
        
        if (viewError) {
          console.warn('⚠️ Impossible d\'incrémenter les vues:', viewError);
        }
      } catch (viewError) {
        console.warn('⚠️ Erreur incrémentation vues:', viewError);
      }

    } catch (err) {
      console.error('❌ Erreur fetchVideoData:', err);
      setError(`Erreur inattendue: ${err.message}`);
      toast.error('Erreur lors du chargement de la vidéo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (videoId) {
      console.log('🔄 Initialisation avec videoId:', videoId);
      fetchVideoData();
    } else {
      setError('Paramètre ID manquant dans l\'URL');
      setLoading(false);
    }
  }, [videoId]);

  const copyToClipboard = () => {
    if (videoUrl) {
      navigator.clipboard.writeText(videoUrl);
      toast.success('Lien copié dans le presse-papiers !');
    } else {
      toast.error('Aucun lien disponible à copier');
    }
  };

  const navigateToAnalysis = () => {
    if (videoData?.analysis || videoData?.ai_result) {
      navigate(`/video-analysis/${videoId}`);
    } else {
      toast.info('L\'analyse de votre vidéo est en cours ou non disponible');
    }
  };

  const navigateToDirectory = () => {
    navigate('/directory');
  };

  const navigateToHome = () => {
    navigate('/');
  };

  const navigateToRecord = () => {
    navigate('/record-video');
  };

  // ✅ CORRIGÉ : Fonction pour formater la date
  const formatDate = (dateString) => {
    if (!dateString) return 'Date inconnue';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-lg">Chargement de votre vidéo...</p>
          <p className="text-sm text-gray-500 mt-2">ID: {videoId}</p>
        </div>
      </div>
    );
  }

  if (error || !videoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
        <div className="flex flex-col items-center text-center p-6 min-h-[50vh] justify-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-600 mb-2">Erreur</h2>
          <p className="text-red-500 mb-4 max-w-md">{error || 'Vidéo non trouvée'}</p>
          <p className="text-gray-600 text-sm mb-6">ID vidéo: {videoId}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={fetchVideoData} className="btn-spotbulle">
              🔄 Réessayer
            </Button>
            <Button onClick={navigateToHome} className="bg-blue-600 text-white hover:bg-blue-700">
              🏠 Accueil
            </Button>
            <Button onClick={navigateToRecord} className="bg-green-600 text-white hover:bg-green-700">
              🎥 Nouvelle vidéo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <ProfessionalHeader user={user} profile={profile} onSignOut={onSignOut} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* En-tête de succès */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-4xl font-french font-bold text-gray-900 mb-2">
              Félicitations !
            </h1>
            <p className="text-xl text-gray-600 mb-4">
              Votre vidéo est en ligne et accessible à la communauté
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 inline-block">
              <p className="text-green-800 font-semibold">
                ✅ Vidéo publiée avec succès
              </p>
            </div>
          </div>

          {/* Informations de la vidéo */}
          <div className="card-spotbulle p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">📹 Informations de la vidéo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Titre:</strong> {videoData.title || 'Sans titre'}</p>
                <p><strong>Description:</strong> {videoData.description || 'Aucune description'}</p>
                <p><strong>Durée:</strong> {videoData.duration ? `${videoData.duration} secondes` : 'Inconnue'}</p>
              </div>
              <div>
                <p><strong>Statut:</strong> {videoData.status || 'Inconnu'}</p>
                <p><strong>Créée le:</strong> {formatDate(videoData.created_at)}</p>
                <p><strong>Format:</strong> {videoData.format || 'webm'}</p>
              </div>
            </div>
          </div>

          {/* QR Code et Partage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* QR Code */}
            <div className="card-spotbulle p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                📱 QR Code de partage
              </h3>
              <div className="flex justify-center mb-4">
                {videoUrl ? (
                  <QRCode value={videoUrl} size={200} fgColor="#3b82f6" />
                ) : (
                  <div className="w-200 h-200 flex items-center justify-center bg-gray-100 rounded">
                    <p className="text-gray-500">URL non disponible</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 text-center">
                Scannez ce QR code pour accéder directement à votre vidéo
              </p>
            </div>

            {/* Lien de partage */}
            <div className="card-spotbulle p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                🔗 Lien de partage
              </h3>
              <div className="mb-4">
                <input
                  type="text"
                  value={videoUrl || 'URL non disponible'}
                  readOnly
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={copyToClipboard} 
                  className="flex-1"
                  disabled={!videoUrl}
                >
                  📋 Copier le lien
                </Button>
              </div>
              {!videoUrl && (
                <p className="text-yellow-600 text-sm mt-2">
                  ⚠️ Le lien de partage n'est pas encore disponible
                </p>
              )}
            </div>
          </div>

          {/* Actions principales */}
          <div className="card-spotbulle p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">🚀 Actions disponibles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={navigateToAnalysis}
                className="bg-purple-600 hover:bg-purple-700 text-white py-3"
                disabled={!videoData?.analysis && !videoData?.ai_result}
              >
                📊 Analyse détaillée
              </Button>
              
              <Button
                onClick={navigateToRecord}
                className="bg-green-600 hover:bg-green-700 text-white py-3"
              >
                🎥 Nouvelle vidéo
              </Button>
              
              <Button
                onClick={navigateToDirectory}
                className="bg-blue-600 hover:bg-blue-700 text-white py-3"
              >
                👥 Explorer
              </Button>

              <Button
                onClick={navigateToHome}
                className="bg-gray-600 hover:bg-gray-700 text-white py-3"
              >
                🏠 Accueil
              </Button>
            </div>
          </div>

          {/* Statut d'analyse */}
          {(videoData.analysis || videoData.ai_result) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-semibold">
                ✅ Analyse terminée - Votre vidéo a été analysée avec succès
              </p>
            </div>
          )}

          {videoData.status === 'processing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-blue-800">
                  🔄 Analyse en cours - Votre vidéo est en cours de traitement
                </p>
              </div>
            </div>
          )}

          {/* Footer informatif */}
          <div className="text-center text-sm text-gray-600">
            <p>Votre vidéo est maintenant visible par les membres de la communauté SpotBulle</p>
            <p className="mt-1">Partagez-la avec vos amis et collègues !</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSuccess;
