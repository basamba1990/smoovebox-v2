import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { RefreshCw, FileText, AlertCircle } from 'lucide-react';
import VideoPlayer from './VideoPlayer.jsx';

const TranscriptionViewer = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeTab, setActiveTab] = useState('transcript');

  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user]);

  const fetchVideos = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Récupérer les vidéos traitées de l'utilisateur
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'COMPLETED')
        .order('processed_at', { ascending: false });

      if (error) {
        console.error('Erreur lors du chargement des vidéos:', error);
        setVideos([]);
      } else {
        setVideos(data || []);
        // Sélectionner la première vidéo par défaut si disponible
        if (data && data.length > 0) {
          setSelectedVideo(data[0]);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des vidéos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
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
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune vidéo traitée disponible</h3>
          <p className="text-gray-600 mb-4">
            Uploadez une vidéo et traitez-la pour voir les résultats ici.
          </p>
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
                <h3 className="font-semibold text-lg">
                  {video.title || 'Vidéo sans nom'}
                </h3>
                <p className="text-sm text-gray-500">
                  Traitée le {formatDate(video.processed_at)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Analyse complète
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVideoDetails = () => {
    if (!selectedVideo) {
      return (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune vidéo sélectionnée</h3>
          <p className="text-gray-600">
            Sélectionnez une vidéo dans la liste pour voir les détails
          </p>
        </div>
      );
    }

    // Récupérer les données de transcription et d'analyse
    const transcription = selectedVideo.transcription || {};
    const analysis = selectedVideo.analysis || {};

    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-xl">
                {selectedVideo.title || 'Vidéo sans nom'}
              </h3>
              <p className="text-sm text-gray-500">
                Traitée le {formatDate(selectedVideo.processed_at)}
              </p>
            </div>
          </div>
          
          {/* Lecteur vidéo */}
          <div className="mb-6">
            <VideoPlayer video={selectedVideo} />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="transcript">Transcription</TabsTrigger>
              <TabsTrigger value="analysis">Analyse</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transcript" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  {transcription.text ? (
                    <div className="whitespace-pre-wrap text-gray-700">
                      {transcription.text}
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-md flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Aucune transcription disponible pour cette vidéo.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {transcription.segments && transcription.segments.length > 0 && (
                <Card className="mt-4">
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Segments</h4>
                    <div className="space-y-2">
                      {transcription.segments.map((segment, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-md">
                          <div className="text-xs text-gray-500 mb-1">
                            {Math.floor(segment.start / 60)}:{(segment.start % 60).toString().padStart(2, '0')} - 
                            {Math.floor(segment.end / 60)}:{(segment.end % 60).toString().padStart(2, '0')}
                          </div>
                          <p>{segment.text}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="analysis" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  {analysis && Object.keys(analysis).length > 0 ? (
                    <div className="space-y-6">
                      {/* Résumé */}
                      {analysis.summary && (
                        <div>
                          <h4 className="font-medium mb-2">Résumé</h4>
                          <p className="text-gray-700">{analysis.summary}</p>
                        </div>
                      )}
                      
                      {/* Mots-clés */}
                      {analysis.keywords && analysis.keywords.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Mots-clés</h4>
                          <div className="flex flex-wrap gap-2">
                            {analysis.keywords.map((keyword, index) => (
                              <span 
                                key={index}
                                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Analyse du pitch */}
                      {analysis.pitch_analysis && (
                        <div>
                          <h4 className="font-medium mb-2">Analyse du Pitch</h4>
                          <p className="text-gray-700">{analysis.pitch_analysis}</p>
                        </div>
                      )}
                      
                      {/* Analyse du langage corporel */}
                      {analysis.body_language_analysis && (
                        <div>
                          <h4 className="font-medium mb-2">Analyse du Langage Corporel</h4>
                          <p className="text-gray-700">{analysis.body_language_analysis}</p>
                        </div>
                      )}
                      
                      {/* Analyse vocale */}
                      {analysis.voice_analysis && (
                        <div>
                          <h4 className="font-medium mb-2">Analyse Vocale</h4>
                          <p className="text-gray-700">{analysis.voice_analysis}</p>
                        </div>
                      )}
                      
                      {/* Score global */}
                      {analysis.overall_score && (
                        <div>
                          <h4 className="font-medium mb-2">Score Global</h4>
                          <div className="flex items-center space-x-2">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full" 
                                style={{ width: `${analysis.overall_score}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{analysis.overall_score}/100</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Points forts */}
                      {analysis.strengths && analysis.strengths.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Points Forts</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {analysis.strengths.map((strength, index) => (
                              <li key={index} className="text-gray-700">{strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Domaines à améliorer */}
                      {analysis.areas_to_improve && analysis.areas_to_improve.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Domaines à Améliorer</h4>
                          <ul className="list-disc pl-5 space-y-1">
                            {analysis.areas_to_improve.map((area, index) => (
                              <li key={index} className="text-gray-700">{area}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-md flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Aucune analyse disponible pour cette vidéo.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchVideos}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {renderVideoList()}
        </div>
        
        <div className="lg:col-span-2">
          {renderVideoDetails()}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionViewer;
