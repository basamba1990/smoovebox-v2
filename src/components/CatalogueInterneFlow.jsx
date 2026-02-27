import React from 'react';
import { CATALOGUE_ETAPES, ENERGIES } from '../config/catalogue-interne.config';
import { useCatalogueInterne } from '../hooks/useCatalogueInterne';

/**
 * Composant visualisant la timeline des 10 étapes du Catalogue Interne.
 */
export default function CatalogueInterneFlow() {
  const {
    currentEtape,
    completedEtapes,
    goToEtape,
    getProgress,
    isEtapeCompleted,
  } = useCatalogueInterne();

  const progress = getProgress();

  return (
    <div className="catalogue-interne-flow">
      {/* HEADER */}
      <div className="flow-header">
        <h2>Parcours Élève - Catalogue Interne</h2>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <p className="progress-text">
          Étape {progress.current} / {progress.total} ({progress.percentage}%)
        </p>
      </div>

      {/* TIMELINE */}
      <div className="flow-timeline">
        {CATALOGUE_ETAPES.map((etape, index) => (
          <div
            key={etape.id}
            className={`timeline-item ${
              etape.id === currentEtape?.id ? 'active' : ''
            } ${isEtapeCompleted(etape.id) ? 'completed' : ''}`}
            onClick={() => goToEtape(etape.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && goToEtape(etape.id)}
            aria-label={`Aller à l'étape ${etape.id} : ${etape.label}`}
          >
            {/* Connecteur vers l'étape suivante */}
            {index < CATALOGUE_ETAPES.length - 1 && <div className="connector" />}

            {/* Nœud circulaire */}
            <div className="node">
              <div className="node-number">{etape.id}</div>
              {isEtapeCompleted(etape.id) && (
                <div className="node-check">✓</div>
              )}
            </div>

            {/* Contenu */}
            <div className="content">
              <h3>{etape.label}</h3>
              <p className="subtitle">{etape.subtitle}</p>
              <p className="description">{etape.description}</p>

              {/* Badges énergies */}
              <div className="energies">
                {etape.energies.map(energy => (
                  <span
                    key={energy}
                    className="energy-badge"
                    style={{
                      backgroundColor: ENERGIES[energy].color,
                    }}
                    title={ENERGIES[energy].description}
                  >
                    {ENERGIES[energy].icon}
                  </span>
                ))}
              </div>

              {/* Liste modules */}
              <div className="modules">
                <small>Modules: {etape.modules.join(', ')}</small>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .catalogue-interne-flow {
          padding: 2rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 12px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .flow-header {
          margin-bottom: 3rem;
          text-align: center;
        }

        .flow-header h2 {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: #06b6d4;
          font-weight: 600;
        }

        .progress-bar {
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #06b6d4, #0ea5e9);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.875rem;
          color: #94a3b8;
          margin: 0;
        }

        .flow-timeline {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .timeline-item {
          position: relative;
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .timeline-item:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(6, 182, 212, 0.5);
          transform: translateX(4px);
        }

        .timeline-item.active {
          background: rgba(6, 182, 212, 0.15);
          border-color: #06b6d4;
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
        }

        .timeline-item.completed {
          opacity: 0.7;
        }

        .connector {
          position: absolute;
          left: 2rem;
          top: 100%;
          width: 2px;
          height: 1.5rem;
          background: rgba(6, 182, 212, 0.3);
        }

        .node {
          position: relative;
          min-width: 3rem;
          width: 3rem;
          height: 3rem;
          background: linear-gradient(135deg, #06b6d4, #0ea5e9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.125rem;
          flex-shrink: 0;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
        }

        .node-number {
          opacity: 1;
          transition: opacity 0.3s;
        }

        .node-check {
          position: absolute;
          opacity: 0;
          font-size: 1.5rem;
          color: #22c55e;
          transition: opacity 0.3s;
        }

        .timeline-item.completed .node-number {
          opacity: 0;
        }

        .timeline-item.completed .node-check {
          opacity: 1;
        }

        .content {
          flex: 1;
          min-width: 0;
        }

        .content h3 {
          margin: 0 0 0.25rem 0;
          font-size: 1.125rem;
          color: #06b6d4;
          font-weight: 600;
        }

        .subtitle {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          color: #cbd5e1;
          font-weight: 500;
        }

        .description {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          color: #94a3b8;
          line-height: 1.5;
        }

        .energies {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .energy-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          font-size: 1rem;
          opacity: 0.8;
          transition: opacity 0.2s;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
        }

        .energy-badge:hover {
          opacity: 1;
        }

        .modules {
          font-size: 0.75rem;
          color: #64748b;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin: 0;
        }

        @media (max-width: 768px) {
          .catalogue-interne-flow {
            padding: 1rem;
          }

          .timeline-item {
            flex-direction: column;
            gap: 1rem;
          }

          .node {
            width: 2.5rem;
            height: 2.5rem;
            font-size: 1rem;
          }

          .flow-header h2 {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}
