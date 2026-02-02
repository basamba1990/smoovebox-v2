// src/components/OdysseySteps.jsx
// Reusable Odyssey step bar for all journey pages.

import React from 'react';
import { Rocket, LayoutGrid, Video, Brain, Handshake, BookOpen, Sparkles } from 'lucide-react';

const DEFAULT_STEPS = [
  { id: 1, title: "Le sas d'accueil", Icon: Rocket },
  { id: 2, title: "Le scan des 4 éléments", Icon: LayoutGrid },
  { id: 3, title: "Le module mimétique", Icon: Video },
  { id: 4, title: "Le labo de transformation", Icon: Brain },
  { id: 5, title: "La carte galactique", Icon: Handshake },
  { id: 6, title: "Le journal de mission", Icon: BookOpen },
  { id: 7, title: "Portail vers la planète Lumi", Icon: Sparkles },
];

/**
 * @param {Object} props
 * @param {number} [props.currentStep] - Id of the active step (others appear inactive). Omit for all inactive.
 * @param {Array<{ id: number, title: string, Icon: React.ComponentType }>} [props.steps] - Custom steps (default: odyssey steps).
 * @param {string} [props.className] - Optional wrapper class.
 */
export default function OdysseySteps({ currentStep, steps = DEFAULT_STEPS, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto pb-2 ${className}`.trim()}>
      <div className="flex items-start justify-center gap-x-6 min-w-max px-4">
        {steps.map((step, index) => {
          const Icon = step.Icon;
          const isActive = currentStep != null && step.id === currentStep;
          const opacityClass = isActive ? 'opacity-100' : 'opacity-50';
          return (
            <React.Fragment key={step.id}>
              <div className={`flex flex-col items-center shrink-0 ${opacityClass}`}>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/40 bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white/70" strokeWidth={1.5} />
                </div>
                <p className="mt-2 text-center max-w-28 sm:max-w-36 text-[11px] sm:text-xs font-semibold text-white/80 leading-tight">
                  {step.title}
                </p>
              </div>
              {/* {index < steps.length - 1 && (
                <div
                  className="w-4 sm:w-8 h-0.5 bg-white/30 rounded self-[1.75rem] sm:self-[1.875rem] shrink-0"
                  aria-hidden
                />
              )} */}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
