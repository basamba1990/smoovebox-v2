// src/components/OdysseyLayout.jsx
// Shared layout shell for the Odyssée de Lumi journey pages.

import React from 'react';
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
      {/* Top-right accent: Tache.png + page title and subtitle (hidden on small screens via CSS media query) */}
      <div
        className="tache-desktop-only absolute top-0 right-0 z-20 flex flex-col items-center justify-start text-center opacity-95"
        style={{
          width: '700px',
          height: '700px',
          paddingTop: '80px',
          backgroundImage: "url('/Tache.png')",
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
        }}
      >
        <h1
          className="text-2xl md:text-3xl font-semibold text-white leading-tight"
          style={{ width: '360px' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-white/90 text-sm md:text-base mt-2 max-w-md">
            {subtitle}
          </p>
        )}
      </div>

      {/* Full-width header bar; logo on the left, no width constraint on parent */}
      <header className="relative z-10 w-full">
        <div className="px-4 flex items-center justify-between">
          <img
            src="/Logo-2.png"
            alt="SpotBulle"
            className="w-auto"
            style={{ height: '150px' }}
          />
          {/* Right side reserved for future actions (profile, status, etc.) */}
        </div>
      </header>

      <div className={`${maxWidthClass} mx-auto px-4 space-y-10 relative z-10`}>
        <OdysseySteps currentStep={currentStep} />

        {/* Mobile/tablet title block (shown when Tache accent is hidden, below md, just above page description/content) */}
        <div className="md:hidden text-center mb-6">
          <h1 className="text-2xl font-semibold text-white leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/90 text-sm mt-2 max-w-md mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

