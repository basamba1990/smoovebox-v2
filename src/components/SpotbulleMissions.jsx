import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Loader2,
  Zap,
  Compass,
  Mountain,
  Droplets,
  Wind,
  Award,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import OdysseyLayout from './OdysseyLayout.jsx';

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

const SpotbulleMissions = ({ userId, userProfile, onSignOut }) => {
  const navigate = useNavigate();
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentTerritory, setCurrentTerritory] = useState('Calyxis');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [generatingFresh, setGeneratingFresh] = useState(false);

  // Charger les missions de l'utilisateur pour le territoire actuel
  const loadMissions = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);

      // FIX: Filtrer par territoire pour éviter de montrer les missions d'autres territoires
      const { data, error: queryError } = await supabase
        .from('user_missions')
        .select('*')
        .eq('user_id', userId)
        .eq('territory', currentTerritory)
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

        // FIX: Mapper mission_type → type et dédupliquer par combinaison (skill_a, skill_b, mission_type)
        const seen = new Set();
        const deduped = (data || []).filter((m) => {
          const key = `${m.skill_a || ''}-${m.skill_b || ''}-${m.mission_type || m.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setMissions(
          deduped.map((m) => ({
            ...m,
            // FIX: mapper mission_type → type pour la cohérence frontend
            type: m.mission_type || m.type || 'pure',
            skill_a_name: m.skill_a ? skillNameMap.get(m.skill_a) || 'Inconnue' : null,
            skill_b_name: m.skill_b ? skillNameMap.get(m.skill_b) || 'Inconnue' : null,
          }))
        );
      } else {
        setMissions(
          (data || []).map((m) => ({
            ...m,
            type: m.mission_type || m.type || 'pure',
          }))
        );
      }
    } catch (err) {
      console.error('Erreur chargement missions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, currentTerritory]);

  // Générer de nouvelles missions via l'Edge Function
  const generateMissions = async () => {
    console.log('🚀 Lancement de la génération des missions pour:', currentTerritory);
    setGenerating(true);
    setGeneratingFresh(true);
    setError(null);

    try {
      console.log('📡 Appel de l\'Edge Function spotbulle-generate-missions...');
      const { data, error: invokeError } = await supabase.functions.invoke(
        'spotbulle-generate-missions',
        {
          body: {
            user_id: userId,
            territory: currentTerritory,
          },
        }
      );

      if (invokeError) throw invokeError;

      console.log('✅ Missions générées avec succès:', data);

      // FIX: Calculer les stats côté frontend
      const missionsFromResponse = data?.missions || [];
      const totalCombinations = missionsFromResponse.length;

      setStats({
        acquired_count: 0, // Les missions générées ne sont pas encore acquises
        total_combinations: totalCombinations,
        objective_score: data?.objective_score || 0,
      });

      // Recharger les missions depuis la DB (l'Edge Function a nettoyé les doublons)
      await loadMissions();
    } catch (err) {
      console.error('Erreur génération missions:', err);
      setError(err.message || 'Erreur inconnue lors de la génération');
    } finally {
      setGenerating(false);
      setGeneratingFresh(false);
    }
  };

  // Mettre à jour le statut d'une mission
  const toggleMissionStatus = async (mission) => {
    try {
      const newStatus = mission.status === 'completed'
        ? 'pending'
        : mission.status === 'in_progress'
        ? 'completed'
        : 'in_progress';

      const { error } = await supabase
        .from('user_missions')
        .update({ status: newStatus })
        .eq('id', mission.id);

      if (error) throw error;

      // Mettre à jour localement
      setMissions((prev) =>
        prev.map((m) => (m.id === mission.id ? { ...m, status: newStatus } : m))
      );
    } catch (err) {
      console.error('Erreur mise à jour statut:', err);
      setError('Impossible de mettre à jour le statut');
    }
  };

  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

  // Statistiques de progression pour le territoire actuel
  const pureMissions = missions.filter((m) => m.type === 'pure');
  const hybridMissions = missions.filter((m) => m.type === 'hybrid');
  const pureCompleted = pureMissions.filter((m) => m.status === 'completed').length;
  const hybridCompleted = hybridMissions.filter((m) => m.status === 'completed').length;

  return (
    <OdysseyLayout
      currentStep={6}
      title=""
      maxWidthClass="max-w-6xl"
      onSignOut={onSignOut}
    >
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">Missions Lumia</h2>
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </div>
          <p className="text-slate-300 text-sm">
            Territoire de {currentTerritory} — Moteur d'optimisation Spotbulle
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <Card className="glass-card border-white/10 shadow-2xl rounded-2xl overflow-hidden bg-slate-900/70">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-400">{stats.acquired_count}</p>
                  <p className="text-xs text-slate-400">Compétences acquises</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{stats.total_combinations}</p>
                  <p className="text-xs text-slate-400">Combinaisons évaluées</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {Number.isFinite(stats.objective_score) ? stats.objective_score.toFixed(1) : '0.0'}
                  </p>
                  <p className="text-xs text-slate-400">Score objectif</p>
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
                  : 'border-white/20 text-slate-300 hover:bg-white/10'
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
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold"
            onClick={generateMissions}
            disabled={generating || !userId}
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {generatingFresh ? 'Nouvelle génération...' : 'Chargement...'}
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
          <Card className="glass-card border-red-500/30 rounded-2xl overflow-hidden bg-red-900/20">
            <CardContent className="p-4">
              <p className="text-red-400 text-sm">Erreur : {error}</p>
            </CardContent>
          </Card>
        )}

        {/* Missions list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
          </div>
        ) : missions.length === 0 ? (
          <Card className="glass-card border-white/10 rounded-2xl overflow-hidden bg-slate-900/70">
            <CardContent className="p-8 text-center">
              <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">
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
              const StatusIcon = mission.status === 'completed'
                ? CheckCircle2
                : mission.status === 'in_progress'
                ? Clock
                : null;

              return (
                <Card
                  key={index}
                  className={`glass-card border-white/10 rounded-2xl overflow-hidden bg-slate-900/70 hover:border-teal-400/30 transition-all cursor-pointer ${
                    mission.status === 'completed' ? 'border-teal-500/30 bg-teal-900/10' : ''
                  }`}
                  onClick={() => toggleMissionStatus(mission)}
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
                              <Badge variant="secondary" className="bg-slate-700 text-slate-200">
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
                          <p className="text-xs text-slate-400 mt-1">
                            Type: {mission.type === 'hybrid' ? 'Hybride' : 'Pure'} — Score:{' '}
                            {Number.isFinite(mission.total_score) ? mission.total_score.toFixed(1) : '0.0'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {StatusIcon && (
                          <StatusIcon
                            className={`w-4 h-4 ${
                              mission.status === 'completed'
                                ? 'text-green-400'
                                : 'text-orange-400'
                            }`}
                          />
                        )}
                        <Badge
                          variant="secondary"
                          className={
                            mission.status === 'completed'
                              ? 'bg-green-900/30 text-green-300'
                              : mission.status === 'in_progress'
                              ? 'bg-orange-900/30 text-orange-300'
                              : 'bg-slate-700 text-slate-300'
                          }
                        >
                          {mission.status === 'completed'
                            ? 'Complété'
                            : mission.status === 'in_progress'
                            ? 'En cours'
                            : 'En attente'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Progression */}
        <Card className="glass-card border-white/10 shadow-2xl rounded-2xl overflow-hidden bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              Progression
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>Compétences pures</span>
                  <span>{pureCompleted} / {pureMissions.length}</span>
                </div>
                <Progress
                  value={pureMissions.length > 0 ? (pureCompleted / pureMissions.length) * 100 : 0}
                  className="bg-slate-700"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>Combinaisons hybrides</span>
                  <span>{hybridCompleted} / {hybridMissions.length}</span>
                </div>
                <Progress
                  value={hybridMissions.length > 0 ? (hybridCompleted / hybridMissions.length) * 100 : 0}
                  className="bg-slate-700"
                />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 text-center">
              <p className="text-xs text-slate-400">
                Cliquez sur une mission pour changer son statut (En attente → En cours → Complété)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Navigation bottom */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <Button
            variant="outline"
            className="border-white/20 text-slate-300 hover:bg-white/10"
            onClick={() => navigate('/carte-galactique')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Précédent
          </Button>
        </div>
      </div>
    </OdysseyLayout>
  );
};

export default SpotbulleMissions;
