// src/components/VideoAnalysisResults.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { VIDEO_STATUS, isCompletedStatus } from '../constants/videoStatus';

const VideoAnalysisResults = ({ videoId }) => {
  const [analysis, setAnalysis] = useState(null);
  const [videoStatus, setVideoStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId) return;
    
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Récupérer les détails de la vidéo pour vérifier son statut
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('status')
          .eq('id', videoId)
          .single();
          
        if (videoError) {
          throw new Error(`Erreur lors de la récupération des détails de la vidéo: ${videoError.message}`);
        }
        
        setVideoStatus(videoData.status);
        
        if (!isCompletedStatus(videoData.status)) {
          setAnalysis(null);
          setLoading(false);
          return;
        }
        
        // Récupérer l'analyse
        const { data: analysisData, error: analysisError } = await supabase
          .from('analyses')
          .select('*')
          .eq('video_id', videoId)
          .single();
          
        if (analysisError) {
          // Si l'analyse n'existe pas encore mais que le statut est COMPLETED,
          // c'est peut-être que l'analyse est en cours de finalisation
          if (analysisError.code === 'PGRST116') { // Code pour "No rows found"
            console.log('Analyse non trouvée, elle est peut-être en cours de finalisation');
            setAnalysis(null);
          } else {
            throw new Error(`Erreur lors de la récupération de l'analyse: ${analysisError.message}`);
          }
        } else {
          setAnalysis(analysisData);
        }
      } catch (err) {
        console.error('Erreur lors de la récupération de l\'analyse:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalysis();
    
    // Configurer un abonnement pour les mises à jour en temps réel des vidéos
    const videoSubscription = supabase
      .channel(`video_${videoId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'videos',
        filter: `id=eq.${videoId}` 
      }, (payload) => {
        if (payload.new && payload.new.status) {
          setVideoStatus(payload.new.status);
          
          // Si le statut passe à COMPLETED, récupérer l'analyse
          if (isCompletedStatus(payload.new.status)) {
            fetchAnalysis();
          }
        }
      })
      .subscribe();
    
    // Configurer un abonnement pour les mises à jour en temps réel des analyses
    const analysisSubscription = supabase
      .channel(`analysis_${videoId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'analyses',
        filter: `video_id=eq.${videoId}` 
      }, (payload) => {
        if (payload.new) {
          setAnalysis(payload.new);
        }
      })
      .subscribe();
      
    return () => {
      videoSubscription.unsubscribe();
      analysisSubscription.unsubscribe();
    };
  }, [videoId]);

  if (loading) {
    return (
      <div className="analysis-loading">
        <div className="spinner"></div>
        <p>Chargement de l'analyse...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="analysis-error">
        <p>Impossible de charger l'analyse: {error}</p>
      </div>
    );
  }
  
  if (!analysis) {
    if (videoStatus === VIDEO_STATUS.PROCESSING || videoStatus === VIDEO_STATUS.UPLOADED) {
      return (
        <div className="analysis-processing">
          <div className="spinner"></div>
          <p>Votre vidéo est en cours d'analyse. Les résultats seront disponibles prochainement.</p>
        </div>
      );
    } else if (videoStatus === VIDEO_STATUS.ERROR) {
      return (
        <div className="analysis-error">
          <p>Une erreur est survenue lors de l'analyse de votre vidéo.</p>
        </div>
      );
    } else if (videoStatus === VIDEO_STATUS.PENDING) {
      return (
        <div className="analysis-pending">
          <p>Votre vidéo est en attente de traitement.</p>
        </div>
      );
    } else {
      return (
        <div className="analysis-unavailable">
          <p>L'analyse n'est pas encore disponible pour cette vidéo.</p>
        </div>
      );
    }
  }

  return (
    <div className="analysis-results">
      <div className="analysis-header">
        <h3>Résultats de l'analyse</h3>
        <div className="overall-score">
          <span className="score-label">Score global</span>
          <span className="score-value">{analysis.overall_score}/100</span>
        </div>
      </div>
      
      <div className="analysis-sections">
        <div className="analysis-section">
          <h4>Qualité du pitch</h4>
          <p>{analysis.pitch_analysis}</p>
        </div>
        
        <div className="analysis-section">
          <h4>Langage corporel</h4>
          <p>{analysis.body_language_analysis}</p>
        </div>
        
        <div className="analysis-section">
          <h4>Qualité vocale</h4>
          <p>{analysis.voice_analysis}</p>
        </div>
      </div>
      
      <div className="analysis-feedback">
        <div className="strengths">
          <h4>Points forts</h4>
          <ul>
            {analysis.strengths && analysis.strengths.map((strength, index) => (
              <li key={`strength-${index}`}>{strength}</li>
            ))}
          </ul>
        </div>
        
        <div className="areas-to-improve">
          <h4>Points à améliorer</h4>
          <ul>
            {analysis.areas_to_improve && analysis.areas_to_improve.map((area, index) => (
              <li key={`area-${index}`}>{area}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VideoAnalysisResults;

