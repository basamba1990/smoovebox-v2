import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bell, ChevronLeft, ChevronRight, CircleHelp, LogOut, Pencil, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import {
  asPercentage,
  calculateImpact,
  firstValue,
  formatName,
  normalizeRadarValues,
  pickNextMission,
} from '../lib/spotbulleHomepageData.js';
import './SpotbulleHomepage.css';

const ASSET = '/spotbulle';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil', asset: 'nav-home.png', route: '/spotbulle-home' },
  { id: 'missions', label: 'Missions', asset: 'nav-journey.png', route: '/journal-mission' },
  { id: 'pitch', label: 'Pitch', asset: 'nav-pitch.png', route: '/pitch-recording' },
  { id: 'impact', label: 'Impact', asset: 'nav-impact.png', route: '/journal-mission' },
  { id: 'profile', label: 'Profil', asset: 'nav-profile.png', route: '/lumi/profile' },
];

const WHEEL_ITEMS = [
  { id: 'missions', label: 'Missions', description: 'Voir les missions accessibles', route: '/journal-mission', asset: 'menu-missions.png' },
  { id: 'profile', label: 'Profil', description: 'Consulter votre profil Lumia', route: '/lumi/profile', asset: 'menu-lumi.png' },
  { id: 'radar', label: 'Radar', description: 'Mettre à jour votre radar', route: '/update-disc', asset: 'menu-ranking.png' },
  { id: 'pitch', label: 'Pitch', description: 'Enregistrer un pitch', route: '/pitch-recording', asset: 'menu-portfolio.png' },
  { id: 'portfolio', label: 'Portfolio', description: 'Ouvrir votre portfolio', route: '/genup-portfolio', asset: 'menu-team.png' },
];

const ENERGY_COLORS = {
  Energie1: '#f5a623',
  Energie2: '#72d5ca',
  Energie3: '#a7a0ff',
};

function DataState({ title, actionLabel, onAction }) {
  return (
    <div className="spotbulle-empty-state" role="status">
      <CircleHelp aria-hidden="true" size={22} />
      <div>
        <strong>{title}</strong>
        {actionLabel && onAction ? (
          <button type="button" onClick={onAction}>{actionLabel}</button>
        ) : null}
      </div>
    </div>
  );
}

function LoadingState({ label = 'Chargement des données…' }) {
  return <div className="spotbulle-loading" role="status"><RefreshCw className="spin" size={18} /> {label}</div>;
}

function ProgressBar({ value, color }) {
  return (
    <div className="spotbulle-progress-track" aria-label={`${value ?? 0}%`}>
      <div className="spotbulle-progress-fill" style={{ width: `${value ?? 0}%`, backgroundColor: color }} />
    </div>
  );
}

function Radar({ values, onDetails }) {
  const hasValues = values.every((value) => typeof value === 'number');
  if (!hasValues) {
    return <DataState title="Radar indisponible pour ce profil." actionLabel="Mettre à jour mon radar" onAction={onDetails} />;
  }

  const points = [
    [100, 12, values[0]],
    [188, 74, values[1]],
    [154, 178, values[2]],
    [46, 178, values[3]],
    [12, 74, values[4]],
  ];
  const polygon = points.map(([x, y, value]) => {
    const centerX = 100;
    const centerY = 102;
    const scale = value / 100;
    return `${centerX + (x - centerX) * scale},${centerY + (y - centerY) * scale}`;
  }).join(' ');

  return (
    <div className="radar-wrap">
      <svg viewBox="0 0 200 190" role="img" aria-label="Radar de personnalité">
        <polygon points="100,12 188,74 154,178 46,178 12,74" className="radar-grid" />
        <polygon points="100,36 164,81 140,150 60,150 36,81" className="radar-grid" />
        <polygon points="100,60 140,88 126,122 74,122 60,88" className="radar-grid" />
        <polygon points={polygon} className="radar-value" />
        {points.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="3" className="radar-point" />)}
      </svg>
      <div className="radar-labels"><span>Air</span><span>Eau</span><span>Feu</span><span>Terre</span><span>Équilibre</span></div>
      <button type="button" className="link-button" onClick={onDetails}>Mon radar en détails <ArrowUpRight size={15} /></button>
    </div>
  );
}

