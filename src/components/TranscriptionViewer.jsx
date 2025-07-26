import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button.jsx';
import { FileText, Play, Download, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

const TranscriptionViewer = () => {
  const { user } = useAuth();
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTranscription, setSelectedTranscription] = useState(null);

  useEffect(() => {
    fetchTranscriptions();
  }, [user]);

  const fetchTranscriptions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let profileId = null;
      
      // D'abord essayer de récupérer le profil de l'utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      if (profileError && profileError.code === 'PGRST116') {
        // Si la table profiles n'existe pas, utiliser directement user_id
        console.warn('Table profiles non trouvée, utilisation de user_id directement');
        
        // Récupérer les transcriptions via les vidéos de l'utilisateur directement
        const { data, error } = await supabase
          .from('transcriptions')
          .select(`
            *,
            videos!inner (
              title,
              file_path,
              created_at,
              user_id
            )
          `)
          .eq('videos.user_id', user.id)
          .order('processed_at', { ascending: false });

        if (error) {
          console.error('Erreur lors du chargement des transcriptions:', error);
          setTranscriptions([]);
        } else {
          setTranscriptions(data || []);
        }
        setLoading(false);
        return;
      } else if (profileError && profileError.code === 'PGRST301') {
        // Si le profil n'existe pas, essayer de le créer
        console.warn('Profil non trouvé, tentative de création...');
        
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
          
        if (createError) {
          console.error('Erreur lors de la création du profil:', createError);
          // Fallback: utiliser user_id directement
          const { data, error } = await supabase
            .from('transcriptions')
            .select(`
              *,
              videos!inner (
                title,
                file_path,
                created_at,
                user_id
              )
            `)
            .eq('videos.user_id', user.id)
            .order('processed_at', { ascending: false });

          if (error) {
            console.error('Erreur lors du chargement des transcriptions:', error);
            setTranscriptions([]);
          } else {
            setTranscriptions(data || []);
          }
          setLoading(false);
          return;
        }
        
        profileId = newProfile.id;
      } else if (profileError) {
        throw profileError;
      } else {
        profileId = profileData.id;
      }
      
      // Récupérer les transcriptions via les vidéos du profil
      const { data, error } = await supabase
        .from('transcriptions')
        .select(`
          *,
          videos!inner (
            title,
            file_path,
            created_at,
            profile_id
          )
        `)
        .eq('videos.profile_id', profileId)
        .order('processed_at', { ascending: false });

      if (error) {
        console.error('Erreur lors du chargement des transcriptions:', error);
        setTranscriptions([]);
      } else {
        setTranscriptions(data || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des transcriptions:', error);
      setTranscriptions([]);
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
Transcription - ${transcription.videos?.title || 'Vidéo'}
Date: ${formatDate(transcription.processed_at)}
Score de confiance: ${transcription.confidence_score || 'N/A'}%

TRANSCRIPTION:
${transcription.full_text}

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

  if (transcriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-lg shadow-sm border text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune transcription disponible</h3>
          <p className="text-gray-600 mb-4">
            Uploadez une vidéo pour voir apparaître ici l'analyse automatique de votre pitch par l'IA
          </p>
          <Button variant="outline">
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
                      {transcription.videos?.title || 'Vidéo sans nom'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {formatDate(transcription.processed_at)}
                    </p>
                    {transcription.videos?.file_path && (
                      <a 
                        href={transcription.videos.file_path} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline text-sm mt-1 block"
                      >
                        Voir la vidéo
                      </a>
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
                    {transcription.full_text || 'Transcription non disponible'}
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
                              <li key={index}>{suggestion.description || suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {transcription.analysis_result.sentiment && (
                        <div>
                          <span className="font-medium text-sm text-blue-900">Sentiment: </span>
                          <span className="text-sm text-blue-800">{transcription.analysis_result.sentiment}</span>
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

