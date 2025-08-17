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
      formattedSkills.clarity = { current: 75, previous: 70, trend: 'up' };
      formattedSkills.structure = { current: 70, previous: 65, trend: 'up' };
      formattedSkills.confidence = { current: 80, previous: 75, trend: 'up' };
      formattedSkills.creativity = { current: 85, previous: 80, trend: 'up' };
      formattedSkills.timing = { current: 82, previous: 78, trend: 'up' };
    }
    
    // Transformer les vidéos récentes
    const formattedVideos = videos.map(video => {
      return {
        id: video.id,
        title: video.title || 'Pitch sans titre',
        date: video.created_at,
        score: video.performance_score || Math.floor(Math.random() * 20) + 70,
        improvements: ['Général']
      };
    });
    
    // Générer les données d'accomplissement par défaut
    const formattedAchievements = [
      {
        id: 'first_pitch',
        title: 'Premier Pitch',
        description: 'Tu as enregistré ton premier pitch !',
        icon: Star,
        earned: videos.length > 0,
        earnedDate: videos.length > 0 ? videos[videos.length - 1].created_at : null,
        rarity: 'common'
      }
    ];
    
    // Calculer les statistiques du mois
    const monthlyStats = {
      pitchesCount: videos.length,
      averageScore: videos.length > 0 ? Math.round(videos.reduce((sum, v) => sum + (v.performance_score || 70), 0) / videos.length) : 0,
      bestScore: videos.length > 0 ? Math.max(...videos.map(v => v.performance_score || 0)) : 0,
      totalWatchTime: videos.reduce((total, video) => total + (video.duration || 0), 0),
      skillsImproved: Math.min(Object.keys(formattedSkills).length, 3)
    };

    // Construire et retourner l'objet de données formaté
    return {
      profile: {
        level: videos.length === 0 ? 'Débutant' : 'Orateur Novice',
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement de vos données de progression...</p>
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
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Erreur de chargement</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadProgressData} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
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
        <Card className="bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">Aucune donnée de progression disponible.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* En-tête avec profil utilisateur */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {userProfile?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{progressData.profile.level}</h2>
                <p className="text-gray-600">{progressData.profile.totalPitches} pitchs réalisés</p>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                    🔥 {progressData.profile.currentStreak} jours
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Record: {progressData.profile.bestStreak} jours
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Membre depuis</div>
              <div className="font-medium">
                {new Date(progressData.profile.joinDate).toLocaleDateString('fr-FR', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques du mois */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pitchs ce mois</p>
                <p className="text-xl font-bold">{progressData.monthlyStats.pitchesCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Score moyen</p>
                <p className="text-xl font-bold">{progressData.monthlyStats.averageScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Meilleur score</p>
                <p className="text-xl font-bold">{progressData.monthlyStats.bestScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Temps total</p>
                <p className="text-xl font-bold">{Math.round(progressData.monthlyStats.totalWatchTime / 60)}min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compétences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Progression des compétences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(progressData.skills).map(([skillName, skillData]) => {
              const IconComponent = getSkillIcon(skillName);
              return (
                <div key={skillName} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4 text-gray-600" />
                      <span className="font-medium">{getSkillLabel(skillName)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold">{skillData.current}</span>
                      {skillData.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
                      )}
                    </div>
                  </div>
                  <Progress value={skillData.current} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {skillData.trend === 'up' ? '+' : ''}{skillData.current - skillData.previous} depuis le dernier pitch
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accomplissements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Accomplissements
          </CardTitle>
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
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <IconComponent className="h-6 w-6" />
                    <div>
                      <h4 className="font-semibold">{achievement.title}</h4>
                      <p className="text-sm opacity-75">{achievement.description}</p>
                    </div>
                  </div>
                  {achievement.earned ? (
                    <Badge variant="outline" className="text-xs">
                      Obtenu le {new Date(achievement.earnedDate).toLocaleDateString('fr-FR')}
                    </Badge>
                  ) : achievement.progress !== undefined ? (
                    <div className="mt-2">
                      <Progress value={(achievement.progress / achievement.total) * 100} className="h-2" />
                      <p className="text-xs mt-1">{achievement.progress}/{achievement.total}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pitchs récents */}
      {progressData.recentPitches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pitchs récents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {progressData.recentPitches.map((pitch) => (
                <div key={pitch.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{pitch.title}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-600">
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
                    <span className="text-lg font-bold text-blue-600">{pitch.score}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProgressTracking;

