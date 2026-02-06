// src/components/OdysseyLayout.jsx
// Shared layout shell for the Odyssée de Lumi journey pages.

import React from 'react';
import { Button } from './ui/button.jsx';
import OdysseySteps from './OdysseySteps.jsx';

/**
 * @param {Object} props
 * @param {number} props.currentStep - Id of the active odyssey step.
 * @param {string} props.title - Main page title.
 * @param {string} [props.subtitle] - Optional subtitle below the title.
 * @param {React.ReactNode} props.children - Page-specific content.
 * @param {string} [props.maxWidthClass] - Tailwind max-width class (e.g. "max-w-6xl", "max-w-4xl").
 */
export default function OdysseyLayout({
  currentStep,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-6xl',
  onSignOut,
}) {
  return (
    <div
      className="min-h-screen py-10 relative overflow-hidden"
      style={{
        backgroundImage: "url('/Fond-2.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Header: logo + page title/subtitle */}
      <header className="relative z-10 w-full">
        <div className="px-4 flex items-center justify-between gap-4">
          <img
            src="/Logo-2.png"
            alt="SpotBulle"
            className="w-auto"
            style={{ height: '150px' }}
          />
          <div className="flex-1 flex flex-col items-center text-center max-w-md">
            <h1 className="text-lg sm:text-2xl font-semibold text-white leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-white/80 text-xs sm:text-sm mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {onSignOut && (
            <div className="flex justify-end min-w-[120px]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/30 text-white hover:bg-white/10 hover:border-white/60"
                onClick={onSignOut}
              >
                Se déconnecter
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className={`${maxWidthClass} mx-auto px-4 space-y-10 relative z-10`}>
        <OdysseySteps currentStep={currentStep} />
        {children}
      </div>
    </div>
  );
}

