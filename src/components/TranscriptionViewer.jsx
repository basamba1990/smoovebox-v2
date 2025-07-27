// src/components/TranscriptionViewer.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { RefreshCw, FileText, Video, AlertCircle } from 'lucide-react';
import { TRANSCRIPTION_STATUS } from '../constants/videoStatus.js';
import VideoPlayer from './VideoPlayer.jsx';

const TranscriptionViewer = () => {
  const { user } = useAuth();
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscription, setSelectedTranscription] = useState(null);
  const [activeTab, setActiveTab] = useState('transcript');

  useEffect(() => {
    if (user) {
      fetchTranscriptions();
    }
  }, [user]);

  const fetchTranscriptions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Approche unifiée pour récupérer les transcriptions
      // Essayer d'abord avec la relation directe user_id via videos
      const { data: directData, error: directError } = await supabase
        .from('transcriptions')
        .select(`
          *,
          videos (
            id,
            title,
            file_path,
            user_id
          )
        `)
        .eq('videos.user_id', user.id)
        .eq('status', TRANSCRIPTION_STATUS.COMPLETED)
        .order('processed_at', { ascending: false });

      if (!directError && directData && directData.length > 0) {
        setTranscriptions(directData);
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
        console.error('Erreur lors de la récupération du profil:', profileError);
        setTranscriptions([]);
      } else if (profileData) {
        // Récupérer les transcriptions via videos avec le profile_id
        const { data, error } = await supabase
          .from('transcriptions')
          .select(`
            *,
            videos (
              id,
              title,
              file_path,
              profile_id
            )
          `)
          .eq('videos.profile_id', profileData.id)
          .eq('status', TRANSCRIPTION_STATUS.COMPLETED)
          .order('processed_at', { ascending: false });

        if (!error) {
          setTranscriptions(data || []);
        } else {
          console.error('Erreur lors du chargement des transcriptions:', error);
          setTranscriptions([]);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des transcriptions:', error);
      setTranscriptions([]);
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

  const renderTranscriptionList = () => {
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

    if (transcriptions.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune transcription disponible</h3>
          <p className="text-gray-600 mb-4">
            Uploadez une vidéo et attendez que l'analyse soit terminée pour voir les résultats ici.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {transcriptions.map((transcription) => (
          <div 
            key={transcription.id} 
            className={`bg-white p-6 rounded-lg shadow-sm border cursor-pointer transition-all ${
              selectedTranscription?.id === transcription.id ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedTranscription(transcription)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">
                  {transcription.videos?.title || 'Vidéo sans nom'}
                </h3>
                <p className="text-sm text-gray-500">
                  Analysé le {formatDate(transcription.processed_at)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Analyse complète
                  </span>
                  {transcription.confidence_score && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Confiance: {Math.round(transcription.confidence_score * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTranscriptionDetails = () => {
    if (!selectedTranscription) {
      return (
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune transcription sélectionnée</h3>
          <p className="text-gray-600">
            Sélectionnez une transcription dans la liste pour voir les détails
          </p>
        </div>
      );
    }

    // Analyser le résultat JSON
    let analysisResult = {};
    try {
      if (typeof selectedTranscription.analysis_result === 'string') {
        analysisResult = JSON.parse(selectedTranscription.analysis_result);
      } else {
        analysisResult = selectedTranscription.analysis_result || {};
      }
    } catch (error) {
      console.error('Erreur lors de l\'analyse du résultat JSON:', error);
      analysisResult = {};
    }

    const { transcript, summary, keyPoints, sentiment, topics } = analysisResult;

    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-xl">
                {selectedTranscription.videos?.title || 'Vidéo sans nom'}
              </h3>
              <p className="text-sm text-gray-500">
                Analysé le {formatDate(selectedTranscription.processed_at)}
              </p>
            </div>
          </div>
          
          {selectedTranscription.videos?.file_path && (
            <div className="mb-6">
              <VideoPlayer url={selectedTranscription.videos.file_path} />
            </div>
          )}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="transcript">Transcription</TabsTrigger>
              <TabsTrigger value="summary">Résumé</TabsTrigger>
              <TabsTrigger value="keyPoints">Points clés</TabsTrigger>
              <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
              <TabsTrigger value="topics">Sujets</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transcript" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  {transcript ? (
                    <div className="whitespace-pre-wrap text-gray-700">
                      {transcript}
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
            </TabsContent>
            
            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  {summary ? (
                    <div className="whitespace-pre-wrap text-gray-700">
                      {summary}
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-md flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Aucun résumé disponible pour cette vidéo.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="keyPoints" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  {keyPoints && keyPoints.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-2">
                      {keyPoints.map((point, index) => (
                        <li key={index} className="text-gray-700">{point}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-md flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Aucun point clé identifié pour cette vidéo.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="sentiment" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  {sentiment ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Sentiment global:</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          sentiment.overall === 'positive' ? 'bg-green-100 text-green-800' :
                          sentiment.overall === 'negative' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {sentiment.overall === 'positive' ? 'Positif' :
                           sentiment.overall === 'negative' ? 'Négatif' : 'Neutre'}
                        </span>
                      </div>
                      
                      {sentiment.score && (
                        <div className="bg-gray-50 p-3 rounded-md">
                          <div className="mb-2 flex justify-between text-sm">
                            <span>Score de sentiment</span>
                            <span>{sentiment.score.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                sentiment.score > 0 ? 'bg-green-500' : 
                                sentiment.score < 0 ? 'bg-red-500' : 'bg-gray-500'
                              }`}
                              style={{ 
                                width: `${Math.min(Math.abs(sentiment.score * 50) + 50, 100)}%`,
                                marginLeft: sentiment.score < 0 ? 0 : '50%',
                                marginRight: sentiment.score > 0 ? 0 : '50%',
                                transform: sentiment.score < 0 ? 'translateX(0)' : 'translateX(-100%)'
                              }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Négatif</span>
                            <span>Neutre</span>
                            <span>Positif</span>
                          </div>
                        </div>
                      )}
                      
                      {sentiment.details && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Détails:</h4>
                          <p className="text-gray-700">{sentiment.details}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-md flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Aucune analyse de sentiment disponible pour cette vidéo.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="topics" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  {topics && topics.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topics.map((topic, index) => (
                        <span 
                          key={index}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-md flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Aucun sujet identifié pour cette vidéo.
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
        <Button variant="outline" size="sm" onClick={fetchTranscriptions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          {renderTranscriptionList()}
        </div>
        
        <div className="lg:col-span-2">
          {renderTranscriptionDetails()}
        </div>
      </div>
    </div>
  );
};

export default TranscriptionViewer;
