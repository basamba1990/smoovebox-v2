import React from 'react';

/**
 * Visualiseur du flux User -> Mission -> Constellation -> Pitch -> Update LUMIA.
 * @param {Object} props
 * @param {number} props.currentStep - Étape actuelle (1 à 5)
 * @param {Object} props.data - Données optionnelles pour enrichir l'affichage
 */
export default function LumiaFlowVisualizer({ currentStep = 1, data = {} }) {
  const steps = [
    { id: 1, icon: '👤', label: 'Profil', description: 'Sélectionner zone dominante' },
    { id: 2, icon: '🎯', label: 'Mission', description: 'Choisir une mission' },
    { id: 3, icon: '🌌', label: 'Constellation', description: 'Former équipe de 4' },
    { id: 4, icon: '🎥', label: 'Pitch', description: 'Enregistrer vidéo' },
    { id: 5, icon: '⚡', label: 'LUMIA', description: 'Mise à jour énergétique' },
  ];

  return (
    <div className="lumia-flow-visualizer">
      <h3>Flux du Projet</h3>

      <div className="flow-container">
        {steps.map((step, index) => (
          <div key={step.id} className="flow-wrapper">
            {/* Étape */}
            <div
              className={`flow-step ${
                currentStep === step.id ? 'active' : ''
              } ${currentStep > step.id ? 'completed' : ''}`}
            >
              <div className="step-icon">{step.icon}</div>
              <div className="step-content">
                <h4>{step.label}</h4>
                <p>{step.description}</p>
              </div>
            </div>

            {/* Flèche vers étape suivante */}
            {index < steps.length - 1 && (
              <div className="arrow">→</div>
            )}
          </div>
        ))}
      </div>

      {/* Détails étape actuelle */}
      {data[currentStep] && (
        <div className="step-details">
          <h4>Détails Étape {currentStep}</h4>
          <pre>{JSON.stringify(data[currentStep], null, 2)}</pre>
        </div>
      )}

      <style jsx>{`
        .lumia-flow-visualizer {
          padding: 1.5rem;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 12px;
          color: #fff;
        }

        .lumia-flow-visualizer h3 {
          margin: 0 0 1.5rem 0;
          color: #06b6d4;
          font-size: 1.25rem;
        }

        .flow-container {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          padding-bottom: 1rem;
          margin-bottom: 1.5rem;
        }

        .flow-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-shrink: 0;
        }

        .flow-step {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 8px;
          transition: all 0.3s ease;
          min-width: 150px;
        }

        .flow-step.active {
          background: rgba(6, 182, 212, 0.15);
          border-color: #06b6d4;
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.3);
        }

        .flow-step.completed {
          opacity: 0.6;
        }

        .step-icon {
          font-size: 1.5rem;
        }

        .step-content h4 {
          margin: 0;
          font-size: 0.875rem;
          color: #06b6d4;
        }

        .step-content p {
          margin: 0.25rem 0 0 0;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .arrow {
          font-size: 1.5rem;
          color: #06b6d4;
          flex-shrink: 0;
        }

        .step-details {
          padding: 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 8px;
        }

        .step-details h4 {
          margin: 0 0 0.5rem 0;
          color: #06b6d4;
        }

        .step-details pre {
          margin: 0;
          font-size: 0.75rem;
          color: #cbd5e1;
          overflow-x: auto;
        }

        @media (max-width: 768px) {
          .flow-container {
            flex-direction: column;
          }

          .flow-wrapper {
            flex-direction: column;
          }

          .arrow {
            transform: rotate(90deg);
          }
        }
      `}</style>
    </div>
  );
}
