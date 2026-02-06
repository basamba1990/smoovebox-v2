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
      {/* Animated background blobs – centered vertically like login */}
      <div className="fixed top-50 -translate-y-1/2 -right-20 w-64 h-dvh bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
      {/* <div className="absolute top-[20%] -translate-y-1/2 -right-20 w-64 h-dvh bg-blue-500/20 rounded-full blur-3xl animate-pulse" /> */}

      {/* Header: logo + page title/subtitle */}
      <header className="relative z-10 w-full">
        <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 flex items-center justify-between gap-4`}>
          <img
            src="/Logo-2.png"
            alt="SpotBulle"
            className="w-auto h-16 sm:h-24 md:h-36"
          />
          <div className="flex-1" />
          {onSignOut && (
            <div className="flex justify-end min-w-[120px]">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-100 hover:text-teal-300 hover:bg-slate-900/60"
                onClick={onSignOut}
              >
                Se déconnecter
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 space-y-10 relative z-10`}>
        <OdysseySteps currentStep={currentStep} />
        {children}
      </div>
    </div>
  );
}

