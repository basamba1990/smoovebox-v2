import React, { useState, useEffect } from 'react';
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
  Medal
} from 'lucide-react';

const ProgressTracking = ({ userId, userProfile, isVisible = true }) => {
  const [progressData, setProgressData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  // Simulation des données de progression
  useEffect(() => {
    if (!isVisible) return;

    // Simulation d'un chargement de données
    setTimeout(() => {
      const mockProgressData = {
        profile: {
          level: 'Orateur Confirmé',
          totalPitches: 12,
          joinDate: '2024-01-15',
          currentStreak: 5,
          bestStreak: 8
        },
        skills: {
          clarity: { current: 82, previous: 75, trend: 'up' },
          structure: { current: 78, previous: 72, trend: 'up' },
          confidence: { current: 85, previous: 80, trend: 'up' },
          creativity: { current: 90, previous: 88, trend: 'up' },
          timing: { current: 88, previous: 85, trend: 'up' }
        },
        achievements: [
          {
            id: 'first_pitch',
            title: 'Premier Pitch',
            description: 'Tu as enregistré ton premier pitch !',
            icon: Star,
            earned: true,
            earnedDate: '2024-01-15',
            rarity: 'common'
          },
          {
            id: 'creative_master',
            title: 'Maître Créatif',
            description: 'Score de créativité supérieur à 85',
            icon: Zap,
            earned: true,
            earnedDate: '2024-02-10',
            rarity: 'rare'
          },
          {
            id: 'consistent_performer',
            title: 'Performeur Régulier',
            description: '5 pitches consécutifs avec un score > 80',
            icon: Target,
            earned: true,
            earnedDate: '2024-02-20',
            rarity: 'epic'
          },
          {
            id: 'team_player',
            title: 'Esprit d\'Équipe',
            description: 'Participe à 3 pitches collectifs',
            icon: Users,
            earned: false,
            progress: 2,
            total: 3,
            rarity: 'rare'
          },
          {
            id: 'pitch_master',
            title: 'Maître du Pitch',
            description: 'Atteins un score global de 95',
            icon: Trophy,
            earned: false,
            progress: 88,
            total: 95,
            rarity: 'legendary'
          }
        ],
        recentPitches: [
          {
            id: 1,
            date: '2024-02-25',
            title: 'Mon rêve de jouer en équipe nationale',
            score: 88,
            improvements: ['Confiance', 'Structure']
          },
          {
            id: 2,
            date: '2024-02-20',
            title: 'L\'impact de mon club sur le quartier',
            score: 82,
            improvements: ['Créativité', 'Timing']
          },
          {
            id: 3,
            date: '2024-02-15',
            title: 'Ma passion pour le basketball',
            score: 85,
            improvements: ['Clarté', 'Confiance']
          }
        ],
        monthlyStats: {
          pitchesCount: 4,
          averageScore: 84,
          bestScore: 88,
          totalWatchTime: 320,
          skillsImproved: 3
        }
      };

      setProgressData(mockProgressData);
      setLoading(false);
    }, 1000);
  }, [isVisible, userId]);

  const getSkillIcon = (skillName) => {
    const icons = {
      clarity: MessageCircle,
      structure: BarChart3,
      confidence: Eye,
      creativity: Star,
      timing: Clock
    };
    return icons[skillName] || Target;
  };

  const getSkillLabel = (skillName) => {
    const labels = {
      clarity: 'Clarté',
      structure: 'Structure',
      confidence: 'Confiance',
      creativity: 'Créativité',
      timing: 'Timing'
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

  if (!isVisible || loading) {
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

  if (!progressData) return null;

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
                  {userProfile?.name || 'Ton Profil'}
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
            {progressData.achievements.map((achievement) => (
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
                    <achievement.icon className="h-5 w-5" />
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
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Historique récent */}
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
                  <div className="text-lg font-bold text-blue-600">
                    {pitch.score}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Objectifs suggérés */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-lg text-green-800 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Tes prochains objectifs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Medal className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 text-sm">Score de 90</span>
              </div>
              <p className="text-xs text-green-700">
                Atteins un score global de 90 dans ton prochain pitch
              </p>
              <Progress value={88} className="h-1 mt-2" />
            </div>
            
            <div className="bg-white rounded-lg p-3 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 text-sm">Pitch collectif</span>
              </div>
              <p className="text-xs text-green-700">
                Participe à un pitch d'équipe pour débloquer "Esprit d'Équipe"
              </p>
              <Progress value={67} className="h-1 mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProgressTracking;

