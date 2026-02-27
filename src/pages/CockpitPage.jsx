import React from 'react';
import { useAuth } from '../context/AuthContext'; // ou votre hook useAuth existant
import { useCatalogueInterne } from '../hooks/useCatalogueInterne';
import { useLumiaFlow } from '../hooks/useLumiaFlow';
import CatalogueInterneFlow from '../components/CatalogueInterneFlow';
import LumiaRadar from '../components/LumiaRadar';
import LumiaFlowVisualizer from '../components/LumiaFlowVisualizer';
// Optionnel : RobotIO si vous souhaitez l'intégrer
import RobotIO from '../components/RobotIO';

export default function CockpitPage({ onSignOut }) {
  const { user, profile } = useAuth();
  const {
    currentEtapeObject,
    completedEtapes,
    etapeData,
    getProgress,
    goToNextEtape,
    goToPreviousEtape,
  } = useCatalogueInterne();

  const { currentStep, goToNextStep, goToPreviousStep } = useLumiaFlow();
  const progress = getProgress();

  return (
    <div className="cockpit-spot-page">
      {/* HEADER */}
      <header className="cockpit-header">
        <div className="header-content">
          <h1>🛰 Cockpit SPOT</h1>
          <p className="subtitle">Tableau de bord LUMIA – Suivi de progression</p>
        </div>
        <div className="user-info">
          <span>{user?.name || profile?.full_name || 'Utilisateur'}</span>
          <button onClick={onSignOut} className="signout-btn" title="Déconnexion">
            ⏻
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="cockpit-main">
        {/* SECTION 1 : PROGRESSION GLOBALE */}
        <section className="section-progression">
          <div className="card">
            <h2>📊 Votre progression</h2>
            <div className="progress-stats">
              <div className="stat">
                <div className="stat-value">{progress.current}</div>
                <div className="stat-label">Étape actuelle</div>
              </div>
              <div className="stat">
                <div className="stat-value">{progress.percentage}%</div>
                <div className="stat-label">Complété</div>
              </div>
              <div className="stat">
                <div className="stat-value">{progress.completed}</div>
                <div className="stat-label">Étapes finies</div>
              </div>
              <div className="stat">
                <div className="stat-value">{progress.remaining}</div>
                <div className="stat-label">Restantes</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 : TIMELINE DU CATALOGUE INTERNE */}
        <section className="section-timeline">
          <div className="card">
            <CatalogueInterneFlow />
          </div>
        </section>

        {/* SECTION 3 : RADAR ÉNERGÉTIQUE + FLUX PROJET (côte à côte) */}
        <div className="dashboard-row">
          <section className="section-radar">
            <div className="card">
              <h2>⚡ Équilibre énergétique</h2>
              <LumiaRadar
                scores={etapeData?.energies || { feu: 50, air: 50, terre: 50, eau: 50 }}
              />
            </div>
          </section>

          <section className="section-flux">
            <div className="card">
              <h2>🌌 Flux du projet</h2>
              <LumiaFlowVisualizer currentStep={currentStep} />
            </div>
          </section>
        </div>

        {/* SECTION 4 : ACTIONS RAPIDES */}
        <section className="section-actions">
          <div className="card">
            <h3>Actions rapides</h3>
            <div className="actions-grid">
              <button className="action-btn" onClick={goToPreviousEtape}>
                ◀ Étape précédente
              </button>
              <button className="action-btn" onClick={goToNextEtape}>
                Étape suivante ▶
              </button>
              <button className="action-btn" onClick={goToPreviousStep}>
                ◀ Flux précédent
              </button>
              <button className="action-btn" onClick={goToNextStep}>
                Flux suivant ▶
              </button>
              <button className="action-btn" onClick={() => alert('Téléchargement du portfolio')}>
                📥 Télécharger portfolio
              </button>
              <button className="action-btn" onClick={() => alert('Partage de profil')}>
                🔗 Partager mon profil
              </button>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        .cockpit-spot-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .cockpit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2rem;
          background: rgba(6, 182, 212, 0.1);
          border-bottom: 1px solid rgba(6, 182, 212, 0.2);
        }

        .cockpit-header h1 {
          margin: 0;
          font-size: 2rem;
          color: #06b6d4;
        }

        .subtitle {
          margin: 0.5rem 0 0 0;
          color: #94a3b8;
          font-size: 0.875rem;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .signout-btn {
          background: none;
          border: 1px solid #06b6d4;
          color: #06b6d4;
          font-size: 1.2rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }

        .signout-btn:hover {
          background: #06b6d4;
          color: #0f172a;
        }

        .cockpit-main {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .section-progression,
        .section-timeline,
        .section-actions {
          margin-bottom: 2rem;
        }

        .card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
          backdrop-filter: blur(10px);
        }

        .card h2,
        .card h3 {
          margin: 0 0 1.5rem 0;
          color: #06b6d4;
          font-size: 1.25rem;
        }

        .progress-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .stat {
          text-align: center;
          padding: 1rem;
          background: rgba(6, 182, 212, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(6, 182, 212, 0.2);
        }

        .stat-value {
          font-size: 2rem;
          font-weight: bold;
          color: #06b6d4;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #94a3b8;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 1rem;
        }

        .action-btn {
          padding: 1rem;
          background: linear-gradient(135deg, #06b6d4, #0ea5e9);
          border: none;
          border-radius: 8px;
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(6, 182, 212, 0.3);
        }

        @media (max-width: 768px) {
          .cockpit-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .cockpit-main {
            padding: 1rem;
          }

          .dashboard-row {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .cockpit-header h1 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
