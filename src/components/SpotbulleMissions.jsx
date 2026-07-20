import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Progress } from './ui/progress.jsx';
import { Button } from './ui/button.jsx';
import {
  Sparkles,
  Target,
  Shield,
  Star,
  ChevronRight,
  Loader2,
  Zap,
  Compass,
  Mountain,
  Droplets,
  Wind,
  Award,
} from 'lucide-react';

// Icônes par territoire
const TERRITORY_ICONS = {
  Calyxis: Mountain,
  Cattleya: Wind,
  Sylvara: Compass,
  Neptunus: Droplets,
};

const TERRITORY_COLORS = {
  Calyxis: 'from-red-500 to-orange-500',
  Cattleya: 'from-blue-500 to-cyan-500',
  Sylvara: 'from-green-500 to-emerald-500',
  Neptunus: 'from-indigo-500 to-purple-500',
};

const SpotbulleMissions = ({ userId, userProfile }) => {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentTerritory, setCurrentTerritory] = useState('Calyxis');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  // Charger les missions existantes de l'utilisateur
  const loadMissions = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('user_missions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      // Récupérer les noms des compétences
      const skillIds = new Set();
      (data || []).forEach((m) => {
        if (m.skill_a) skillIds.add(m.skill_a);
        if (m.skill_b) skillIds.add(m.skill_b);
      });

      if (skillIds.size > 0) {
        const { data: skills } = await supabase
          .from('skills')
          .select('id, name')
          .in('id', [...skillIds]);

        const skillNameMap = new Map((skills || []).map((s) => [s.id, s.name]));

        setMissions(
          (data || []).map((m) => ({
            ...m,
            skill_a_name: m.skill_a ? skillNameMap.get(m.skill_a) || 'Inconnue' : null,
            skill_b_name: m.skill_b ? skillNameMap.get(m.skill_b) || 'Inconnue' : null,
          }))
        );
      } else {
        setMissions(data || []);
      }
    } catch (err) {
      console.error('Erreur chargement missions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Générer de nouvelles missions via l'Edge Function
  const generateMissions = async () => {
    setGenerating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'spotbulle-generate-missions',
        {
          body: {
            user_id: userId,
            territory: currentTerritory,
            params: {
              N: 5,
              P: 2,
              H: 3,
              S_MIN: 6.0,
              R_MAX: 3,
            },
          },
        }
      );

      if (invokeError) throw invokeError;
      if (data.error) throw new Error(data.error);

      setMissions(data.missions || []);
      setStats({
        acquired_count: data.acquired_count,
        total_combinations: data.total_combinations_evaluated,
        objective_score: data.objective_score,
      });
    } catch (err) {
      console.error('Erreur génération missions:', err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

  const TerritoryIcon = TERRITORY_ICONS[currentTerritory] || Compass;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          <h2 className="text-2xl font-bold text-white">Missions Lumia</h2>
          <Sparkles className="w-6 h-6 text-yellow-400" />
        </div>
        <p className="text-gray-400 text-sm">
          Territoire de {currentTerritory} — Moteur d'optimisation Spotbulle
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats.acquired_count}</p>
                <p className="text-xs text-gray-400">Compétences acquises</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{stats.total_combinations}</p>
                <p className="text-xs text-gray-400">Combinaisons évaluées</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{stats.objective_score?.toFixed(1)}</p>
                <p className="text-xs text-gray-400">Score objectif</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Territoire selector */}
      <div className="flex gap-2 justify-center flex-wrap">
        {Object.entries(TERRITORY_ICONS).map(([name, Icon]) => (
          <Button
            key={name}
            variant={currentTerritory === name ? 'default' : 'outline'}
            className={`flex items-center gap-2 ${
              currentTerritory === name
                ? `bg-gradient-to-r ${TERRITORY_COLORS[name]}`
                : 'border-gray-600 text-gray-300'
            }`}
            onClick={() => setCurrentTerritory(name)}
          >
            <Icon className="w-4 h-4" />
            {name}
          </Button>
        ))}
      </div>

      {/* Generate button */}
      <div className="flex justify-center">
        <Button
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
          onClick={generateMissions}
          disabled={generating || !userId}
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Générer mes missions
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="p-4">
            <p className="text-red-400 text-sm">Erreur : {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Missions list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : missions.length === 0 ? (
        <Card className="bg-gray-800/30 border-gray-700">
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              Aucune mission pour le moment.
              <br />
              Cliquez sur "Générer mes missions" pour démarrer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {missions.map((mission, index) => {
            const MissionIcon = mission.type === 'hybrid' ? Star : Shield;
            return (
              <Card
                key={index}
                className="bg-gray-800/50 border-gray-700 hover:border-gray-500 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MissionIcon
                        className={`w-5 h-5 ${
                          mission.type === 'hybrid' ? 'text-yellow-400' : 'text-blue-400'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          {mission.skill_a_name && (
                            <Badge variant="secondary" className="bg-gray-700 text-gray-200">
                              {mission.skill_a_name}
                            </Badge>
                          )}
                          {mission.type === 'hybrid' && mission.skill_b_name && (
                            <>
                              <span className="text-yellow-400 text-xs">+</span>
                              <Badge
                                variant="secondary"
                                className="bg-yellow-900/30 text-yellow-300"
                              >
                                {mission.skill_b_name}
                              </Badge>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {mission.type === 'hybrid' ? 'Hybride' : 'Pure'} — Score:{' '}
                          {mission.total_score?.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        mission.status === 'completed'
                          ? 'success'
                          : mission.status === 'in_progress'
                          ? 'warning'
                          : 'secondary'
                      }
                      className={
                        mission.status === 'completed'
                          ? 'bg-green-900/30 text-green-300'
                          : mission.status === 'in_progress'
                          ? 'bg-orange-900/30 text-orange-300'
                          : 'bg-gray-700 text-gray-300'
                      }
                    >
                      {mission.status === 'completed'
                        ? 'Complété'
                        : mission.status === 'in_progress'
                        ? 'En cours'
                        : 'En attente'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Progression */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            Progression
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Compétences pures</span>
                <span>{missions.filter((m) => m.type === 'pure').length} / 2</span>
              </div>
              <Progress
                value={(missions.filter((m) => m.type === 'pure').length / 2) * 100}
                className="bg-gray-700"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Combinaisons hybrides</span>
                <span>{missions.filter((m) => m.type === 'hybrid').length} / 3</span>
              </div>
              <Progress
                value={(missions.filter((m) => m.type === 'hybrid').length / 3) * 100}
                className="bg-gray-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpotbulleMissions;
