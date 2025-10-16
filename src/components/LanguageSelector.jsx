// src/components/LanguageSelector.jsx
import React from 'react';
import { Button } from "./ui/button-enhanced.jsx";

const LANGUAGE_OPTIONS = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

export default function LanguageSelector({ selectedLanguage, onLanguageChange, showAutoDetect = true }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">🌐</div>
        <div>
          <h3 className="font-semibold text-white">Sélection de la langue</h3>
          <p className="text-gray-300 text-sm">
            Choisissez la langue de transcription ou laissez la détection automatique
          </p>
        </div>
      </div>

      {showAutoDetect && (
        <div className="flex gap-2 mb-4">
          <Button
            variant={!selectedLanguage ? "default" : "outline"}
            onClick={() => onLanguageChange(null)}
            className="flex items-center gap-2"
          >
            🔍 Détection automatique
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
        {LANGUAGE_OPTIONS.map((lang) => (
          <Button
            key={lang.code}
            variant={selectedLanguage === lang.code ? "default" : "outline"}
            onClick={() => onLanguageChange(lang.code)}
            className="flex items-center gap-2 justify-start h-auto py-3"
          >
            <span className="text-lg">{lang.flag}</span>
            <div className="text-left">
              <div className="font-medium text-sm">{lang.name}</div>
              <div className="text-xs text-gray-400">{lang.code}</div>
            </div>
          </Button>
        ))}
      </div>

      <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-blue-400">💡</span>
          <div className="text-sm text-blue-200">
            <strong>Conseil :</strong> Utilisez la détection automatique pour les vidéos multilingues ou lorsque vous n'êtes pas sûr de la langue.
          </div>
        </div>
      </div>
    </div>
  );
}
