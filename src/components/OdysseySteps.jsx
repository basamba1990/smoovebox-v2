// src/components/OdysseySteps.jsx
// Reusable Odyssey step bar for all journey pages.

import React from 'react';
import { Link } from 'react-router-dom';
import { ODYSSEY_STEPS } from '../config/odysseyConfig.js';

/**
 * @param {Object} props
 * @param {number} [props.currentStep] - Id of the active step (others appear inactive). Omit for all inactive.
 * @param {Array<{ id: number, title: string, Icon: React.ComponentType }>} [props.steps] - Custom steps (default: odyssey config).
 * @param {string} [props.className] - Optional wrapper class.
 */
export default function OdysseySteps({ currentStep, steps = ODYSSEY_STEPS, className = '' }) {
  return (
    <div className={`w-full overflow-x-auto pb-4 ${className}`.trim()}>
      <div className="flex items-start justify-center gap-x-8 min-w-max px-4">
        {steps.map((step, index) => {
          const Icon = step.Icon;
          const isActive = currentStep != null && step.id === currentStep;
          const isClickable = step.id <= 5 && Boolean(step.path);

          const StepInner = (
            <>
              <div className={`
                w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500
                ${isActive 
                  ? 'bg-teal-500/20 border-2 border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.3)] animate-glow-pulse' 
                  : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'}
              `}>
                <Icon className={`
                  w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-500
                  ${isActive ? 'text-teal-400' : 'text-white/40'}
                `} strokeWidth={isActive ? 2 : 1.5} />
              </div>
              <p
                className={`
                  mt-3 text-center max-w-28 sm:max-w-36 text-[11px] sm:text-xs font-bold leading-tight transition-all duration-500
                  ${isActive ? 'text-teal-400 scale-105' : 'text-white/40'}
                  ${isClickable && !isActive ? 'hover:text-white/80' : ''}
                `}
              >
                {step.title}
              </p>
            </>
          );

          return (
            <React.Fragment key={step.id}>
              {isClickable ? (
                <Link
                  to={step.path}
                  aria-current={isActive ? 'step' : undefined}
                  className={`
                    flex flex-col items-center shrink-0 cursor-pointer transition-all duration-300
                    ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
                    focus:outline-none rounded-2xl
                  `}
                >
                  {StepInner}
                </Link>
              ) : (
                <div className={`flex flex-col items-center shrink-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                  {StepInner}
                </div>
              )}
              
              {index < steps.length - 1 && (
                <div
                  className={`
                    w-6 sm:w-10 h-[2px] rounded-full self-[1.75rem] sm:self-[2rem] shrink-0 transition-colors duration-500
                    ${step.id < currentStep ? 'bg-teal-500/50' : 'bg-white/10'}
                  `}
                  aria-hidden
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
