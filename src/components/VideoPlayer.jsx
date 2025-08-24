import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';

const VideoPlayer = ({ video, videoUrl: propVideoUrl, storagePath: propStoragePath, poster }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  
  // Fonction pour générer l'URL publique de la vidéo
  const getPublicUrl = useCallback((storagePath) => {
    if (!storagePath) return null;
    
    try {
      // Extraire le projectRef de l'URL Supabase
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error("URL Supabase non configurée");
        return null;
      }
      
      const url = new URL(supabaseUrl);
      const projectRef = url.hostname.split('.')[0];
      
      // Nettoyer le chemin de stockage
      let cleanPath = storagePath;
      if (cleanPath.startsWith('videos/')) {
        cleanPath = cleanPath.substring(7); // Enlever le préfixe 'videos/'
      }
      
      return `https://${projectRef}.supabase.co/storage/v1/object/public/videos/${cleanPath}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  }, []);
  
  // Fonction pour créer une URL signée
  const createSignedUrl = useCallback(async (storagePath) => {
    if (!storagePath) return null;
    
    try {
      // Nettoyer le chemin de stockage
      let cleanPath = storagePath;
      if (cleanPath.startsWith('videos/')) {
        cleanPath = cleanPath.substring(7); // Enlever le préfixe 'videos/'
      }
      
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(cleanPath, 3600); // 1 heure de validité
        
      if (error) throw error;
      
      return data?.signedUrl || null;
    } catch (err) {
      console.error('Erreur lors de la création de l\'URL signée:', err);
      return null;
    }
  }, []);
  
  // Charger l'URL de la vidéo
  useEffect(() => {
    const loadVideoUrl = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Déterminer la source de la vidéo
        let finalVideoUrl = null;
        
        // 1. Utiliser l'URL directe si fournie en prop
        if (propVideoUrl && (propVideoUrl.startsWith('http://') || propVideoUrl.startsWith('https://'))) {
          finalVideoUrl = propVideoUrl;
        }
        // 2. Utiliser l'URL de la vidéo si fournie dans l'objet video
        else if (video?.public_url && (video.public_url.startsWith('http://') || video.public_url.startsWith('https://'))) {
          finalVideoUrl = video.public_url;
        }
        // 3. Utiliser le chemin de stockage fourni en prop
        else if (propStoragePath) {
          finalVideoUrl = getPublicUrl(propStoragePath);
        }
        // 4. Utiliser le chemin de stockage de l'objet video
        else if (video?.storage_path) {
          finalVideoUrl = getPublicUrl(video.storage_path);
          
          // Si pas d'URL publique, essayer l'URL signée
          if (!finalVideoUrl) {
            finalVideoUrl = await createSignedUrl(video.storage_path);
          }
        }
        
        // Si aucune source valide n'est trouvée
        if (!finalVideoUrl) {
          throw new Error('Aucune source vidéo valide disponible');
        }
        
        setVideoUrl(finalVideoUrl);
      } catch (err) {
        console.error('Erreur de chargement vidéo:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };
    
    loadVideoUrl();
  }, [video, propVideoUrl, propStoragePath, getPublicUrl, createSignedUrl]);
  
  // Contrôle de la lecture
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          setError("Impossible de lire la vidéo. Format non supporté?");
          console.error("Erreur de lecture:", err);
        });
      }
    }
  }, [isPlaying]);
  
  // Gestion du volume
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);
  
  const handleVolumeChange = useCallback((value) => {
    const newVolume = value[0];
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);
  
  // Gestion de la timeline
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);
  
  const handleSeek = useCallback((value) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  }, []);
  
  // Avancer/reculer de 10 secondes
  const skipForward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  }, [duration]);
  
  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  }, []);
  
  // Plein écran
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) {
        containerRef.current.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, []);
  
  // Formatage du temps
  const formatTime = useCallback((timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, []);
  
  // Gestion des événements vidéo
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoUrl) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setIsLoading(false);
    };
    const handleLoadedData = () => setIsLoading(false);
    const handleError = (e) => {
      setError("Erreur lors du chargement de la vidéo");
      setIsLoading(false);
      console.error("Erreur vidéo:", e);
    };
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdateEvent = () => {
      setCurrentTime(videoElement.currentTime);
    };
    
    // Ajouter les écouteurs d'événements
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);
    videoElement.addEventListener('timeupdate', handleTimeUpdateEvent);
    videoElement.addEventListener('ended', handleEnded);
    
    // Nettoyer les écouteurs d'événements
    return () => {
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('loadeddata', handleLoadedData);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
      videoElement.removeEventListener('timeupdate', handleTimeUpdateEvent);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl]);
  
  // Gestion de l'affichage des contrôles
  useEffect(() => {
    let timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      
      timeout = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };
    
    const handleMouseLeave = () => {
      if (isPlaying) {
        setShowControls(false);
      }
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('mouseenter', () => setShowControls(true));
    }
    
    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('mouseenter', () => {});
      }
      clearTimeout(timeout);
    };
  }, [isPlaying]);
  
  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName)) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowright':
          e.preventDefault();
          skipForward();
          break;
        case 'arrowleft':
          e.preventDefault();
          skipBackward();
          break;
        default:
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, toggleFullscreen, toggleMute, skipForward, skipBackward]);
  
  // Gestion de l'événement fullscreenchange
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Si pas de vidéo fournie et pas de props directes
  if (!video && !propVideoUrl && !propStoragePath) {
    return (
      <div className="w-full aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Aucune vidéo sélectionnée</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative rounded-lg overflow-hidden bg-black mb-4 ${
        isFullscreen ? 'w-full h-full' : 'w-full aspect-video'
      }`}
      onDoubleClick={toggleFullscreen}
    >
      {/* Vidéo */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onClick={togglePlay}
          playsInline
          poster={poster}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-white">Chargement de la vidéo...</p>
        </div>
      )}
      
      {/* Overlay pour les erreurs */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="text-white text-center p-4">
            <p className="text-red-400 font-semibold mb-2">Erreur</p>
            <p>{error}</p>
            <button 
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              Réessayer
            </button>
          </div>
        </div>
      )}
      
      {/* Indicateur de chargement */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      )}
      
      {/* Bouton de lecture central */}
      {!isPlaying && showControls && !isLoading && !error && videoUrl && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="bg-black bg-opacity-50 rounded-full p-4">
            <Play className="h-12 w-12 text-white" />
          </div>
        </div>
      )}
      
      {/* Contrôles */}
      {videoUrl && (
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent px-4 py-2 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Timeline */}
          <div className="mb-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
          </div>
          
          {/* Contrôles principaux */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 h-auto"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 h-auto"
                onClick={skipBackward}
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 h-auto"
                onClick={skipForward}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center space-x-2 group relative">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white hover:bg-white hover:bg-opacity-20 p-1 h-auto"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                
                <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 bg-black bg-opacity-70 p-2 rounded-md w-24">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="cursor-pointer"
                  />
                </div>
              </div>
              
              <span className="text-white text-xs">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white hover:bg-opacity-20 p-1 h-auto"
                onClick={toggleFullscreen}
              >
                <Maximize className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
