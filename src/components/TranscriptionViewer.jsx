import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { FileText, Play, Download, RefreshCw, Database, Upload, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

const TranscriptionViewer = () => {
  const { user } = useAuth();
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscription, setSelectedTranscription] = useState(null);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    fetchTranscriptions();
  }, [user]);

  const fetchTranscriptions = async () => {
    if (!user) return;
    
    setLoading(true);
    setDbError(null);
    
    try {
      // Test de connexion à la base de données
      const { data: testConnection, error: connectionError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);
        
      if (connectionError && connectionError.code === 'PGRST116') {
        // Table profiles n'existe pas
        setDbError({
          type: 'missing_tables',
          message: 'Les tables de base de données ne sont pas configurées',
          details: 'Il semble que les tables Supabase (profiles, videos, transcriptions) ne soient pas créées.'
        });
        setLoading(false);
        return;
      }
      
      // D'abord récupérer le profil de l'utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (profileError) {
        if (profileError.code === 'PGRST301') {
          // Profil n'existe pas, essayer de le créer
          console.log('Création du profil utilisateur...');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: user.id,
              email: user.email,
              username: user.email.split('@')[0],
              full_name: user.user_metadata?.full_name || user.email.split('@')[0]
            })
            .select()
            .single();
            
          if (createError) {
            throw new Error(`Erreur lors de la création du profil: ${createError.message}`);
          }
          
          // Nouveau profil créé, pas de transcriptions encore
          setTranscriptions([]);
          setLoading(false);
          return;
        } else {
          throw new Error(`Erreur de profil: ${profileError.message}`);
        }
      }
      
      const profileId = profileData.id;
      
      // Récupérer les vidéos de l'utilisateur
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id, file_path, upload_date, created_at, title')
        .eq('profile_id', profileId);

      if (videosError) {
        if (videosError.code === 'PGRST116') {
          setDbError({
            type: 'missing_videos_table',
            message: 'Table videos non trouvée',
            details: 'La table "videos" n\'existe pas dans la base de données.'
          });
          setLoading(false);
          return;
        }
        console.warn('Erreur lors de la récupération des vidéos:', videosError.message);
        setTranscriptions([]);
        setLoading(false);
        return;
      }

      if (!videos || videos.length === 0) {
        setTranscriptions([]);
        setLoading(false);
        return;
      }

      // Récupérer les transcriptions pour ces vidéos
      const { data, error } = await supabase
        .from('transcriptions')
        .select(`
          *,
          videos (
            file_path,
            upload_date,
            created_at,
            title
          )
        `)
        .in('video_id', videos.map(v => v.id))
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST116') {
          setDbError({
            type: 'missing_transcriptions_table',
            message: 'Table transcriptions non trouvée',
            details: 'La table "transcriptions" n\'existe pas dans la base de données.'
          });
          setLoading(false);
          return;
        }
        throw error;
      }
      
      setTranscriptions(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des transcriptions:', error);
      setDbError({
        type: 'connection_error',
        message: 'Erreur de connexion à la base de données',
        details: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const downloadTranscription = (transcription) => {
    const content = `
Transcription - ${transcription.videos?.file_path || transcription.videos?.title || 'Vidéo'}
Date: ${formatDate(transcription.created_at)}
Score de confiance: ${transcription.confidence_score}%

TRANSCRIPTION:
${transcription.transcription_text}

ANALYSE IA:
${JSON.stringify(transcription.analysis_result, null, 2)}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${transcription.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const retryConnection = () => {
    setDbError(null);
    fetchTranscriptions();
  };

  const goToUpload = () => {
    // Déclencher un événement pour changer d'onglet
    const uploadTab = document.querySelector('[data-value="upload"]');
    if (uploadTab) {
      uploadTab.click();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Analyse IA de Pitch</h2>
          <p className="text-gray-600">Chargement de vos transcriptions...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Affichage d'erreur de base de données
  if (dbError) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Analyse IA de Pitch</h2>
          <p className="text-gray-600">Transcription automatique et suggestions d'amélioration par intelligence artificielle</p>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Database className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                {dbError.message}
              </h3>
              <p className="text-yellow-700 mb-4">
                {dbError.details}
              </p>
              
              {dbError.type === 'missing_tables' && (
                <div className="bg-yellow-100 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Solutions possibles :</h4>
                  <ul className="text-yellow-700 text-sm space-y-1">
                    <li>• Vérifiez que les migrations Supabase ont été exécutées</li>
                    <li>• Créez les tables profiles, videos et transcriptions</li>
                    <li>• Vérifiez les politiques RLS (Row Level Security)</li>
                    <li>• Contactez l'administrateur système</li>
                  </ul>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button onClick={retryConnection} variant="outline">
                  Réessayer
                </Button>
                <Button 
                  onClick={() => window.open('https://supabase.com/docs/guides/database', '_blank')}
                  variant="outline"
                >
                  Documentation Supabase
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Affichage par défaut en mode dégradé */}
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center opacity-50">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Analyse IA temporairement indisponible</h3>
          <p className="text-gray-600 mb-4">
            Les fonctionnalités d'analyse nécessitent une configuration de base de données complète.
          </p>
        </div>
      </div>
    );
  }

  if (transcriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune transcription disponible</h3>
          <p className="text-gray-600 mb-4">
            Uploadez une vidéo pour voir apparaître ici l'analyse automatique de votre pitch par l'IA
          </p>
          <Button onClick={goToUpload} className="inline-flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Aller à l'upload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Vos analyses IA</h3>
          <p className="text-gray-600">{transcriptions.length} transcription(s) disponible(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTranscriptions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="grid gap-6">
        {transcriptions.map((transcription) => (
          <div key={transcription.id} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold text-lg">
                  {transcription.videos?.title || transcription.videos?.file_path || 'Vidéo sans nom'}
                </h4>
                <p className="text-sm text-gray-500">
                  {formatDate(transcription.created_at)}
                </p>
                {transcription.processing_status && (
                  <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                    transcription.processing_status === 'completed_full' ? 'bg-green-100 text-green-800' :
                    transcription.processing_status === 'completed_basic' ? 'bg-yellow-100 text-yellow-800' :
                    transcription.processing_status === 'transcription_only' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {transcription.processing_status === 'completed_full' ? 'Analyse complète' :
                     transcription.processing_status === 'completed_basic' ? 'Analyse basique' :
                     transcription.processing_status === 'transcription_only' ? 'Transcription seule' :
                     transcription.processing_status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {transcription.confidence_score && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(transcription.confidence_score)}`}>
                    {transcription.confidence_score}% confiance
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTranscription(transcription)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h5 className="font-medium mb-2">Transcription:</h5>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {transcription.transcription_text || 'Transcription non disponible'}
                  </p>
                </div>
              </div>

              {transcription.analysis_result && (
                <div>
                  <h5 className="font-medium mb-2">Analyse IA:</h5>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="space-y-2">
                      {transcription.analysis_result.suggestions && (
                        <div>
                          <h6 className="font-medium text-sm text-blue-900">Suggestions d'amélioration:</h6>
                          <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                            {transcription.analysis_result.suggestions.slice(0, 3).map((suggestion, index) => (
                              <li key={index}>
                                {typeof suggestion === 'object' ? 
                                  (suggestion.description || suggestion.titre || JSON.stringify(suggestion)) : 
                                  suggestion
                                }
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {transcription.analysis_result.sentiment && (
                        <div>
                          <span className="font-medium text-sm text-blue-900">Sentiment: </span>
                          <span className="text-sm text-blue-800 capitalize">{transcription.analysis_result.sentiment}</span>
                        </div>
                      )}

                      {transcription.analysis_result.mots_cles && (
                        <div>
                          <span className="font-medium text-sm text-blue-900">Mots-clés: </span>
                          <span className="text-sm text-blue-800">
                            {transcription.analysis_result.mots_cles.slice(0, 5).join(', ')}
                          </span>
                        </div>
                      )}

                      {transcription.analysis_result.keywords && (
                        <div>
                          <span className="font-medium text-sm text-blue-900">Mots-clés: </span>
                          <span className="text-sm text-blue-800">
                            {transcription.analysis_result.keywords.slice(0, 5).join(', ')}
                          </span>
                        </div>
                      )}

                      {transcription.analysis_result.resume && (
                        <div>
                          <span className="font-medium text-sm text-blue-900">Résumé: </span>
                          <span className="text-sm text-blue-800">{transcription.analysis_result.resume}</span>
                        </div>
                      )}

                      {transcription.analysis_result.statistiques && (
                        <div>
                          <h6 className="font-medium text-sm text-blue-900">Statistiques:</h6>
                          <div className="text-sm text-blue-800 grid grid-cols-2 gap-2">
                            {Object.entries(transcription.analysis_result.statistiques).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key.replace(/_/g, ' ')}: </span>
                                {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TranscriptionViewer;

