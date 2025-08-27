import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Progress } from './ui/progress.jsx';
import { Button } from './ui/button.jsx';
import {
  TrendingUp,
  Award,
  Target,
  Calendar,
  BarChart3,
  Star,
  Trophy,
  Zap,
  Users,
  MessageCircle,
  Eye,
  Clock,
  ChevronRight,
  Medal,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const ProgressTracking = ({ userId, userProfile, isVisible = true }) => {
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction pour charger les données de progression directement depuis les tables
  const loadProgressData = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // Récupérer les vidéos récentes avec leur statut
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('id, title, created_at, status, analysis, performance_score, duration')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (videosError) throw videosError;

      // Récupérer les données du mois courant
      const currentDate = new Date();
      const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();

      const { data: monthlyVideos, error: monthlyError } = await supabase
        .from('videos')
        .select('id, performance_score, duration')
        .eq('user_id', userId)
        .eq('status', 'published')
        .gte('created_at', firstDayOfMonth)
        .order('created_at', { ascending: false });

      if (monthlyError) {
        console.warn("Erreur lors du chargement des vidéos mensuelles:", monthlyError);
      }

      // Construction des données formatées pour l'UI
      const formattedData = formatProgressData(
        videos || [],
        monthlyVideos || [],
        userProfile
      );

      setProgressData(formattedData);

    } catch (err) {
      console.error('Erreur lors du chargement des données de progression:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [userId, userProfile]);

  // Formater les données pour l'affichage UI
  const formatProgressData = (videos, monthlyVideos, profile) => {
    // Séparer les vidéos publiées et toutes les vidéos
    const publishedVideos = videos.filter(v => v.status === 'published');
    const allVideos = videos || []; // Inclure toutes les vidéos pour l'affichage récent

    // Créer les compétences en analysant les vidéos publiées
    const skills = extractSkillsFromVideos(publishedVideos);

    // Transformer TOUTES les vidéos récentes pour l'affichage (pas seulement les publiées)
    const recentVideos = allVideos.slice(0, 5).map(video => ({
      id: video.id,
      title: video.title || 'Pitch sans titre',
      date: video.created_at,
      score: video.performance_score || 75,
      status: video.status || 'processing', // Afficher le statut
      improvements: extractImprovementsFromAnalysis(video.analysis)
    }));

    // Calculer la séquence d'activité sur les vidéos publiées
    const streak = calculateActivityStreak(publishedVideos);

    // Générer les succès sur les vidéos publiées
    const achievements = generateAchievements(publishedVideos);

    // Calculer les statistiques mensuelles (vidéos publiées uniquement)
    const monthlyStats = {
      pitchesCount: monthlyVideos.length,
      averageScore: calculateAverageScore(monthlyVideos),
      bestScore: calculateBestScore(monthlyVideos),
      totalWatchTime: calculateTotalDuration(monthlyVideos),
      skillsImproved: Object.keys(skills).length > 0 ? Math.min(Object.keys(skills).length, 3) : 0
    };

    return {
      profile: {
        level: calculateUserLevel(publishedVideos.length, calculateAverageScore(publishedVideos)),
        totalPitches: publishedVideos.length,
        totalVideos: allVideos.length, // Ajouter le total de toutes les vidéos
        joinDate: profile?.created_at || new Date().toISOString(),
        currentStreak: streak.current,
        bestStreak: streak.best
      },
      skills,
      achievements,
      recentPitches: recentVideos,
      monthlyStats
    };
  };

  // Extraire les compétences à partir des analyses de vidéos
  const extractSkillsFromVideos = (videos) => {
    const skills = {};

    // Essayer de récupérer les données d'analyse des vidéos récentes
    const videosWithAnalysis = videos
      .filter(v => v.analysis && typeof v.analysis === 'object')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (videosWithAnalysis.length >= 2) {
      // Utiliser les deux dernières vidéos pour calculer la progression
      const latest = videosWithAnalysis[0].analysis;
      const previous = videosWithAnalysis[1].analysis;

      if (latest.evaluation || latest.performance?.scores) {
        const scores = latest.evaluation || latest.performance?.scores || {};
        const prevScores = previous.evaluation || previous.performance?.scores || {};

        // Mapper les scores aux compétences
        if (scores.clarte || scores.clarté) {
          const current = scores.clarte?.note || scores.clarté?.note || scores.clarte || scores.clarté || 0;
          const prev = prevScores.clarte?.note || prevScores.clarté?.note || prevScores.clarte || prevScores.clarté || 0;
          skills.clarity = { current: Math.round(current), previous: Math.round(prev), trend: current >= prev ? 'up' : 'down' };
        }

        if (scores.structure) {
          const current = scores.structure?.note || scores.structure || 0;
          const prev = prevScores.structure?.note || prevScores.structure || 0;
          skills.structure = { current: Math.round(current), previous: Math.round(prev), trend: current >= prev ? 'up' : 'down' };
        }

        if (scores.expressivite || scores.expressivité) {
          const current = scores.expressivite?.note || scores.expressivité?.note || scores.expressivite || scores.expressivité || 0;
          const prev = prevScores.expressivite?.note || prevScores.expressivité?.note || prevScores.expressivite || prevScores.expressivité || 0;
          skills.confidence = { current: Math.round(current), previous: Math.round(prev), trend: current >= prev ? 'up' : 'down' };
        }

        if (scores.creativite || scores.créativité) {
          const current = scores.creativite?.note || scores.créativité?.note || scores.creativite || scores.créativité || 0;
          const prev = prevScores.creativite?.note || prevScores.créativité?.note || prevScores.creativite || prevScores.créativité || 0;
          skills.creativity = { current: Math.round(current), previous: Math.round(prev), trend: current >= prev ? 'up' : 'down' };
        }

        if (scores.rythme) {
          const current = scores.rythme?.note || scores.rythme || 0;
          const prev = prevScores.rythme?.note || prevScores.rythme || 0;
          skills.timing = { current: Math.round(current), previous: Math.round(prev), trend: current >= prev ? 'up' : 'down' };
        }
      }
    }

    // Si aucune compétence n'a été extraite, utiliser des valeurs par défaut
    if (Object.keys(skills).length === 0) {
      skills.clarity = { current: 75, previous: 70, trend: 'up' };
      skills.structure = { current: 70, previous: 65, trend: 'up' };
      skills.confidence = { current: 80, previous: 75, trend: 'up' };
      skills.creativity = { current: 85, previous: 80, trend: 'up' };
      skills.timing = { current: 82, previous: 78, trend: 'up' };
    }

    return skills;
  };

  // Extraire les suggestions d'amélioration de l'analyse
  const extractImprovementsFromAnalysis = (analysis) => {
    if (!analysis) return ['Général'];

    try {
      const suggestions = [];

      // Essayer d'extraire des suggestions de différents formats d'analyse
      if (analysis.suggestions && Array.isArray(analysis.suggestions)) {
        // Prendre les premières suggestions et les catégoriser
        analysis.suggestions.slice(0, 2).forEach(suggestion => {
          const text = suggestion.toLowerCase();
          if (text.includes('clair') || text.includes('articul')) {
            suggestions.push('Clarté');
          } else if (text.includes('structur') || text.includes('organis')) {
            suggestions.push('Structure');
          } else if (text.includes('confian') || text.includes('express')) {
            suggestions.push('Confiance');
          } else if (text.includes('créa') || text.includes('origin')) {
            suggestions.push('Créativité');
          } else if (text.includes('rythm') || text.includes('temps')) {
            suggestions.push('Timing');
          } else {
            suggestions.push('Expression');
          }
        });
      } else if (analysis.performance && analysis.performance.suggestions) {
        // Format alternatif
        analysis.performance.suggestions.slice(0, 2).forEach(suggestion => {
          suggestions.push(suggestion.category || 'Général');
        });
      }

      // Si aucune suggestion n'a été trouvée, utiliser une valeur par défaut
      return suggestions.length > 0 ? suggestions : ['Général'];

    } catch (err) {
      console.warn('Erreur lors de l\'extraction des améliorations:', err);
      return ['Général'];
    }
  };

  // Calculer la séquence d'activité (en jours consécutifs)
  const calculateActivityStreak = (videos) => {
    if (!videos || videos.length === 0) {
      return { current: 0, best: 0 };
    }

    try {
      // Trier les vidéos par date
      const sortedDates = [...videos]
        .map(v => new Date(v.created_at).toISOString().split('T')[0])
        .sort()
        .reverse(); // Plus récent en premier

      // Éliminer les doublons (même jour)
      const uniqueDates = [...new Set(sortedDates)];

      // Calculer la séquence actuelle
      let currentStreak = 1;
      let bestStreak = 1;
      const today = new Date().toISOString().split('T')[0];

      // Vérifier si la dernière activité était aujourd'hui ou hier
      if (uniqueDates[0] !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (uniqueDates[0] !== yesterdayStr) {
          // La séquence est interrompue
          return { current: 0, best: bestStreak };
        }
      }

      // Calculer la séquence actuelle et la meilleure
      for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i]);
        const prevDate = new Date(uniqueDates[i - 1]);

        // Vérifier si les dates sont consécutives
        const diffDays = Math.round((prevDate - currentDate) / (24 * 60 * 60 * 1000));

        if (diffDays === 1) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }

      return { current: currentStreak, best: bestStreak };
    } catch (err) {
      console.warn('Erreur lors du calcul de la séquence d\'activité:', err);
      return { current: 0, best: 0 };
    }
  };

  // Générer les succès en fonction des vidéos
  const generateAchievements = (videos) => {
    const achievements = [];
    const hasVideos = videos.length > 0;

    // Premier pitch
    achievements.push({
      id: 'first_pitch',
      title: 'Premier Pitch',
      description: 'Tu as enregistré ton premier pitch !',
      icon: Star,
      earned: hasVideos,
      earnedDate: hasVideos ? videos[0].created_at : null,
      rarity: 'common'
    });

    // Maître Créatif (score > 85)
    const creativityThreshold = 85;
    const hasHighCreativity = hasVideos && videos.some(v => {
      if (!v.analysis) return false;
      const analysis = v.analysis;
      return (analysis.evaluation?.creativite > creativityThreshold) ||
             (analysis.performance?.scores?.creativite?.note > creativityThreshold) ||
             (v.performance_score > creativityThreshold);
    });

    achievements.push({
      id: 'creative_master',
      title: 'Maître Créatif',
      description: 'Score de créativité supérieur à 85',
      icon: Zap,
      earned: hasHighCreativity,
      earnedDate: hasHighCreativity ? getFirstVideoDate(videos, v => {
        if (!v.analysis) return false;
        const analysis = v.analysis;
        return (analysis.evaluation?.creativite > creativityThreshold) ||
               (analysis.performance?.scores?.creativite?.note > creativityThreshold) ||
               (v.performance_score > creativityThreshold);
      }) : null,
      rarity: 'rare',
      progress: hasVideos ? Math.min(getBestScore(videos), creativityThreshold) : 0,
      total: creativityThreshold
    });

    // Performeur Régulier
    const consistentThreshold = 5;
    const consistentCount = Math.min(videos.length, consistentThreshold);

    achievements.push({
      id: 'consistent_performer',
      title: 'Performeur Régulier',
      description: `${consistentThreshold} pitches réalisés`,
      icon: Target,
      earned: videos.length >= consistentThreshold,
      earnedDate: videos.length >= consistentThreshold ?
        videos[videos.length - consistentThreshold].created_at : null,
      rarity: 'epic',
      progress: consistentCount,
      total: consistentThreshold
    });

    // Maître du Pitch (score global de 95)
    const masterThreshold = 95;
    const hasExcellentScore = hasVideos && videos.some(v =>
      (v.performance_score && v.performance_score >= masterThreshold) ||
      (v.analysis && v.analysis.overall_score >= masterThreshold)
    );

    achievements.push({
      id: 'pitch_master',
      title: 'Maître du Pitch',
      description: 'Atteins un score global de 95',
      icon: Trophy,
      earned: hasExcellentScore,
      earnedDate: hasExcellentScore ? getFirstVideoDate(videos, v =>
        (v.performance_score && v.performance_score >= masterThreshold) ||
        (v.analysis && v.analysis.overall_score >= masterThreshold)
      ) : null,
      progress: hasVideos ? getBestScore(videos) : 0,
      total: masterThreshold,
      rarity: 'legendary'
    });

    return achievements;
  };

  // Utilitaires pour les calculs de statistiques
  const calculateUserLevel = (pitchCount, averageScore) => {
    if (pitchCount === 0) return 'Débutant';
    if (pitchCount < 3) return 'Orateur Novice';
    if (pitchCount < 10) {
      if (averageScore >= 80) return 'Orateur Prometteur';
      return 'Orateur Amateur';
    }
    if (averageScore >= 85) return 'Orateur Expert';
    if (averageScore >= 75) return 'Orateur Confirmé';
    return 'Orateur Régulier';
  };

  const calculateAverageScore = (videos) => {
    if (!videos || videos.length === 0) return 0;

    const scores = videos
      .map(v => v.performance_score || (v.analysis ? v.analysis.overall_score : 0))
      .filter(score => score > 0);

    if (scores.length === 0) return 0;

    const sum = scores.reduce((total, score) => total + score, 0);
    return Math.round(sum / scores.length);
  };

  const calculateBestScore = (videos) => {
    if (!videos || videos.length === 0) return 0;

    return Math.max(...videos.map(v =>
      v.performance_score || (v.analysis ? v.analysis.overall_score : 0) || 0
    ));
  };

  const calculateTotalDuration = (videos) => {
    if (!videos || videos.length === 0) return 0;
    return videos.reduce((total, video) => total + (video.duration || 0), 0);
  };

  const getBestScore = (videos) => {
    return calculateBestScore(videos);
  };

  const getFirstVideoDate = (videos, predicate) => {
    const video = videos.find(predicate);
    return video ? video.created_at : null;
  };

  // Charger les données lorsque le composant devient visible
  useEffect(() => {
    if (!isVisible || !userId) return;
    loadProgressData();
  }, [isVisible, userId, loadProgressData]);

  // Fonctions d'affichage
  const getSkillIcon = (skillName) => {
    const icons = {
      clarity: MessageCircle,
      structure: BarChart3,
      confidence: Eye,
      creativity: Star,
      timing: Clock,
      persuasion: Target
    };
    return icons[skillName] || AlertTriangle;
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return 'bg-gray-300';
      case 'rare': return 'bg-blue-300';
      case 'epic': return 'bg-purple-300';
      case 'legendary': return 'bg-yellow-300';
      default: return 'bg-gray-300';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Chargement des données de progression...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Erreur: {error}</div>;
  }

  if (!progressData) {
    return <div className="text-center py-8">Aucune donnée de progression disponible.</div>;
  }

  return (
    <div className={`progress-tracking-dashboard ${isVisible ? '' : 'hidden'}`}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profil Utilisateur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Niveau</h3>
              <p className="text-lg font-bold">{progressData.profile.level}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Pitches publiés</h3>
              <p className="text-lg font-bold">{progressData.profile.totalPitches}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Total vidéos</h3>
              <p className="text-lg font-bold">{progressData.profile.totalVideos}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Séquence actuelle</h3>
              <p className="text-lg font-bold">{progressData.profile.currentStreak} jours</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Vue d'ensemble de la progression</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {progressData.achievements.map((achievement) => {
              const IconComponent = achievement.icon;
              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border-2 ${
                    achievement.earned
                      ? getRarityColor(achievement.rarity)
                      : 'bg-gray-200'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <IconComponent className="w-6 h-6 mr-2" />
                    <h3 className="font-semibold text-lg">{achievement.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                  {achievement.progress !== undefined && (
                    <div className="mt-2">
                      <Progress value={(achievement.progress / achievement.total) * 100} className="w-full" />
                      <p className="text-xs text-gray-500 mt-1">{achievement.progress} / {achievement.total}</p>
                    </div>
                  )}
                  {achievement.earned && achievement.earnedDate && (
                    <Badge variant="secondary" className="mt-2">Obtenu le: {new Date(achievement.earnedDate).toLocaleDateString()}</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Compétences clés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(progressData.skills).map(([key, skill]) => {
              const SkillIcon = getSkillIcon(key);
              return (
                <div key={key} className="p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <SkillIcon className="w-5 h-5 mr-2" />
                    <h3 className="font-semibold text-md capitalize">{key}</h3>
                  </div>
                  <p className="text-sm text-gray-600">Score actuel: {skill.current}</p>
                  <p className="text-sm text-gray-600">Score précédent: {skill.previous}</p>
                  <Badge className={`mt-2 ${skill.trend === 'up' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {skill.trend === 'up' ? 'En progression' : 'En baisse'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Statistiques Mensuelles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Pitches ce mois-ci</h3>
              <p className="text-2xl font-bold">{progressData.monthlyStats.pitchesCount}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Score moyen</h3>
              <p className="text-2xl font-bold">{progressData.monthlyStats.averageScore}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Meilleur score</h3>
              <p className="text-2xl font-bold">{progressData.monthlyStats.bestScore}</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Temps de visionnage total</h3>
              <p className="text-2xl font-bold">{Math.round(progressData.monthlyStats.totalWatchTime / 60)} min</p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-md mb-1">Compétences améliorées</h3>
              <p className="text-2xl font-bold">{progressData.monthlyStats.skillsImproved}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pitches Récents</CardTitle>
        </CardHeader>
        <CardContent>
          {progressData.recentPitches.length > 0 ? (
            <ul className="space-y-4">
              {progressData.recentPitches.map(pitch => (
                <li key={pitch.id} className="p-4 border rounded-lg flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{pitch.title}</h4>
                      <Badge 
                        className={`text-xs ${
                          pitch.status === 'published' ? 'bg-green-100 text-green-800' :
                          pitch.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          pitch.status === 'uploaded' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {pitch.status === 'published' ? 'Publié' :
                         pitch.status === 'processing' ? 'En traitement' :
                         pitch.status === 'uploaded' ? 'Uploadé' :
                         pitch.status || 'En cours'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{new Date(pitch.date).toLocaleDateString()}</p>
                    <p className="text-sm text-gray-600">Score: {pitch.score}</p>
                    <p className="text-sm text-gray-600">Améliorations: {pitch.improvements.join(', ')}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Voir le pitch <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500">Aucun pitch récent à afficher.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProgressTracking;
