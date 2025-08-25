import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import VideoPlayer from '../components/VideoPlayer';
import VideoAnalysisResults from '../components/VideoAnalysisResults';
import TranscriptionViewer from '../components/TranscriptionViewer';
import VideoProcessingStatus from '../components/VideoProcessingStatus';

const VideoManagement = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [processingVideoId, setProcessingVideoId] = useState(null);
  
  const getStatusLabel = (status) => {
    const statusMap = {
      'uploaded': 'Uploadée',
      'processing': 'En traitement',
      'transcribed': 'Transcrite',
      'analyzing': 'En analyse',
      'analyzed': 'Analysée',
      'published': 'Publiée',
      'failed': 'Échec',
      'draft': 'Brouillon',
      'ready': 'Prête',
      'pending': 'En attente'
    };
    
    return statusMap[status] || 'Inconnu';
  };
  
  const fetchVideos = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log("Récupération des vidéos pour user_id:", user.id);
      
      if (!supabase) {
        throw new Error("Supabase client non initialisé");
      }
      
      // Utilisation d'une requête plus robuste et optimisée
      const { data, error: supabaseError } = await supabase
        .from("videos")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          updated_at,
          transcription_text,
          analysis,
          ai_result,
          error_message,
          transcription_error,
          user_id,
          storage_path,
          file_path,
          public_url,
          duration,
          performance_score,
          ai_score,
          views_count,
          likes_count,
          comments_count
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (supabaseError) {
        console.error("Erreur Supabase:", supabaseError);
        throw new Error(`Erreur Supabase: ${supabaseError.message}`);
      }
      
      console.log("Videos data received:", data);
      
      const normalizedVideos = (data || []).map(video => {
        // Détection plus robuste de transcription
        const hasTranscription = !!(
          video.transcription_text || 
          (video.transcription_data && typeof video.transcription_data === 'object')
        );
        
        // Utiliser analysis s'il est disponible, sinon ai_result
        let analysisData = video.analysis || {};
        
        // Si analysis est vide mais ai_result existe, essayer de le parser comme JSON
        if ((!analysisData || Object.keys(analysisData).length === 0) && video.ai_result) {
          try {
            analysisData = JSON.parse(video.ai_result);
          } catch (e) {
            console.error("Erreur lors du parsing de ai_result:", e);
            // Si le parsing échoue, traiter ai_result comme du texte simple
            analysisData = { summary: video.ai_result };
          }
        }
        
        const hasAnalysis = !!(analysisData && Object.keys(analysisData).length > 0);
        
        let normalizedStatus = video.status || "pending";
        let statusLabel = getStatusLabel(normalizedStatus);
        
        if (normalizedStatus === 'transcribed' && hasAnalysis) {
          normalizedStatus = "analyzed";
          statusLabel = "Analysée";
        }
        
        // Calcul des métriques 
        const metrics = {
          views: video.views_count || 0,
          likes: video.likes_count || 0,
          comments: video.comments_count || 0
        };
        
        return {
          ...video,
          normalizedStatus,
          statusLabel,
          hasTranscription,
          hasAnalysis,
          metrics,
          analysis_result: analysisData, // Standardiser sur analysis_result pour le frontend
          error_message: video.error_message || video.transcription_error || null,
          // S'assurer que URL est disponible
          url: video.public_url || video.url || null
        };
      });
      
      setVideos(normalizedVideos);
      
      if (selectedVideo) {
        const updatedSelectedVideo = normalizedVideos.find(v => v.id === selectedVideo.id);
        if (updatedSelectedVideo) {
          setSelectedVideo(updatedSelectedVideo);
        }
      }
      
    } catch (error) {
      console.error("Erreur lors du chargement des vidéos:", error);
      setError(`Erreur de chargement: ${error.message}`);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [user, selectedVideo]);

  const getPublicUrl = (video) => {
    if (!video) return null;
    
    // Priorité aux URL déjà générées
    if (video.public_url) return video.public_url;
    if (video.url) return video.url;
    
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error("URL Supabase non configurée");
        return null;
      }
      
      const url = new URL(supabaseUrl);
      const projectRef = url.hostname.split('.')[0];
      
      // Gestion plus robuste du chemin
      let cleanPath = path;
      if (path.startsWith('videos/')) {
        cleanPath = path;
      } else {
        cleanPath = `videos/${path}`;
      }
      
      return `https://${projectRef}.supabase.co/storage/v1/object/public/${cleanPath}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  };
  
  const transcribeVideo = async (video) => {
    if (!video) return;
    
    try {
      setProcessingVideoId(video.id);
      toast.loading("Démarrage de la transcription...", { id: 'transcribe-toast' });
      
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) {
        throw new Error("Erreur d'authentification: " + authError.message);
      }
      
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      const videoUrl = video.public_url || video.url || getPublicUrl(video);
      if (!videoUrl) {
        throw new Error("URL de la vidéo non disponible");
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("URL Supabase non configurée");
      }
      
      // Appel à l'Edge Function transcribe-video
      const response = await fetch(
        `${supabaseUrl}/functions/v1/transcribe-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            videoId: video.id,
            videoUrl: videoUrl
          })
        }
      );
      
      if (!response.ok) {
        let errorMessage = "Erreur lors de la transcription";
        try {
          const errorResult = await response.json();
          errorMessage = errorResult.error || errorMessage;
        } catch (e) {
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      toast.success("Transcription démarrée avec succès", { id: 'transcribe-toast' });
      
      // Mise à jour optimiste de l'interface
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { ...v, status: 'processing', normalizedStatus: 'processing', statusLabel: 'En traitement' } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ ...selectedVideo, status: 'processing', normalizedStatus: 'processing', statusLabel: 'En traitement' });
      }
      
      // Rechargement après un délai
      setTimeout(fetchVideos, 5000);
      
    } catch (err) {
      console.error("Erreur lors de la transcription:", err);
      let errorMessage = err.message;
      
      if (errorMessage.includes('Échec de confirmation de la mise à jour')) {
        errorMessage = "Problème de connexion à la base de données. Veuillez réessayer.";
      }
      
      toast.error(`Erreur: ${errorMessage}`, { id: 'transcribe-toast' });
      
      const updatedVideos = videos.map(v => 
        v.id === video.id ? { 
          ...v, 
          status: 'failed', 
          normalizedStatus: 'failed',
          statusLabel: 'Échec',
          error_message: errorMessage
        } : v
      );
      setVideos(updatedVideos);
      
      if (selectedVideo?.id === video.id) {
        setSelectedVideo({ 
          ...selectedVideo, 
          status: 'failed', 
          normalizedStatus: 'failed',
          statusLabel: 'Échec',
          error_message: errorMessage
        });
      }
    } finally {
      setProcessingVideoId(null);
    }
  };

  const analyzeVideo = async (video) => {
    if (!video) return;
    
    try {
      setProcessingVideoId(video.id);
      toast.loading("Démarrage de l'analyse IA...", { id: 'analyze-toast' });
      
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) {
        throw new Error("Erreur d'authentification: " + authError.message);
      }
      
      const token = authData?.session?.access_token;
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error("URL Supabase non configurée");
      }
      
      // Appel à l'Edge Function analyze-transcription
      const response = await fetch(
        `${supabaseUrl}/functions/v1/analyze-transcription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            videoId: video.id
          })
        }
      );
      
      if (!response.ok) {
        let errorMessage = "Erreur lors de l'analyse";
        try {
          const errorResult = await response.
