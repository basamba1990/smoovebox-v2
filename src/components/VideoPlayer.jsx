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
  const getPublicUrl = (filePath) => {
    if (!filePath) return null;
    
    try {
      // Extraire le projectRef de l'URL Supabase
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0];
      
      // Supprimer le préfixe "videos/" si présent
      const cleanPath = filePath.replace(/^videos\//, '');
      
      return `https://${projectRef}.supabase.co/storage/v1/object/public/videos/${cleanPath}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  };
  
  // Charger l'URL de la vidéo
  useEffect(() => {
    const loadVideoUrl = async () => {
      if (!video) {
        setVideoUrl(null);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // 1. Utiliser d'abord l'URL publique directement si elle est disponible dans l'objet vidéo
        if (video.public_url) {
          setVideoUrl(video.public_url);
          setIsLoading(false);
          return;
        }
        
        // 2. Utiliser file_path si disponible
        if (video.file_path) {
          // Vérifier si file_path est déjà une URL complète
          if (video.file_path.startsWith('http')) {
            setVideoUrl(video.file_path);
            setIsLoading(false);
            return;
          }
          
          // Sinon, construire l'URL publique à partir du file_path
          const publicUrl = getPublicUrl(video.file_path);
          if (publicUrl) {
            setVideoUrl(publicUrl);
            setIsLoading(false);
            return;
          }
        }

        // 3. Utiliser storage_path si disponible
        if (video.file_path) {
          // Essayer d'abord getPublicUrl de l'API Supabase
          try {
            // Nettoyer le chemin si nécessaire
            const cleanPath = video.file_path.replace(/^videos\//, '');
            
            const { data: publicUrlData } = supabase.storage
              .from("videos")
              .getPublicUrl(cleanPath);

            if (publicUrlData?.publicUrl) {
              setVideoUrl(publicUrlData.publicUrl);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.error("Erreur lors de la récupération de l'URL publique via storage.getPublicUrl:", err);
          }

          // Si getPublicUrl échoue, essayer createSignedUrl
          try {
            // Nettoyer le chemin si nécessaire
            const cleanPath = video.file_path.replace(/^videos\//, '');
            
            const { data, error: signedUrlError } = await supabase.storage
              .from("videos")
              .createSignedUrl(cleanPath, 3600); // 1 heure de validité

            if (data?.signedUrl) {
              setVideoUrl(data.signedUrl);
              setIsLoading(false);
              return;
            } else if (signedUrlError) {
              console.error("Erreur URL signée:", signedUrlError);
              throw new Error("Impossible de générer une URL signée");
            }
          } catch (err) {
            console.error("Erreur URL signée (catch):", err);
            throw new Error("Erreur lors de la génération de l'URL signée");
          }
        }
        
        // 4. Dernier recours: essayer de construire l'URL à partir de l'ID de la vidéo
        if (video.id) {
          // Tenter de récupérer les informations de la vidéo depuis la base de données
          const { data: videoData, error: videoError } = await supabase
            .from('videos')
            .select('file_path, storage_path, public_url')
            .eq('id', video.id)
            .single();
            
          if (videoError) {
            throw new Error("Impossible de récupérer les informations de la vidéo");
          }
          
          if (videoData) {
            // Essayer chaque champ dans l'ordre de priorité
            if (videoData.public_url) {
              setVideoUrl(videoData.public_url);
              setIsLoading(false);
              return;
            }
            
            if (videoData.file_path) {
              const publicUrl = getPublicUrl(videoData.file_path);
              if (publicUrl) {
                setVideoUrl(publicUrl);
                setIsLoading(false);
                return;
              }
            }
            
            if (videoData.file_path) {
              const cleanPath = videoData.file_path.replace(/^videos\//, '');
              const { data: urlData } = supabase.storage
                .from("videos")
                .getPublicUrl(cleanPath);
                
              if (urlData?.publicUrl) {
                setVideoUrl(urlData.publicUrl);
                setIsLoading(false);
                return;
              }
            }
          }
        }
        
        // Si toutes les tentatives échouent
        throw new Error("Impossible de trouver une URL valide pour cette vidéo");
        
      } catch (err) {
        console.error("Erreur lors du chargement de la vidéo:", err);
        setError(err.message || "Erreur de chargement de la vidéo");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVideoUrl();
  }, [video]);
  
  // Contrôle de la lecture
  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(err => {
        setError("Impossible de lire la vidéo. Format non supporté?");
        console.error("Erreur de lecture:", err);
      });
    }
  };
  
  // Gestion du volume
  const toggleMute = () => {
    if (!videoRef.current) return;
    
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };
  
  const handleVolumeChange = (value) => {
    if (!videoRef.current) return;
    
    const newVolume = value[0];
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };
  
  // Gestion de la timeline
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    setCurrentTime(videoRef.current.currentTime);
  };
  
  const handleSeek = (value) => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };
  
  // Avancer/reculer de 10 secondes
  const skipForward = () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
  };
  
  const skipBackward = () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
  };
  
  // Plein écran
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) {
        containerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };
  
  // Formatage du temps
  const formatTime = (timeInSeconds) => {
    if (typeof timeInSeconds !== 'number' || isNaN(timeInSeconds)) {
      return '0:00';
    }
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Gestion des événements vidéo
  useEffect(() => {
    const video = videoRef.current;
    
    if (!video) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const handleLoadedData = () => setIsLoading(false);
    const handleError = (e) => {
      console.error("Erreur vidéo:", e);
      setError("Erreur lors du chargement de la vidéo");
      setIsLoading(false);
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
        container.removeEventListener('mouseenter', () => setShowControls(true));
      }
      clearTimeout(timeout);
    };
  }, [isPlaying]);
  
  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ne pas intercepter les événements clavier si un élément de formulaire est actif
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }
      
      // Ne pas intercepter les événements clavier si le lecteur n'est pas visible
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.top > window.innerHeight || rect.bottom < 0) {
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
    
    // N'ajouter l'écouteur que si la vidéo est chargée
    if (videoUrl) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, isMuted, duration, videoUrl]);
  
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
          {isLoading ? (
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          ) : (
            <p className="text-white">Chargement de la vidéo...</p>
          )}
        </div>
      )}
      
      {/* Overlay pour les erreurs */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
          <div className="text-white text-center p-4">
            <p className="text-red-400 font-semibold mb-2">Erreur</p>
            <p>{error}</p>
            <div className="flex gap-2 justify-center mt-4">
              <button 
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => window.location.reload()}
              >
                Actualiser la page
              </button>
              <button 
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  setTimeout(() => {
                    const loadVideoUrl = async () => {
                      try {
                        // Tenter de récupérer les informations de la vidéo depuis la base de données
                        const { data: videoData, error: videoError } = await supabase
                          .from('videos')
                          .select('file_path, storage_path, public_url')
                          .eq('id', video.id)
                          .single();
                          
                        if (videoError) {
                          throw new Error("Impossible de récupérer les informations de la vidéo");
                        }
                        
                        if (videoData) {
                          // Essayer chaque champ dans l'ordre de priorité
                          if (videoData.public_url) {
                            setVideoUrl(videoData.public_url);
                            setIsLoading(false);
                            return;
                          }
                          
                          if (videoData.file_path) {
                            const publicUrl = getPublicUrl(videoData.file_path);
                            if (publicUrl) {
                              setVideoUrl(publicUrl);
                              setIsLoading(false);
                              return;
                            }
                          }
                          
                          if (videoData.file_path) {
                            const cleanPath = videoData.file_path.replace(/^videos\//, '');
                            const { data: urlData } = supabase.storage
                              .from("videos")
                              .getPublicUrl(cleanPath);
                              
                            if (urlData?.publicUrl) {
                              setVideoUrl(urlData.publicUrl);
                              setIsLoading(false);
                              return;
                            }
                          }
                        }
                        
                        throw new Error("Impossible de trouver une URL valide pour cette vidéo");
                      } catch (err) {
                        console.error("Erreur lors du rechargement de la vidéo:", err);
                        setError(err.message || "Erreur de chargement de la vidéo");
                        setIsLoading(false);
                      }
                    };
                    
                    loadVideoUrl();
                  }, 1000);
                }}
              >
                Réessayer
              </button>
            </div>
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
