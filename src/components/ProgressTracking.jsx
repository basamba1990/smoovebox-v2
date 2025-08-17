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
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction pour charger les données de progression depuis Supabase
  const loadProgressData = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Récupérer les statistiques de l'utilisateur
      const { data: userStats, error: statsError } = await supabase
        .rpc('get_user_progress_stats', { user_id_param: userId });
      
      if (statsError) throw statsError;
      
      // Récupérer les vidéos récentes
      const { data: recentVideos, error: videosError } = await supabase
        .from('videos')
        .select('id, title, created_at, status, analysis, performance_score, duration')
        .eq('user_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (videosError) throw videosError;
      
      // Récupérer les succès
      const { data: userAchievements, error: achievementsError } = await supabase
        .from('user_achievements')
        .select('*, achievements(*)')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false });
      
      if (achievementsError) {
        // Si la table n'existe pas, on ignore cette erreur
        console.warn('Erreur lors de la récupération des succès:', achievementsError);
      }
      
      // Récupérer les compétences
      const { data: skillsData, error: skillsError } = await supabase
        .from('user_skills')
        .select('skill_name, current_score, previous_score')
        .eq('user_id', userId);
      
      if (skillsError) {
        // Si la table n'existe pas, on ignore cette erreur
        console.warn('Erreur lors de la récupération des compétences:', skillsError);
      }
      
      // Récupérer la séquence d'activité
      const { data: streakData, error: streakError } = await supabase
        .rpc('get_user_activity_streak', { user_id_param: userId });
      
      if (streakError) {
        console.warn('Erreur lors de la récupération de la séquence d\'activité:', streakError);
      }
      
      // Construction des données formatées pour l'UI
      const formattedData = formatProgressData(
        userStats || {}, 
        recentVideos || [], 
        userAchievements || [],
        skillsData || [],
        streakData || { current_streak: 0, best_streak: 0 }
      );
      
      setProgressData(formattedData);
      
    } catch (err) {
      console.error('Erreur lors du chargement des données de progression:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Formater les données pour l'affichage UI
  const formatProgressData = (
    stats, 
    videos, 
    achievements, 
    skills,
    streakData
  ) => {
    // Transformer les compétences en objet avec des tendances
    const formattedSkills = {};
    skills.forEach(skill => {
      formattedSkills[skill.skill_name] = {
        current: skill.current_score || 0,
        previous: skill.previous_score || 0,
        trend: (skill.current_score || 0) >= (skill.previous_score || 0) ? 'up' : 'down'
      };
    });
    
    // Si aucune compétence n'existe, créer des données par défaut
    if (Object.keys(formattedSkills).length === 0) {
      // Extraire les scores des analyses de vidéos si disponibles
      const videoAnalysisData = videos
        .filter(v => v.analysis && typeof v.analysis === 'object')
        .map(v => v.analysis);
      
      if (videoAnalysisData.length > 0) {
        // Essayer d'extraire les scores depuis les analyses
        const latestAnalysis = videoAnalysisData[0];
        
        if (latestAnalysis.performance && latestAnalysis.performance.scores) {
          const scores = latestAnalysis.performance.scores;
          
          // Conversion des scores de l'analyse en compétences
          if (scores.clarte) formattedSkills.clarity = { current: scores.clarte.note, previous: scores.clarte.note - 5, trend: 'up' };
          if (scores.structure) formattedSkills.structure = { current: scores.structure.note, previous: scores.structure.note - 3, trend: 'up' };
          if (scores.expressivite) formattedSkills.confidence = { current: scores.expressivite.note, previous: scores.expressivite.note - 4, trend: 'up' };
          if (scores.persuasion) formattedSkills.persuasion = { current: scores.persuasion.note, previous: scores.persuasion.note - 2, trend: 'up' };
          if (scores.rythme) formattedSkills.timing = { current: scores.rythme.note, previous: scores.rythme.note - 3, trend: 'up' };
        }
      }
      
      // Si toujours pas de compétences, utiliser des valeurs par défaut
      if (Object.keys(formattedSkills).length === 0) {
        formattedSkills.clarity = { current: 75, previous: 70, trend: 'up' };
        formattedSkills.structure = { current: 70, previous: 65, trend: 'up' };
        formattedSkills.confidence = { current: 80, previous: 75, trend: 'up' };
        formattedSkills.creativity = { current: 85, previous: 80, trend: 'up' };
        formattedSkills.timing = { current: 82, previous: 78, trend: 'up' };
      }
    }
    
    // Transformer les vidéos récentes
    const formattedVideos = videos.map(video => {
      const improvements = [];
      let score = video.performance_score || 0;
      
      // Extraire les suggestions d'amélioration si disponibles
      if (video.analysis && video.analysis.performance && video.analysis.performance.suggestions) {
        // Extraire les catégories depuis les suggestions
        const suggestions = video.analysis.performance.suggestions;
        suggestions.forEach(suggestion => {
          const suggestion_lower = suggestion.toLowerCase();
          if (suggestion_lower.includes('clar') || suggestion_lower.includes('articul')) improvements.push('Clarté');
          else if (suggestion_lower.includes('structur') || suggestion_lower.includes('organis')) improvements.push('Structure');
          else if (suggestion_lower.includes('conf') || suggestion_lower.includes('express')) improvements.push('Confiance');
          else if (suggestion_lower.includes('rythm') || suggestion_lower.includes('temps')) improvements.push('Timing');
          else improvements.push('Expression');
        });
      }
      
      // Si pas de suggestions, utiliser des valeurs par défaut
      if (improvements.length === 0) {
        improvements.push('Général');
      }
      
      // Limiter à 2 suggestions maximum
      const limitedImprovements = improvements.slice(0, 2);
      
      return {
        id: video.id,
        title: video.title || 'Pitch sans titre',
        date: video.created_at,
        score: score || Math.floor(Math.random() * 20) + 70, // Fallback pour score
        improvements: limitedImprovements
      };
    });
    
    // Générer les données d'accomplissement
    let formattedAchievements = [];
    
    // Si des accomplissements existent dans la base de données
    if (achievements.length > 0) {
      formattedAchievements = achievements.map(achievement => {
        return {
          id: achievement.achievements.id || achievement.achievement_id,
          title: achievement.achievements.title || 'Succès',
          description: achievement.achievements.description || '',
          icon: getAchievementIcon(achievement.achievements.id || achievement.achievement_id),
          earned: achievement.is_earned,
          earnedDate: achievement.earned_at,
          progress: achievement.progress,
          total: achievement.achievements.target_value || 100,
          rarity: achievement.achievements.rarity || 'common'
        };
      });
    } 
    // Sinon, générer des accomplissements par défaut basés sur les vidéos
    else {
      formattedAchievements = generateDefaultAchievements(videos);
    }
    
    // Calculer les statistiques du mois
    const monthlyStats = {
      pitchesCount: stats.monthly_pitches_count || videos.length,
      averageScore: stats.monthly_average_score || calculateAverageScore(videos),
      bestScore: stats.monthly_best_score || calculateBestScore(videos),
      totalWatchTime: stats.monthly_watch_time || calculateTotalDuration(videos),
      skillsImproved: stats.monthly_skills_improved || Math.min(Object.keys(formattedSkills).length, 3)
    };

    // Construire et retourner l'objet de données formaté
    return {
      profile: {
        level: calculateUserLevel(videos.length, calculateAverageScore(videos)),
        totalPitches: videos.length,
        joinDate: userProfile?.created_at || new Date().toISOString(),
        currentStreak: streakData.current_streak || 0,
        bestStreak: streakData.best_streak || 0
      },
      skills: formattedSkills,
      achievements: formattedAchievements,
      recentPitches: formattedVideos,
      monthlyStats
    };
  };

  // Charger les données lorsque le composant devient visible
  useEffect(() => {
    if (!isVisible || !userId) return;
    loadProgressData();
  }, [isVisible, userId, loadProgressData]);

  // Fonctions utilitaires
  const getAchievementIcon = (achievementId) => {
    const iconMap = {
      'first_pitch': Star,
      'creative_master': Zap,
      'consistent_performer': Target,
      'team_player': Users,
      'pitch_master': Trophy
    };
    
    return iconMap[achievementId] || Award;
  };
  
  const generateDefaultAchievements = (videos) => {
    const achievements = [];
    const hasVideos = videos.length > 0;
    const averageScore = calculateAverageScore(videos);
    
    // Premier pitch
    achievements.push({
      id: 'first_pitch',
      title: 'Premier Pitch',
      description: 'Tu as enregistré ton premier pitch !',
      icon: Star,
      earned: hasVideos,
      earnedDate: hasVideos ? videos[videos.length - 1].created_at : null,
      rarity: 'common'
    });
    
    // Maître Créatif (score > 85)
    const hasHighCreativity = hasVideos && videos.some(v => 
      (v.analysis && v.analysis.performance && v.analysis.performance.scores && 
       v.analysis.performance.scores.creativite && v.analysis.performance.scores.creativite.note > 85) || 
      (v.performance_score > 85)
    );
    
    achievements.push({
      id: 'creative_master',
      title: 'Maître Créatif',
      description: 'Score de créativité supérieur à 85',
      icon: Zap,
      earned: hasHighCreativity,
      earnedDate: hasHighCreativity ? findFirstVideoWithHighScore(videos, 85).created_at : null,
      rarity: 'rare',
      progress: hasVideos ? Math.min(averageScore, 85) : 0,
      total: 85
    });
    
    // Performeur Régulier (5 pitches consécutifs avec score > 80)
    const consecutiveHighScores = countConsecutiveHighScores(videos, 80);
    achievements.push({
      id: 'consistent_performer',
      title: 'Performeur Régulier',
      description: '5 pitches consécutifs avec un score > 80',
      icon: Target,
      earned: consecutiveHighScores >= 5,
      earnedDate: consecutiveHighScores >= 5 ? videos[0].created_at : null,
      rarity: 'epic',
      progress: Math.min(consecutiveHighScores, 5),
      total: 5
    });
    
    // Esprit d'Équipe (pitches collectifs)
    achievements.push({
      id: 'team_player',
      title: 'Esprit d\'Équipe',
      description: 'Participe à 3 pitches collectifs',
      icon: Users,
      earned: false,
      progress: hasVideos ? Math.min(countCollectivePitches(videos), 3) : 0,
      total: 3,
      rarity: 'rare'
    });
    
    // Maître du Pitch (score global de 95)
    const hasExcellentScore = hasVideos && videos.some(v => 
      (v.performance_score && v.performance_score >= 95)
    );
    
    achievements.push({
      id: 'pitch_master',
      title: 'Maître du Pitch',
      description: 'Atteins un score global de 95',
      icon: Trophy,
      earned: hasExcellentScore,
      earnedDate: hasExcellentScore ? findFirstVideoWithHighScore(videos, 95).created_at : null,
      progress: hasVideos ? Math.min(findHighestScore(videos), 95) : 0,
      total: 95,
      rarity: 'legendary'
    });
    
    return achievements;
  };
  
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
    const validVideos = videos.filter(v => v.performance_score);
    if (validVideos.length === 0) return 0;
    
    const sum = validVideos.reduce((total, video) => total + video.performance_score, 0);
    return Math.round(sum / validVideos.length);
  };
  
  const calculateBestScore = (videos) => {
    if (!videos || videos.length === 0) return 0;
    return Math.max(...videos.map(v => v.performance_score || 0));
  };
  
  const calculateTotalDuration = (videos) => {
    if (!videos || videos.length === 0) return 0;
    return videos.reduce((total, video) => total + (video.duration || 0), 0);
  };
  
  const findFirstVideoWithHighScore = (videos, threshold) => {
    return videos.find(v => (v.performance_score || 0) >= threshold) || {};
  };
  
  const findHighestScore = (videos) => {
    return Math.max(...videos.map(v => v.performance_score || 0));
  };
  
  const countConsecutiveHighScores = (videos, threshold) => {
    if (!videos || videos.length === 0) return 0;
    let count = 0;
    
    // Les vidéos sont déjà triées par date décroissante
    for (const video of videos) {
      if ((video.performance_score || 0) > threshold) {
        count++;
      } else {
        break; // Interrompre lorsqu'on trouve une vidéo en-dessous du seuil
      }
    }
    
    return count;
  };
  
  const countCollectivePitches = (videos) => {
    if (!videos || videos.length === 0) return 0;
    // Détecter les pitches collectifs (soit par un tag, un meta-data ou une propriété)
    return videos.filter(v => 
      (v.tags && v.tags.includes('collectif')) ||
      (v.metadata && v.metadata.is_collective) ||
      (v.title && v.title.toLowerCase().includes('équipe')) ||
      (v.title && v.title.toLowerCase().includes('collectif'))
    ).length;
  };

  const getSkillIcon = (skillName) => {
    const icons = {
      clarity: MessageCircle,
      structure: BarChart3,
      confidence: Eye,
      creativity: Star,
      timing: Clock,
      persuasion: Target
    };
    return icons[skillName] || Target;
  };

  const getSkillLabel = (skillName) => {
    const labels = {
      clarity: 'Clarté',
      structure: 'Structure',
      confidence: 'Confiance',
      creativity: 'Créativité',
      timing: 'Timing',
      persuasion: 'Persuasion'
    };
    return labels[skillName] || skillName;
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'text-gray-600 bg-gray-100 border-gray-200',
      rare: 'text-blue-600 bg-blue-100 border-blue-200',
      epic: 'text-purple-600 bg-purple-100 border-purple-200',
      legendary: 'text-yellow-600 bg-yellow-100 border-yellow-200'
    };
    return colors[rarity] || colors.common;
  };

  if (!isVisible) return null;
  
  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-blue-600">Chargement de tes statistiques...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-red-800 mb-2">
              Erreur de chargement
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button 
              onClick={loadProgressData} 
              className="bg-red-600 hover:bg-red-700"
            >
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-8 text-center">
            <h3 className="text-xl font-bold text-blue-800 mb-2">
              Pas encore de données disponibles
            </h3>
            <p className="text-blue-600 mb-4">
              Enregistre ton premier pitch pour voir tes statistiques !
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* En-tête du profil */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-2xl text-blue-800">
                  {userProfile?.full_name || userProfile?.username || 'Ton Profil'}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {progressData.profile.level}
                  </Badge>
                  <span className="text-blue-600 text-sm">
                    {progressData.profile.totalPitches} pitches réalisés
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {progressData.profile.currentStreak}
              </div>
              <p className="text-sm text-blue-600">jours consécutifs</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistiques du mois */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Statistiques du mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {progressData.monthlyStats.pitchesCount}
              </div>
              <p className="text-sm text-gray-600">Pitches</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {progressData.monthlyStats.averageScore}
              </div>
              <p className="text-sm text-gray-600">Score moyen</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {progressData.monthlyStats.bestScore}
              </div>
              <p className="text-sm text-gray-600">Meilleur score</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.floor(progressData.monthlyStats.totalWatchTime / 60)}m
              </div>
              <p className="text-sm text-gray-600">Temps total</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {progressData.monthlyStats.skillsImproved}
              </div>
              <p className="text-sm text-gray-600">Compétences améliorées</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Évolution des compétences */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Évolution de tes compétences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(progressData.skills).map(([skillName, skill]) => {
            const SkillIcon = getSkillIcon(skillName);
            const improvement = skill.current - skill.previous;
            
            return (
              <div key={skillName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SkillIcon className="h-4 w-4 text-gray-600" />
                    <span className="font-medium text-gray-800">
                      {getSkillLabel(skillName)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {skill.previous} → {skill.current}
                    </span>
                    <Badge 
                      variant={improvement > 0 ? "default" : "secondary"}
                      className={improvement > 0 ? "bg-green-100 text-green-800" : ""}
                    >
                      {improvement > 0 ? `+${improvement}` : improvement}
                    </Badge>
                  </div>
                </div>
                <Progress value={skill.current} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Réalisations */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
            <Award className="h-5 w-5" />
            Tes réalisations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {progressData.achievements.map((achievement) => {
              const AchievementIcon = achievement.icon;
              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border-2 ${
                    achievement.earned 
                      ? getRarityColor(achievement.rarity)
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      achievement.earned ? 'bg-white' : 'bg-gray-200'
                    }`}>
                      <AchievementIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm mb-1">
                        {achievement.title}
                      </h3>
                      <p className="text-xs mb-2">
                        {achievement.description}
                      </p>
                      {achievement.earned ? (
                        <Badge variant="outline" className="text-xs">
                          Obtenu le {new Date(achievement.earnedDate).toLocaleDateString('fr-FR')}
                        </Badge>
                      ) : achievement.progress !== undefined ? (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Progression</span>
                            <span>{achievement.progress}/{achievement.total}</span>
                          </div>
                          <Progress 
                            value={(achievement.progress / achievement.total) * 100} 
                            className="h-1"
                          />
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          À débloquer
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Historique récent */}
      {progressData.recentPitches.length > 0 && (
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tes derniers pitches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {progressData.recentPitches.map((pitch) => (
                <div
                  key={pitch.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 text-sm mb-1">
                      {pitch.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">
                        {new Date(pitch.date).toLocaleDateString('fr-FR')}
                      </span>
                      <div className="flex gap-1">
                        {pitch.improvements.map((improvement, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {improvement}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