export default function SpotbulleHomepage({ user, profile, onSignOut }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ missions: [], territories: [], videos: [], radar: null });
  const [selectedWheel, setSelectedWheel] = useState(WHEEL_ITEMS[0]);
  const [wheelRotation, setWheelRotation] = useState(0);

  const loadHomepageData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const errors = [];

    const [missionResult, territoryResult, videoResult, radarResult, questionnaireResult] = await Promise.all([
      supabase.from('user_missions').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('spotbulle_territories').select('territory, display_name, order_index, required_missions').order('order_index', { ascending: true }),
      supabase.from('videos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('lumi_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('questionnaire_responses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    ]);

    if (missionResult.error) errors.push('missions');
    if (territoryResult.error) errors.push('territories');
    if (videoResult.error) errors.push('videos');
    if (radarResult.error && questionnaireResult.error) errors.push('radar');
    if (errors.length > 0) setError(`Certaines données ne sont pas disponibles : ${errors.join(', ')}.`);

    const missions = missionResult.data || [];
    const skillIds = [...new Set(missions.flatMap((mission) => [mission.skill_a, mission.skill_b].filter(Boolean)))];
    let skills = [];
    if (skillIds.length > 0) {
      const skillsResult = await supabase.from('skills').select('id, name, energy, sub_energy').in('id', skillIds);
      if (!skillsResult.error) skills = skillsResult.data || [];
    }
    const skillMap = new Map(skills.map((skill) => [skill.id, skill]));

    setData({
      missions: missions.map((mission) => ({
        ...mission,
        type: mission.mission_type || mission.type || 'pure',
        skillA: skillMap.get(mission.skill_a),
        skillB: skillMap.get(mission.skill_b),
      })),
      territories: territoryResult.data || [],
      videos: videoResult.data || [],
      radar: radarResult.data?.[0] || questionnaireResult.data?.[0] || null,
    });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadHomepageData(); }, [loadHomepageData]);

  const displayName = formatName(profile, user);
  const firstName = displayName?.split(' ')[0] || null;

  const nextMission = useMemo(() => pickNextMission(data.missions), [data.missions]);
  const impact = useMemo(() => calculateImpact(data.missions), [data.missions]);

  const radarValues = useMemo(() => normalizeRadarValues(data.radar), [data.radar]);

  const latestPitch = data.videos.find((video) => video.video_url || video.public_url || video.storage_path) || null;
  const level = firstValue(profile, ['level', 'current_level', 'niveau']);
  const xp = asPercentage(firstValue(profile, ['experience', 'experience_percentage', 'xp', 'xp_percentage']));

  const handleWheel = (direction) => {
    const offset = direction === 'next' ? 1 : -1;
    const currentIndex = WHEEL_ITEMS.findIndex((item) => item.id === selectedWheel.id);
    const nextIndex = (currentIndex + offset + WHEEL_ITEMS.length) % WHEEL_ITEMS.length;
    setSelectedWheel(WHEEL_ITEMS[nextIndex]);
    setWheelRotation((rotation) => rotation + (direction === 'next' ? 72 : -72));
  };

  const openSelectedWheel = () => navigate(selectedWheel.route);

  return (
    <div className="spotbulle-page">
      <header className="spotbulle-header">
        <button type="button" className="spotbulle-logo-button" onClick={() => window.open('/', '_blank', 'noopener,noreferrer')} aria-label="Ouvrir la landing page Spotbulle">
          <img src={`${ASSET}/logo.png`} alt="Spotbulle" />
        </button>
        <div className="spotbulle-header-actions">
          <button type="button" className="icon-button" aria-label="Notifications" title="Notifications"><Bell size={20} /></button>
          <button type="button" className="icon-button" aria-label="Se déconnecter" title="Se déconnecter" onClick={onSignOut}><LogOut size={20} /></button>
        </div>
      </header>

      <main className="spotbulle-main">
        {error ? <div className="spotbulle-error" role="alert">{error}<button type="button" onClick={loadHomepageData}>Réessayer</button></div> : null}
        <section className="spotbulle-hero-grid">
          <article className="spotbulle-profile-card">
            <div className="profile-planet" aria-hidden="true"><img src={`${ASSET}/profile-planet.png`} alt="" /></div>
            <div className="profile-card-content">
              <div className="profile-avatar-wrap">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="profile-avatar" /> : <div className="profile-avatar profile-avatar-empty" aria-label="Photo de profil indisponible" />}
                <img src={`${ASSET}/profile-photo-frame.png`} alt="" className="profile-avatar-frame" />
              </div>
              <div className="profile-copy">
                <p className="eyebrow">Mon profil</p>
                <h1>{firstName ? `Bonjour ${firstName}` : 'Bonjour'}</h1>
                <p className="profile-name">{displayName || 'Nom indisponible'}</p>
                <button type="button" className="edit-profile-button" onClick={() => navigate('/lumi/profile')}><Pencil size={14} /> Modifier</button>
              </div>
              <div className="profile-level">
                <img src={`${ASSET}/profile-badge.png`} alt="Badge du profil" />
                {level ? <strong>{level}</strong> : <span>Niveau indisponible</span>}
                {xp !== null ? <><ProgressBar value={xp} color="#72d5ca" /><small>{xp}% d’expérience</small></> : <small>Progression indisponible</small>}
              </div>
            </div>
          </article>

          <article className="spotbulle-wheel-card">
            <div className="section-heading"><div><p className="eyebrow">Explorer</p><h2>Votre parcours</h2></div><span className="selection-pill">{selectedWheel.label}</span></div>
            <div className="wheel-stage">
              <button type="button" className="wheel-arrow wheel-arrow-left" onClick={() => handleWheel('previous')} aria-label="Catégorie précédente"><ChevronLeft /></button>
              <button type="button" className="wheel-control" onClick={openSelectedWheel} aria-label={`Ouvrir ${selectedWheel.label}`}>
                <img src={`${ASSET}/wheel.png`} alt="" style={{ transform: `rotate(${wheelRotation}deg)` }} />
                <span>{selectedWheel.label}</span>
              </button>
              <button type="button" className="wheel-arrow wheel-arrow-right" onClick={() => handleWheel('next')} aria-label="Catégorie suivante"><ChevronRight /></button>
            </div>
            <p className="wheel-description">{selectedWheel.description}</p>
            <button type="button" className="primary-button" onClick={openSelectedWheel}>Ouvrir {selectedWheel.label} <ArrowUpRight size={16} /></button>
          </article>
        </section>

        {loading ? <LoadingState /> : null}

        <section className="spotbulle-data-grid">
          <article className="spotbulle-panel mission-panel">
            <div className="section-heading"><div><p className="eyebrow">Continuer</p><h2>Prochaine mission</h2></div><img src={`${ASSET}/mission-badge.png`} alt="" className="small-asset" /></div>
            {nextMission ? <><p className="mission-type">{nextMission.type === 'pure' ? 'Compétence pure' : 'Mission hybride'}</p><h3>{nextMission.title || nextMission.name || `${nextMission.skillA?.name || 'Mission'}`}</h3><p className="muted-text">{nextMission.objective || nextMission.description || 'Objectif disponible dans la mission.'}</p><button type="button" className="primary-button" onClick={() => navigate('/journal-mission')}>Accéder à la mission <ArrowUpRight size={16} /></button></> : <DataState title="Aucune mission accessible pour le moment." actionLabel="Ouvrir mes missions" onAction={() => navigate('/journal-mission')} />}
          </article>

          <article className="spotbulle-panel radar-panel">
            <div className="section-heading"><div><p className="eyebrow">Personnalité</p><h2>Mon radar</h2></div></div>
            <Radar values={radarValues} onDetails={() => navigate('/update-disc')} />
          </article>

          <article className="spotbulle-panel pitch-panel">
            <div className="section-heading"><div><p className="eyebrow">Expression</p><h2>Mon pitch vidéo</h2></div></div>
            {latestPitch ? <><video className="pitch-preview" controls preload="metadata" poster={latestPitch.thumbnail_url || `${ASSET}/pitch-card.png`} src={latestPitch.video_url || latestPitch.public_url} /><p className="muted-text">{latestPitch.title || 'Pitch enregistré'}</p><button type="button" className="link-button" onClick={() => navigate('/video-vault')}>Voir mes pitchs <ArrowUpRight size={15} /></button></> : <DataState title="Aucun pitch vidéo enregistré." actionLabel="Enregistrer un pitch" onAction={() => navigate('/pitch-recording')} />}
          </article>

          <article className="spotbulle-panel impact-panel">
            <div className="section-heading"><div><p className="eyebrow">Progression</p><h2>Mon impact</h2></div><img src={`${ASSET}/impact-planet.png`} alt="" className="impact-planet" /></div>
            {impact.rows.length ? <div className="impact-content"><div className="impact-bars">{impact.rows.map((row) => <div className="impact-row" key={row.label}><div><span>{row.label}</span><strong>{row.value}%</strong></div><ProgressBar value={row.value} color={ENERGY_COLORS[row.label] || '#72d5ca'} /></div>)}</div><div className="impact-global"><div className="impact-ring" style={{ '--progress': `${impact.global}%` }}><span>{impact.global}%</span></div><small>Progression globale</small></div></div> : <DataState title="La progression apparaîtra après vos premières missions." actionLabel="Voir mes missions" onAction={() => navigate('/journal-mission')} />}
          </article>
        </section>
      </main>

      <nav className="spotbulle-bottom-nav" aria-label="Navigation principale">{NAV_ITEMS.map((item) => <button type="button" key={item.id} className={item.id === 'home' ? 'active' : ''} onClick={() => navigate(item.route)}><img src={`${ASSET}/${item.asset}`} alt="" /><span>{item.label}</span></button>)}</nav>
    </div>
  );
}
