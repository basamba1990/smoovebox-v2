import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bell, ChevronLeft, ChevronRight, CircleHelp, Info, LogOut, Pencil, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import {
  calculateImpact,
  firstValue,
  formatName,
  levelPresentation,
  missionSessionCount,
  normalizeRadarValues,
  selectNextMission,
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
  { id: 'missions', label: 'Missions', description: 'Voir les missions accessibles', lumi: 'Lumi vous montre votre prochaine mission.', route: '/journal-mission', asset: 'menu-missions.png' },
  { id: 'profile', label: 'Profil', description: 'Consulter votre profil Lumia', lumi: 'Votre profil rassemble vos progrès.', route: '/lumi/profile', asset: 'menu-lumi.png' },
  { id: 'radar', label: 'Radar', description: 'Mettre à jour votre radar', lumi: 'Votre radar évolue avec vos réponses.', route: '/update-disc', asset: 'menu-ranking.png' },
  { id: 'pitch', label: 'Pitch', description: 'Enregistrer un pitch', lumi: 'Présentez votre potentiel en vidéo.', route: '/pitch-recording', asset: 'menu-portfolio.png' },
  { id: 'portfolio', label: 'Portfolio', description: 'Ouvrir votre portfolio', lumi: 'Retrouvez vos réalisations.', route: '/genup-portfolio', asset: 'menu-team.png' },
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

function NotificationPanel({ notifications, onClose }) {
  return (
    <div className="notification-popover" role="dialog" aria-label="Notifications">
      <div className="notification-heading"><strong>Notifications</strong><button type="button" onClick={onClose} aria-label="Fermer les notifications"><X size={16} /></button></div>
      {notifications.length ? notifications.map((notification) => <div className="notification-item" key={notification.id}><strong>{notification.title || notification.name || 'Notification'}</strong><span>{notification.message || notification.body || 'Contenu non renseigné'}</span></div>) : <DataState title="Aucune notification disponible." />}
    </div>
  );
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
  const location = useLocation();
  const [data, setData] = useState({ missions: [], territories: [], videos: [], radar: null, badges: [], levelDefinitions: [], notifications: [] });
  const [selectedWheel, setSelectedWheel] = useState(WHEEL_ITEMS[0]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelHovered, setWheelHovered] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const pointerStart = useRef(null);
  const suppressClick = useRef(false);

  const loadHomepageData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    const errors = [];

    const [missionResult, territoryResult, videoResult, radarResult, questionnaireResult, badgeResult, levelResult, notificationResult] = await Promise.all([
      supabase.from('user_missions').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('spotbulle_territories').select('territory, display_name, order_index, required_missions').order('order_index', { ascending: true }),
      supabase.from('videos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('lumi_profiles').select('*').eq('user_id', user.id).order('computed_at', { ascending: false }).limit(1),
      supabase.from('questionnaire_responses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('user_spotbulle_badges').select('badge_id, awarded_at, spotbulle_badges(*)').eq('user_id', user.id).order('awarded_at', { ascending: false }).limit(1),
      supabase.from('spotbulle_badges').select('*'),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);

    if (missionResult.error) errors.push('missions');
    if (territoryResult.error) errors.push('territories');
    if (videoResult.error) errors.push('videos');
    if (radarResult.error && questionnaireResult.error) errors.push('radar');
    if (badgeResult.error) errors.push('badges');
    if (levelResult.error) errors.push('niveaux');
    if (notificationResult.error) errors.push('notifications');
    if (errors.length > 0) setError(`Certaines données ne sont pas disponibles : ${errors.join(', ')}.`);

    const missions = missionResult.data || [];
    const skillIds = [...new Set(missions.flatMap((mission) => [mission.skill_a, mission.skill_b].filter(Boolean)))];
    let skills = [];
    if (skillIds.length > 0) {
      const skillsResult = await supabase.from('skills').select('id, name, energy, sub_energy').in('id', skillIds);
      if (!skillsResult.error) skills = skillsResult.data || [];
    }
    const skillMap = new Map(skills.map((skill) => [skill.id, skill]));

    const videos = await Promise.all((videoResult.data || []).map(async (video) => {
      if (video.video_url || video.public_url || !video.file_path && !video.storage_path) return video;
      const { data: signedData, error: signedError } = await supabase.storage.from('videos').createSignedUrl(video.file_path || video.storage_path, 3600);
      return signedError ? video : { ...video, video_url: signedData?.signedUrl || null };
    }));

    setData({
      missions: missions.map((mission) => ({
        ...mission,
        type: mission.mission_type || mission.type || 'pure',
        skillA: skillMap.get(mission.skill_a),
        skillB: skillMap.get(mission.skill_b),
      })),
      territories: territoryResult.data || [],
      videos,
      radar: radarResult.data?.[0] || questionnaireResult.data?.[0] || null,
      badges: badgeResult.data || [],
      levelDefinitions: levelResult.data || [],
      notifications: notificationResult.data || [],
    });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadHomepageData(); }, [loadHomepageData]);

  const displayName = formatName(profile, user);
  const firstName = displayName?.split(' ')[0] || null;

  const nextMission = useMemo(() => selectNextMission(data.missions, data.territories), [data.missions, data.territories]);
  const impact = useMemo(() => calculateImpact(data.missions, profile?.energy_weights || profile?.impact_weights || {}), [data.missions, profile?.energy_weights, profile?.impact_weights]);

  const radarValues = useMemo(() => normalizeRadarValues(data.radar), [data.radar]);

  const latestPitch = data.videos.find((video) => video.video_url || video.public_url) || null;
  const levelInfo = levelPresentation(profile, data.missions, data.levelDefinitions);
  const badge = data.badges?.[0]?.spotbulle_badges || data.badges?.[0]?.badge || null;
  const badgeUrl = badge?.image_url || badge?.icon_url || badge?.asset_url || profile?.badge_url || null;
  const missionBadgeUrl = nextMission && firstValue(nextMission, ['badge_url', 'badge_image_url', 'badge_icon_url']);
  const unreadNotifications = data.notifications.filter((notification) => !notification.read_at && notification.is_read !== true);

  const handleWheel = (direction) => {
    const offset = direction === 'next' ? 1 : -1;
    const currentIndex = WHEEL_ITEMS.findIndex((item) => item.id === selectedWheel.id);
    const nextIndex = (currentIndex + offset + WHEEL_ITEMS.length) % WHEEL_ITEMS.length;
    setSelectedWheel(WHEEL_ITEMS[nextIndex]);
    setWheelRotation((rotation) => rotation + (direction === 'next' ? 72 : -72));
  };

  const openSelectedWheel = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    navigate(selectedWheel.route);
  };
  const handleWheelPointerDown = (event) => {
    pointerStart.current = event.clientX;
    suppressClick.current = false;
  };
  const handleWheelPointerUp = (event) => {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) >= 20) {
      suppressClick.current = true;
      handleWheel(delta < 0 ? 'next' : 'previous');
    }
  };
  const handleWheelKeyDown = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') handleWheel('next');
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') handleWheel('previous');
  };

  return (
    <div className="spotbulle-page">
      <header className="spotbulle-header">
        <button type="button" className="spotbulle-logo-button" onClick={() => window.open('/', '_blank', 'noopener,noreferrer')} aria-label="Ouvrir la landing page Spotbulle">
          <img src={`${ASSET}/logo.png`} alt="Spotbulle" />
        </button>
        <div className="spotbulle-header-actions">
          <div className="notification-anchor">
            <button type="button" className="icon-button" aria-label={`Notifications${unreadNotifications.length ? `, ${unreadNotifications.length} non lues` : ''}`} title="Notifications" onClick={() => setNotificationOpen((open) => !open)}><Bell size={20} />{unreadNotifications.length ? <span className="notification-count">{unreadNotifications.length}</span> : null}</button>
            {notificationOpen ? <NotificationPanel notifications={data.notifications} onClose={() => setNotificationOpen(false)} /> : null}
          </div>
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
                {badgeUrl ? <img src={badgeUrl} alt={badge?.name || 'Badge du profil'} /> : <div className="dynamic-empty-icon"><Info size={18} /></div>}
                {levelInfo.level ? <strong>{levelInfo.level}</strong> : <span>Niveau indisponible</span>}
                {levelInfo.title ? <span className="level-title">{levelInfo.title}</span> : <span className="level-title">Titre indisponible</span>}
                <div className="xp-hover-target" title={levelInfo.nextLevel && levelInfo.xp !== null ? `${levelInfo.xp}% vers ${levelInfo.nextLevel}` : 'Progression vers le prochain niveau indisponible'}>
                  {levelInfo.xp !== null ? <><ProgressBar value={levelInfo.xp} color="#72d5ca" /><small>{levelInfo.xp}% d’expérience</small></> : <small>Progression indisponible</small>}
                </div>
                <button type="button" className="link-button" onClick={() => navigate('/lumi/profile')}>Coffre stellaire <ArrowUpRight size={13} /></button>
              </div>
            </div>
          </article>

          <article className="spotbulle-wheel-card">
            <div className="section-heading"><div><p className="eyebrow">Explorer</p><h2>Votre parcours</h2></div><span className="selection-pill">{selectedWheel.label}</span></div>
            <div className="wheel-stage" onMouseEnter={() => setWheelHovered(true)} onMouseLeave={() => setWheelHovered(false)}>
              <button type="button" className="wheel-arrow wheel-arrow-left" onClick={() => handleWheel('previous')} aria-label="Catégorie précédente"><ChevronLeft /></button>
              <button type="button" className="wheel-control" onClick={openSelectedWheel} onPointerDown={handleWheelPointerDown} onPointerUp={handleWheelPointerUp} onKeyDown={handleWheelKeyDown} aria-label={`Ouvrir ${selectedWheel.label}`}>
                <img src={`${ASSET}/wheel.png`} alt="" style={{ transform: `rotate(${wheelRotation}deg)` }} />
                <span>{selectedWheel.label}</span>
              </button>
              <button type="button" className="wheel-arrow wheel-arrow-right" onClick={() => handleWheel('next')} aria-label="Catégorie suivante"><ChevronRight /></button>
              {wheelHovered ? <div className="lumi-context" role="status"><img src={`${ASSET}/menu-lumi.png`} alt="Lumi" /><span>{selectedWheel.lumi}</span></div> : null}
            </div>
            <p className="wheel-description">{selectedWheel.description}</p>
            <button type="button" className="primary-button" onClick={openSelectedWheel}>Ouvrir {selectedWheel.label} <ArrowUpRight size={16} /></button>
          </article>
        </section>

        {loading ? <LoadingState /> : null}

        <section className="spotbulle-data-grid">
          <article className="spotbulle-panel mission-panel">
            <div className="section-heading"><div><p className="eyebrow">Continuer</p><h2>Prochaine mission</h2></div>{missionBadgeUrl ? <img src={missionBadgeUrl} alt="Badge de la mission" className="small-asset" /> : <div className="small-asset dynamic-empty-icon"><Info size={18} /></div>}</div>
            {nextMission ? <><p className="mission-type">{nextMission.type === 'pure' ? 'Compétence pure' : 'Mission hybride'}</p><h3>{nextMission.title || nextMission.name || nextMission.skillA?.name || 'Nom non renseigné'}</h3><p className="mission-sessions">{missionSessionCount(nextMission) !== null ? `${missionSessionCount(nextMission)} session(s)` : 'Nombre de sessions non renseigné'}</p><p className="muted-text">{nextMission.objective || nextMission.description || 'Objectif non renseigné'}</p><button type="button" className="primary-button" onClick={() => navigate('/journal-mission')}>Accéder à la mission <ArrowUpRight size={16} /></button><button type="button" className="link-button" onClick={() => navigate('/journal-mission')}>Voir mes missions <ArrowUpRight size={15} /></button></> : <DataState title="Aucune mission pure accessible pour le territoire courant." actionLabel="Ouvrir mes missions" onAction={() => navigate('/journal-mission')} />}
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
            <div className="impact-content"><div className="impact-bars">{impact.rows.map((row) => <div className="impact-row" key={row.label}><div><span>{row.label}</span><strong>{row.value !== null ? `${row.value}%` : 'Indisponible'}</strong></div>{row.value !== null ? <ProgressBar value={row.value} color={ENERGY_COLORS[row.label] || '#72d5ca'} /> : <div className="impact-unavailable">Donnée non renseignée</div>}</div>)}</div><div className="impact-global">{impact.global !== null ? <div className="impact-ring" style={{ '--progress': `${impact.global}%` }}><span>{impact.global}%</span></div> : <div className="dynamic-empty-icon"><Info size={20} /></div>}<small>{impact.global !== null ? 'Progression globale pondérée' : 'Pondération globale indisponible'}</small></div></div>
          </article>
        </section>
      </main>

      <nav className="spotbulle-bottom-nav" aria-label="Navigation principale">{NAV_ITEMS.map((item) => { const active = location.pathname === item.route || item.id !== 'home' && location.pathname.startsWith(item.route); return <button type="button" key={item.id} className={active ? 'active' : ''} onClick={() => navigate(item.route)}><img src={`${ASSET}/${item.asset}`} alt="" /><span>{item.label}</span></button>; })}</nav>
    </div>
  );
}
