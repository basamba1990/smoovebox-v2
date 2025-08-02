// src/components/VideoPlayer.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';

const VideoPlayer = ({ video }) => {
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
  const getPublicUrl = (storagePath) => {
    if (!storagePath) return null;
    
    try {
      // Extraire le projectRef de l'URL Supabase
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0];
      
      // Supprimer le préfixe "videos/" si présent
      const cleanPath = storagePath.replace(/^videos\//, '');
      
      return `https://${projectRef}.supabase.co/storage/v1/object/public/videos/${cleanPath}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  };
  
  // Charger l'URL de la vidéo
  useEffect(() => {
    const loadVideoUrl = async () => {
      if (video) {
        setIsLoading(true);
        setError(null);
        
        // 1. Utiliser d'abord l'URL publique directement si elle est disponible dans l'objet vidéo
        if (video.public_url) {
          setVideoUrl(video.public_url);
          setIsLoading(false);
          return;
        }

        // 2. Fallback: URL signée si nécessaire (pour les buckets privés ou si public_url n'est pas directement disponible)
        //    Ou si le chemin de stockage est présent, tenter de générer une URL publique via Supabase Storage
        if (video.storage_path) {
          try {
            const { data: publicUrlData } = supabase.storage
              .from("videos")
              .getPublicUrl(video.storage_path);

            if (publicUrlData?.publicUrl) {
              setVideoUrl(publicUrlData.publicUrl);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.error("Erreur lors de la récupération de l'URL publique via storage.getPublicUrl:", err);
          }

          // Si getPublicUrl échoue ou ne retourne rien, tenter createSignedUrl
          try {
            const { data, error } = await supabase.storage
              .from("videos")
              .createSignedUrl(video.storage_path, 3600); // 1 heure de validité

            if (data?.signedUrl) {
              setVideoUrl(data.signedUrl);
            } else if (error) {
              console.error("Erreur URL signée:", error);
              setError("Impossible de charger la vidéo");
            }
          } catch (err) {
            console.error("Erreur URL signée (catch):", err);
            setError("Erreur de chargement de la vidéo");
          }
        } else {
          setError("Chemin de stockage de la vidéo non disponible.");
        }
        setIsLoading(false);
      }
    };
    
    loadVideoUrl();
  }, [video]);
  
  // Contrôle de la lecture
  const togglePlay = () => {
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
  };
  
  // Gestion du volume
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  
  const handleVolumeChange = (value) => {
    const newVolume = value[0];
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };
  
  // Gestion de la timeline
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  
  const handleSeek = (value) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };
  
  // Avancer/reculer de 10 secondes
  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  };
  
  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
    }
  };
  
  // Plein écran
  const toggleFullscreen = () => {
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
  };
  
  // Formatage du temps
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Gestion des événements vidéo
  useEffect(() => {
    const video = videoRef.current;
    
    if (video) {
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleLoadedMetadata = () => {
        setDuration(video.duration);
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
      
      // Ajouter les écouteurs d'événements
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleEnded);
      
      // Nettoyer les écouteurs d'événements
      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('ended', handleEnded);
      };
    }
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
  }, [isPlaying, isMuted, duration]);
  
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

  // Si pas de vidéo fournie
  if (!video) {
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
