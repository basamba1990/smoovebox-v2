import React from 'react';
import { Button } from './ui/button-enhanced.jsx';

const SUPPORTED_LANGUAGES = {
  'auto': { name: '🌐 Détection automatique', flag: '🌐' },
  'fr': { name: 'Français', flag: '🇫🇷' },
  'en': { name: 'English', flag: '🇺🇸' },
  'es': { name: 'Español', flag: '🇪🇸' },
  'ar': { name: 'العربية', flag: '🇸🇦' },
  'de': { name: 'Deutsch', flag: '🇩🇪' },
  'it': { name: 'Italiano', flag: '🇮🇹' },
  'pt': { name: 'Português', flag: '🇵🇹' },
  'ru': { name: 'Русский', flag: '🇷🇺' },
  'zh': { name: '中文', flag: '🇨🇳' },
  'ja': { name: '日本語', flag: '🇯🇵' }
};

const LanguageSelector = ({ 
  selectedLanguage, 
  onLanguageChange, 
  showAutoDetect = true,
  compact = false 
}) => {
  const languages = showAutoDetect 
    ? SUPPORTED_LANGUAGES 
    : Object.fromEntries(Object.entries(SUPPORTED_LANGUAGES).filter(([key]) => key !== 'auto'));

  return (
    <div className={`space-y-4 ${compact ? 'max-w-md' : ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">🌐</div>
        <div>
          <h3 className="font-semibold text-white text-lg">
            Sélection de la langue pour la transcription
          </h3>
          <p className="text-gray-300 text-sm">
            Choisissez la langue de votre vidéo pour une transcription plus précise
          </p>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
        {Object.entries(languages).map(([code, { name, flag }]) => (
          <Button
            key={code}
            onClick={() => onLanguageChange(code === 'auto' ? null : code)}
            variant={selectedLanguage === (code === 'auto' ? null : code) ? "default" : "outline"}
            className={`justify-start h-auto p-4 text-left transition-all ${
              selectedLanguage === (code === 'auto' ? null : code)
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{flag}</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{name}</div>
                {code === 'auto' && (
                  <div className="text-xs opacity-80 mt-1">
                    L'IA détectera automatiquement
                  </div>
                )}
              </div>
              {selectedLanguage === (code === 'auto' ? null : code) && (
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              )}
            </div>
          </Button>
        ))}
      </div>

      {selectedLanguage && (
        <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2 text-green-300 text-sm">
            <span>✅</span>
            <span>
              Langue sélectionnée: <strong>{SUPPORTED_LANGUAGES[selectedLanguage]?.name}</strong>
            </span>
          </div>
        </div>
      )}

      {!selectedLanguage && showAutoDetect && (
        <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
          <div className="flex items-center gap-2 text-blue-300 text-sm">
            <span>🔍</span>
            <span>
              <strong>Détection automatique activée</strong> - L'IA détectera la langue automatiquement
            </span>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 space-y-1">
        <p>💡 <strong>Conseil :</strong> Sélectionnez la langue pour une transcription plus précise</p>
        <p>🔄 La détection automatique fonctionne bien pour la plupart des langues</p>
      </div>
    </div>
  );
};

export default LanguageSelector;
