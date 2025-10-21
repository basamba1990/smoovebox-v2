// src/components/LanguageSelector.jsx
import React from 'react';
import { Button } from "./ui/button-enhanced.jsx";
import { useLanguage } from '../lib/i18n';

const LANGUAGE_OPTIONS = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'ar', name: 'Arabe', flag: '🇸🇦', nativeName: 'العربية' },
  { code: 'en', name: 'English', flag: '🇺🇸', nativeName: 'English' },
  { code: 'es', name: 'Español', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'pt', name: 'Português', flag: '🇵🇹', nativeName: 'Português' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'zh', name: '中文', flag: '🇨🇳', nativeName: '中文' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', nativeName: '한국어' }
];

export default function LanguageSelector({ 
  selectedLanguage, 
  onLanguageChange, 
  showAutoDetect = true,
  compact = false,
  showFlags = true 
}) {
  const { currentLanguage, isRTL } = useLanguage();

  const handleLanguageSelect = (langCode) => {
    onLanguageChange(langCode);
  };

  const handleAutoDetect = () => {
    onLanguageChange(null);
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {showAutoDetect && (
            <Button
              variant={!selectedLanguage ? "default" : "outline"}
              onClick={handleAutoDetect}
              className="flex items-center gap-1 text-xs px-2 py-1 h-auto"
              size="sm"
            >
              <span>🔍</span>
              <span>Auto</span>
            </Button>
          )}
          
          {LANGUAGE_OPTIONS.slice(0, 6).map((lang) => (
            <Button
              key={lang.code}
              variant={selectedLanguage === lang.code ? "default" : "outline"}
              onClick={() => handleLanguageSelect(lang.code)}
              className="flex items-center gap-1 text-xs px-2 py-1 h-auto min-w-[60px]"
              size="sm"
            >
              {showFlags && <span className="text-xs">{lang.flag}</span>}
              <span>{lang.code.toUpperCase()}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">🌐</div>
        <div>
          <h3 className="font-semibold text-white">
            {currentLanguage === 'ar' ? 'اختيار اللغة' : 'Sélection de la langue'}
          </h3>
          <p className="text-gray-300 text-sm">
            {currentLanguage === 'ar' 
              ? 'اختر لغة التفريغ أو اترك الكشف التلقائي'
              : 'Choisissez la langue de transcription ou laissez la détection automatique'
            }
          </p>
        </div>
      </div>

      {showAutoDetect && (
        <div className="flex gap-2 mb-4">
          <Button
            variant={!selectedLanguage ? "default" : "outline"}
            onClick={handleAutoDetect}
            className="flex items-center gap-2"
          >
            <span>🔍</span>
            <span>
              {currentLanguage === 'ar' ? 'الكشف التلقائي' : 'Détection automatique'}
            </span>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
        {LANGUAGE_OPTIONS.map((lang) => (
          <Button
            key={lang.code}
            variant={selectedLanguage === lang.code ? "default" : "outline"}
            onClick={() => handleLanguageSelect(lang.code)}
            className={`flex items-center gap-2 justify-start h-auto py-3 ${
              isRTL ? 'flex-row-reverse' : ''
            }`}
          >
            {showFlags && <span className="text-lg">{lang.flag}</span>}
            <div className={`text-left ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="font-medium text-sm">
                {currentLanguage === 'ar' ? lang.nativeName : lang.name}
              </div>
              <div className="text-xs text-gray-400">{lang.code}</div>
            </div>
          </Button>
        ))}
      </div>

      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
        <div className={`flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-blue-400">💡</span>
          <div className="text-sm text-blue-200">
            {currentLanguage === 'ar' ? (
              <>
                <strong>نصيحة:</strong> استخدم الكشف التلقائي للفيديوهات متعددة اللغات أو عندما لست متأكداً من اللغة.
              </>
            ) : (
              <>
                <strong>Conseil :</strong> Utilisez la détection automatique pour les vidéos multilingues ou lorsque vous n'êtes pas sûr de la langue.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Affichage de la langue actuellement sélectionnée */}
      {selectedLanguage && (
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-3">
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-green-400">✓</span>
            <div className="text-sm text-green-200">
              {currentLanguage === 'ar' ? (
                <>
                  <strong>اللغة المحددة:</strong> {LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.nativeName}
                </>
              ) : (
                <>
                  <strong>Langue sélectionnée:</strong> {LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Composant de sélection de langue compact pour les en-têtes
export function CompactLanguageSelector({ selectedLanguage, onLanguageChange }) {
  const { currentLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedLanguage || 'auto'}
        onChange={(e) => onLanguageChange(e.target.value === 'auto' ? null : e.target.value)}
        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="auto">
          {currentLanguage === 'ar' ? 'تلقائي' : 'Auto'}
        </option>
        {LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {showFlags && lang.flag} {currentLanguage === 'ar' ? lang.nativeName : lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
