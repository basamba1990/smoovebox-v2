import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { Upload, FileText, Video, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { VIDEO_STATUS, TRANSCRIPTION_STATUS } from '../constants/videoStatus.js';
import VideoUploader from './VideoUploader.jsx';
import TranscriptionViewer from './TranscriptionViewer.jsx';
import VideoPlayer from './VideoPlayer.jsx';

const Dashboard = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  const fetchVideos = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Approche unifiée pour récupérer les vidéos
      // Essayer d'abord avec la relation directe user_id
      const { data: directData, error: directError } = await supabase
        .from('videos')
        .select(`
          *,
          transcriptions (
            id,
            status,
            confidence_score,
            processed_at,
            analysis_result,
            error_message
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!directError && directData && directData.length > 0) {
        setVideos(directData);
        
        // Si une vidéo était sélectionnée, mettre à jour ses données
        if (selectedVideo) {
          const updatedSelectedVideo = directData.find(v => v.id === selectedVideo.id);
          if (updatedSelectedVideo) {
            setSelectedVideo(updatedSelectedVideo);
          }
        }
        
        setLoading(false);
        return;
      }

      // Si la première approche échoue, essayer avec profile_id
      // D'abord récupérer le profil de l'utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (profileError) {
        // Si le profil n'existe pas, essayer de le créer
        if (profileError.code === 'PGRST116' || profileError.code === 'PGRST301') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              email: user.email,
              username: user.email?.split('@')[0] || 'user',
              full_name: user.user_metadata?.full_name || 
                        `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || null
            })
            .select()
            .single();
            
          if (!createError && newProfile) {
            // Récupérer les vidéos avec le nouveau profile_id
            const { data, error } = await supabase
              .from('videos')
              .select(`
                *,
                transcriptions (
                  id,
                  status,
                  confidence_score,
                  processed_at,
                  analysis_result,
                  error_message
                )
              `)
              .eq('profile_id', newProfile.id)
              .order('created_at', { ascending: false });

            if (!error) {
              setVideos(data || []);
              
              // Si une vidéo était sélectionnée, mettre à jour ses données
              if (selectedVideo && data) {
                const updatedSelectedVideo = data.find(v => v.id === selectedVideo.id);
                if (updatedSelectedVideo) {
                  setSelectedVideo(updatedSelectedVideo);
                }
              }
            }
          } else {
            console.error('Erreur lors de la création du profil:', createError);
            setVideos([]);
          }
        } else {
          console.error('Erreur lors de la récupération du profil:', profileError);
          setVideos([]);
        }
      } else if (profileData) {
        // Récupérer les vidéos avec le profile_id existant
        const { data, error } = await supabase
          .from('videos')
          .select(`
            *,
            transcriptions (
              id,
              status,
              confidence_score,
              processed_at,
              analysis_result,
              error_message
            )
          `)
          .eq('profile_id', profileData.id)
          .order('created_at', { ascending: false });

        if (!error) {
          setVideos(data || []);
          
          // Si une vidéo était sélectionnée, mettre à jour ses données
          if (selectedVideo && data) {
            const updatedSelectedVideo = data.find(v => v.id === selectedVideo.id);
            if (updatedSelectedVideo) {
              setSelectedVideo(updatedSelectedVideo);
            }
          }
        } else {
          console.error('Erreur lors du chargement des vidéos:', error);
          setVideos([]);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des vidéos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async (videoId) => {
    if (!videoId) return;
    
    try {
      // Récupérer d'abord les informations de la vidéo pour le stockage
      const { data: videoData } = await supabase
        .from('videos')
        .select('storage_path, file_path')
        .eq('id', videoId)
        .single();
      
      // Supprimer le fichier du stockage si un chemin est disponible
      if (videoData && (videoData.storage_path || videoData.file_path)) {
        const storagePath = videoData.storage_path || videoData.file_path;
        // Nettoyer le chemin si nécessaire (enlever le préfixe "videos/")
        const cleanPath = storagePath.replace(/^videos\//, '');
        
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([cleanPath]);
        
        if (storageError) {
          console.error('Erreur lors de la suppression du fichier:', storageError);
        }
      }
      
      // Supprimer d'abord les transcriptions associées
      const { error: transcriptionError } = await supabase
        .from('transcriptions')
        .delete()
        .eq('video_id', videoId);
      
      if (transcriptionError) {
        console.error('Erreur lors de la suppression des transcriptions:', transcriptionError);
      }
      
      // Puis supprimer la vidéo
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);
      
      if (error) {
        console.error('Erreur lors de la suppression de la vidéo:', error);
        return;
      }
      
      // Mettre à jour l'état local
      setVideos(videos.filter(video => video.id !== videoId));
      setDeleteConfirm(null);
      
      // Si la vidéo supprimée était sélectionnée, désélectionner
      if (selectedVideo && selectedVideo.id === videoId) {
        setSelectedVideo(null);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  // Nouvelle fonction pour démarrer manuellement la transcription
  const startTranscription = async (videoId) => {
    try {
      setTranscribing(true);
      
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error("Non authentifié");
      }
      
      // Construire l'URL de la fonction Edge
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
      const functionUrl = `https://${projectRef}.supabase.co/functions/v1/transcribe-video`;
      
      console.log("Appel de la fonction de transcription:", functionUrl);
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ videoId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Réponse d'erreur:", errorData);
        throw new Error(`Erreur: ${errorData.error || errorData.details || response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Réponse de transcription:", data);
      
      alert("Transcription démarrée avec succès! Actualisez dans quelques instants pour voir les résultats.");
      
      // Mettre à jour le statut de la vidéo localement
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.id === videoId 
            ? { ...video, status: 'processing' } 
            : video
        )
      );
      
      if (selectedVideo && selectedVideo.id === videoId) {
        setSelectedVideo(prev => ({ ...prev, status: 'processing' }));
      }
      
      // Rafraîchir la liste des vidéos après un délai
      setTimeout(() => {
        fetchVideos();
      }, 3000);
      
    } catch (error) {
      alert(`Erreur: ${error.message}`);
      console.error("Erreur de transcription:", error);
    } finally {
      setTranscribing(false);
    }
  };

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

  const getStatusBadge = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    // Normaliser le statut en majuscules pour la comparaison
    const normalizedStatus = status.toUpperCase();
    
    const statusMap = {
      [VIDEO_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
      [VIDEO_STATUS.PROCESSING]: 'bg-blue-100 text-blue-800',
      [VIDEO_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
      [VIDEO_STATUS.FAILED]: 'bg-red-100 text-red-800',
      [TRANSCRIPTION_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
      [TRANSCRIPTION_STATUS.PROCESSING]: 'bg-blue-100 text-blue-800',
      [TRANSCRIPTION_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
      [TRANSCRIPTION_STATUS.FAILED]: 'bg-red-100 text-red-800',
    };
    
    return statusMap[normalizedStatus] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    if (!status) return 'Inconnu';
    
    // Normaliser le statut en majuscules pour la comparaison
    const normalizedStatus = status.toUpperCase();
    
    const statusTextMap = {
      [VIDEO_STATUS.PENDING]: 'En attente',
      [VIDEO_STATUS.PROCESSING]: 'En traitement',
      [VIDEO_STATUS.COMPLETED]: 'Terminé',
      [VIDEO_STATUS.FAILED]: 'Échec',
      [TRANSCRIPTION_STATUS.PENDING]: 'En attente',
      [TRANSCRIPTION_STATUS.PROCESSING]: 'En traitement',
      [TRANSCRIPTION_STATUS.COMPLETED]: 'Terminé',
      [TRANSCRIPTION_STATUS.FAILED]: 'Échec',
    };
    
    return statusTextMap[normalizedStatus] || 'Inconnu';
  };

  // Fonction pour obtenir l'URL publique d'une vidéo
  const getVideoUrl = (video) => {
    if (!video) return null;
    
    // Si la vidéo a déjà une URL publique, l'utiliser
    if (video.public_url) return video.public_url;
    
    // Sinon, construire l'URL à partir du chemin de stockage
    const path = video.storage_path || video.file_path;
    if (!path) return null;
    
    try {
      // Extraire le projectRef de l'URL Supabase
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0];
      
      // Supprimer le préfixe "videos/" si présent
      const cleanPath = path.replace(/^videos\//, '');
      
      return `https://${projectRef}.supabase.co/storage/v1/object/public/videos/${cleanPath}`;
    } catch (e) {
      console.error("Erreur de construction de l'URL:", e);
      return null;
    }
  };

  const renderVideoList = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      );
    }

    if (videos.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune vidéo disponible</h3>
          <p className="text-gray-600 mb-4">
            Commencez par uploader une vidéo pour l'analyser avec notre IA
          </p>
          <Button onClick={() => setActiveTab('upload')}>
            Uploader une vidéo
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {videos.map((video) => (
          <div 
            key={video.id} 
            className={`bg-white p-6 rounded-lg shadow-sm border cursor-pointer transition-all ${
              selectedVideo?.id === video.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedVideo(video)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{video.title || 'Vidéo sans nom'}</h3>
                <p className="text-sm text-gray-500">{formatDate(video.created_at)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(video.status)}`}>
                    {getStatusText(video.status)}
                  </span>
                  
                  {video.transcriptions && video.transcriptions.length > 0 && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      getStatusBadge(video.transcriptions[0].status)
                    }`}>
                      Transcription: {getStatusText(video.transcriptions[0].status)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {deleteConfirm === video.id ? (
                  <>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVideo(video.id);
                      }}
                    >
                      Confirmer
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(null);
                      }}
                    >
                      Annuler
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(video.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
            
            {video.status === VIDEO_STATUS.FAILED && (
              <div className="mt-3 p-2 bg-red-50 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">
                  {video.error_message || "Une erreur s'est produite lors du traitement de cette vidéo."}
                </p>
              </div>
            )}
            
            {video.transcriptions && video.transcriptions.length > 0 && 
             video.transcriptions[0].status === TRANSCRIPTION_STATUS.FAILED && (
              <div className="mt-3 p-2 bg-red-50 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">
                  {video.transcriptions[0].error_message || "Une erreur s'est produite lors de la transcription."}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderVideoDetails = () => {
    if (!selectedVideo) {
      return (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune vidéo sélectionnée</h3>
          <p className="text-gray-600">
            Sélectionnez une vidéo dans la liste pour voir les détails
          </p>
        </div>
      );
    }

    const videoUrl = getVideoUrl(selectedVideo);
    const canTranscribe = selectedVideo.status !== 'processing' && 
                         (!selectedVideo.transcription || selectedVideo.status === 'error');

    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-xl">{selectedVideo.title || 'Vidéo sans nom'}</h3>
              <p className="text-sm text-gray-500">{formatDate(selectedVideo.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedVideo.status)}`}>
                {getStatusText(selectedVideo.status)}
              </span>
              
              {/* Bouton de transcription manuelle */}
              {canTranscribe && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => startTranscription(selectedVideo.id)}
                  disabled={transcribing}
                >
                  {transcribing ? 'Transcription en cours...' : 'Démarrer la transcription'}
                </Button>
              )}
            </div>
          </div>
          
          {videoUrl ? (
            <div className="mb-6">
              <VideoPlayer video={selectedVideo} />
            </div>
          ) : (
            <div className="mb-6 bg-gray-100 aspect-video flex items-center justify-center rounded-lg">
              <p className="text-gray-500">Vidéo non disponible</p>
            </div>
          )}
          
          <div className="space-y-4">
            {selectedVideo.transcriptions && selectedVideo.transcriptions.length > 0 ? (
              <div>
                <h4 className="font-medium mb-2">Statut de la transcription:</h4>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    getStatusBadge(selectedVideo.transcriptions[0].status)
                  }`}>
                    {getStatusText(selectedVideo.transcriptions[0].status)}
                  </span>
                  
                  {selectedVideo.transcriptions[0].status === TRANSCRIPTION_STATUS.COMPLETED && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setActiveTab('transcriptions');
                        // Passer la vidéo sélectionnée au composant TranscriptionViewer via l'état local
                        // ou utiliser un contexte global si nécessaire
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Voir l'analyse
                    </Button>
                  )}
                </div>
                
                {selectedVideo.transcriptions[0].status === TRANSCRIPTION_STATUS.FAILED && (
                  <div className="mt-3 p-3 bg-red-50 rounded-md flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Échec de la transcription</p>
                      <p className="text-xs text-red-700 mt-1">
                        {selectedVideo.transcriptions[0].error_message || 
                         "Une erreur s'est produite lors de la transcription de cette vidéo."}
                      </p>
                      
                      {/* Bouton pour réessayer la transcription */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="mt-2"
                        onClick={() => startTranscription(selectedVideo.id)}
                        disabled={transcribing}
                      >
                        {transcribing ? 'Transcription en cours...' : 'Réessayer la transcription'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Aucune transcription disponible</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    La transcription n'a pas encore été initiée ou est en attente de traitement.
                  </p>
                  
                  {/* Bouton pour démarrer la transcription */}
                  {canTranscribe && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="mt-2"
                      onClick={() => startTranscription(selectedVideo.id)}
                      disabled={transcribing}
                    >
                      {transcribing ? 'Transcription en cours...' : 'Démarrer la transcription'}
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="font-medium mb-2">Détails:</h4>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">ID:</div>
                  <div>{selectedVideo.id}</div>
                  <div className="text-gray-600">Durée:</div>
                  <div>{selectedVideo.duration ? `${selectedVideo.duration}s` : 'Non disponible'}</div>
                  <div className="text-gray-600">Format:</div>
                  <div>{selectedVideo.format || 'Non disponible'}</div>
                  <div className="text-gray-600">Taille:</div>
                  <div>{selectedVideo.file_size ? `${(selectedVideo.file_size / (1024 * 1024)).toFixed(2)} MB` : 'Non disponible'}</div>
                </div>
              </div>
            </div>
            
            {/* Afficher les erreurs de la vidéo si présentes */}
            {selectedVideo.status === 'error' && selectedVideo.error_message && (
              <div className="p-3 bg-red-50 rounded-md">
                <h4 className="font-medium text-red-800 mb-1">Erreur:</h4>
                <p className="text-sm text-red-700">{selectedVideo.error_message}</p>
              </div>
            )}
            
            {/* Afficher la transcription directe si disponible */}
            {selectedVideo.transcription && (
              <div>
                <h4 className="font-medium mb-2">Transcription:</h4>
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">{selectedVideo.transcription}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-6">
          <TabsList>
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span>Mes Vidéos</span>
            </TabsTrigger>
            <TabsTrigger value="transcriptions" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Analyses IA</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'videos' && (
            <Button variant="outline" size="sm" onClick={fetchVideos}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          )}
        </div>

        <TabsContent value="videos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Mes Vidéos</CardTitle>
                  <CardDescription>
                    {videos.length} vidéo(s) disponible(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderVideoList()}
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Détails de la vidéo</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderVideoDetails()}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="transcriptions">
          <Card>
            <CardHeader>
              <CardTitle>Analyses IA</CardTitle>
              <CardDescription>
                Visualisez les transcriptions et analyses de vos vidéos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TranscriptionViewer video={selectedVideo} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload de vidéo</CardTitle>
              <CardDescription>
                Uploadez une vidéo pour l'analyser avec notre IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUploader onUploadComplete={fetchVideos} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
