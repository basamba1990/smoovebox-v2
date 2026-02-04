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
    <div className={`w-full overflow-x-auto pb-2 ${className}`.trim()}>
      <div className="flex items-start justify-center gap-x-6 min-w-max px-4">
        {steps.map((step, index) => {
          const Icon = step.Icon;
          const isActive = currentStep != null && step.id === currentStep;
          const opacityClass = isActive ? 'opacity-100' : 'opacity-50';
          const isClickable = step.id <= 4 && Boolean(step.path);

          const StepInner = (
            <>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-white/40 bg-white/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white/70" strokeWidth={1.5} />
              </div>
              <p
                className={[
                  'mt-2 text-center max-w-28 sm:max-w-36 text-[11px] sm:text-xs font-semibold leading-tight',
                  isClickable ? 'text-white/90 hover:underline hover:underline-offset-4' : 'text-white/80',
                ].join(' ')}
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
                  className={[
                    'flex flex-col items-center shrink-0',
                    opacityClass,
                    'cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-lg px-1',
                  ].join(' ')}
                >
                  {StepInner}
                </Link>
              ) : (
                <div className={`flex flex-col items-center shrink-0 ${opacityClass}`}>
                  {StepInner}
                </div>
              )}
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
