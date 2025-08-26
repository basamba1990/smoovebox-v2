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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error("URL Supabase non configurée");
        return null;
      }
      
      const url = new URL(supabaseUrl);
      const projectRef = url.hostname.split('.')[0];
      
      const cleanPath = storagePath.replace(/^videos\//, '');
      
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
      const cleanPath = storagePath.replace(/^videos\//, '');
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(cleanPath, 60 * 60); // 1 hour expiry
      
      if (error) {
        console.error("Erreur lors de la création de l'URL signée:", error);
        return null;
      }
      
      return data.signedUrl;
    } catch (e) {
      console.error("Erreur lors de la création de l'URL signée:", e);
      return null;
    }
  }, []);

  // Charger l'URL de la vidéo
  useEffect(() => {
    const loadVideoUrl = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Priorité 1: URL fournie directement
        if (propVideoUrl) {
          setVideoUrl(propVideoUrl);
          return;
        }
        
        // Priorité 2: URL publique de la vidéo
        if (video && video.public_url) {
          setVideoUrl(video.public_url);
          return;
        }
        
        // Priorité 3: Générer une URL à partir du storage path
        const path = propStoragePath || (video && (video.storage_path || video.file_path));
        if (path) {
          // D'abord essayer l'URL publique
          const publicUrl = getPublicUrl(path);
          if (publicUrl) {
            // Vérifier si l'URL est accessible
            try {
              const response = await fetch(publicUrl, { method: 'HEAD' });
              if (response.ok) {
                setVideoUrl(publicUrl);
                return;
              }
            } catch (e) {
              console.log("L'URL publique n'est pas accessible, tentative avec URL signée");
            }
          }
          
          // Si l'URL publique n'est pas accessible, essayer une URL signée
          const signedUrl = await createSignedUrl(path);
          if (signedUrl) {
            setVideoUrl(signedUrl);
            return;
          }
        }
        
        setError("Impossible de charger la vidéo: URL non disponible");
      } catch (err) {
        console.error("Erreur lors du chargement de la vidéo:", err);
        setError("Erreur lors du chargement de la vidéo");
      } finally {
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

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setIsLoading(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError("Erreur lors du chargement de la vidéo");
      setIsLoading(false);
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('ended', handleEnded);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('ended', handleEnded);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoUrl, handleTimeUpdate]);

  // Gestion de l'affichage des contrôles
  useEffect(() => {
    let timeout;

    if (isPlaying) {
      setShowControls(true);
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isPlaying]);

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName)) {
        return;
      }

      switch (e.key) {
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
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'ArrowLeft':
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
      onMouseMove={() => {
        setShowControls(true);
      }}
      onMouseLeave={() => {
        if (isPlaying) {
          setTimeout(() => setShowControls(false), 2000);
        }
      }}
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

      {/* Overlay de chargement */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      )}

      {/* Overlay d'erreur */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
          <div className="text-center p-4">
            <p className="text-white mb-2">{error}</p>
            <Button onClick={() => window.location.reload()} variant="secondary">
              Réessayer
            </Button>
          </div>
        </div>
      )}

      {/* Contrôles */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 transition-opacity ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Barre de progression */}
        <div className="mb-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
          />
        </div>

        {/* Contrôles principaux */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </Button>

            <Button variant="ghost" size="icon" onClick={skipBackward} className="text-white">
              <SkipBack size={20} />
            </Button>

            <Button variant="ghost" size="icon" onClick={skipForward} className="text-white">
              <SkipForward size={20} />
            </Button>

            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white">
                {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </Button>

              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>

            <span className="text-white text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white">
            <Maximize size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
