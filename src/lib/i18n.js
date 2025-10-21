// src/lib/i18n.js - Système multilingue avancé
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { toast } from 'sonner';

// Ressources de traduction étendues
const resources = {
  fr: {
    translation: {
      // Navigation
      welcome: "Bienvenue sur SpotBulle",
      record: "Enregistrer une Vidéo",
      dashboard: "Tableau de Bord",
      profile: "Profil",
      community: "Communauté",
      analysis: "Analyse",
      
      // États d'enregistrement
      recording: "Enregistrement en cours...",
      processing: "Traitement de votre vidéo",
      analysisComplete: "Analyse terminée !",
      uploading: "Téléchargement en cours...",
      compression: "Compression de la vidéo...",
      
      // Phrases pour l'analyse
      sentiment: "Sentiment",
      keyTopics: "Thèmes principaux",
      communicationTips: "Conseils de communication",
      toneAnalysis: "Analyse du ton",
      emotion: "Émotion",
      pace: "Débit",
      clarity: "Clarté",
      
      // Messages d'erreur
      errorUpload: "Erreur lors de l'upload",
      errorAnalysis: "Erreur d'analyse",
      errorCamera: "Erreur d'accès à la caméra",
      retry: "Réessayer",
      
      // Tags et mots-clés
      tags: "Mots-clés",
      tagsPlaceholder: "Ajouter des mots-clés...",
      tagsDescription: "Ajoutez des mots-clés pertinents pour les rapprochements automatiques",
      
      // Conseils
      recordingTips: "Conseils d'enregistrement",
      tipLighting: "Utilisez un bon éclairage",
      tipBackground: "Fond neutre recommandé",
      tipSmile: "Souriez et soyez naturel",
      tipDuration: "2 minutes maximum recommandées",
      
      // Avatar
      useAvatar: "Utiliser un avatar virtuel",
      avatarDescription: "Remplacer votre apparence par un avatar",
      
      // Langues
      language: "Langue",
      autoDetect: "Détection automatique",
      french: "Français",
      arabic: "Arabe",
      english: "Anglais",
      spanish: "Espagnol",
      german: "Allemand",
      italian: "Italien",
      portuguese: "Portugais"
    }
  },
  ar: {
    translation: {
      // Navigation
      welcome: "مرحبا بكم في سبوتبول",
      record: "تسجيل فيديو", 
      dashboard: "لوحة التحكم",
      profile: "الملف الشخصي",
      community: "community",
      analysis: "تحليل",
      
      // États d'enregistrement
      recording: "جاري التسجيل...",
      processing: "جاري معالجة الفيديو",
      analysisComplete: "اكتمل التحليل!",
      uploading: "جاري التحميل...",
      compression: "جاري ضغط الفيديو...",
      
      // Phrases pour l'analyse
      sentiment: "المشاعر",
      keyTopics: "المواضيع الرئيسية",
      communicationTips: "نصائح التواصل",
      toneAnalysis: "تحليل النبرة",
      emotion: "المشاعر",
      pace: "السرعة",
      clarity: "الوضوح",
      
      // Messages d'erreur
      errorUpload: "خطأ في رفع الفيديو",
      errorAnalysis: "خطأ في التحليل",
      errorCamera: "خطأ في الوصول للكاميرا",
      retry: "إعادة المحاولة",
      
      // Tags et mots-clés
      tags: "الكلمات المفتاحية",
      tagsPlaceholder: "إضافة كلمات مفتاحية...",
      tagsDescription: "أضف كلمات مفتاحية ذات صلة للمطابقات التلقائية",
      
      // Conseils
      recordingTips: "نصائح التسجيل",
      tipLighting: "استخدم إضاءة جيدة",
      tipBackground: "خلفية محايدة موصى بها",
      tipSmile: "ابتسم وكن طبيعياً",
      tipDuration: "دقيقتان كحد أقصى موصى به",
      
      // Avatar
      useAvatar: "استخدم الصورة الرمزية الافتراضية",
      avatarDescription: "استبدل مظهرك بصورة رمزية",
      
      // Langues
      language: "اللغة",
      autoDetect: "الكشف التلقائي",
      french: "الفرنسية",
      arabic: "العربية",
      english: "الإنجليزية",
      spanish: "الإسبانية",
      german: "الألمانية",
      italian: "الإيطالية",
      portuguese: "البرتغالية"
    }
  },
  en: {
    translation: {
      // Navigation
      welcome: "Welcome to SpotBulle",
      record: "Record Video",
      dashboard: "Dashboard",
      profile: "Profile",
      community: "Community",
      analysis: "Analysis",
      
      // États d'enregistrement
      recording: "Recording...",
      processing: "Processing your video",
      analysisComplete: "Analysis complete!",
      uploading: "Uploading...",
      compression: "Compressing video...",
      
      // Phrases pour l'analyse
      sentiment: "Sentiment",
      keyTopics: "Key topics",
      communicationTips: "Communication tips",
      toneAnalysis: "Tone analysis",
      emotion: "Emotion",
      pace: "Pace",
      clarity: "Clarity",
      
      // Messages d'erreur
      errorUpload: "Upload error",
      errorAnalysis: "Analysis error",
      errorCamera: "Camera access error",
      retry: "Retry",
      
      // Tags et mots-clés
      tags: "Tags",
      tagsPlaceholder: "Add tags...",
      tagsDescription: "Add relevant tags for automatic matching",
      
      // Conseils
      recordingTips: "Recording tips",
      tipLighting: "Use good lighting",
      tipBackground: "Neutral background recommended",
      tipSmile: "Smile and be natural",
      tipDuration: "2 minutes maximum recommended",
      
      // Avatar
      useAvatar: "Use virtual avatar",
      avatarDescription: "Replace your appearance with an avatar",
      
      // Langues
      language: "Language",
      autoDetect: "Auto detect",
      french: "French",
      arabic: "Arabic",
      english: "English",
      spanish: "Spanish",
      german: "German",
      italian: "Italian",
      portuguese: "Portuguese"
    }
  },
  es: {
    translation: {
      welcome: "Bienvenido a SpotBulle",
      record: "Grabar Video",
      dashboard: "Panel de Control",
      profile: "Perfil",
      community: "Comunidad",
      analysis: "Análisis",
      recording: "Grabando...",
      processing: "Procesando tu video",
      analysisComplete: "¡Análisis completado!",
      errorUpload: "Error al subir",
      errorAnalysis: "Error de análisis",
      retry: "Reintentar"
    }
  },
  de: {
    translation: {
      welcome: "Willkommen bei SpotBulle",
      record: "Video Aufnehmen",
      dashboard: "Dashboard",
      profile: "Profil",
      community: "Community",
      analysis: "Analyse",
      recording: "Aufnahme...",
      processing: "Verarbeite dein Video",
      analysisComplete: "Analyse abgeschlossen!",
      errorUpload: "Upload Fehler",
      errorAnalysis: "Analyse Fehler",
      retry: "Erneut versuchen"
    }
  },
  it: {
    translation: {
      welcome: "Benvenuto su SpotBulle",
      record: "Registra Video",
      dashboard: "Dashboard",
      profile: "Profilo",
      community: "Community",
      analysis: "Analisi",
      recording: "Registrazione...",
      processing: "Elaborazione video",
      analysisComplete: "Analisi completata!",
      errorUpload: "Errore caricamento",
      errorAnalysis: "Errore analisi",
      retry: "Riprova"
    }
  },
  pt: {
    translation: {
      welcome: "Bem-vindo ao SpotBulle",
      record: "Gravar Vídeo",
      dashboard: "Painel",
      profile: "Perfil",
      community: "Comunidade",
      analysis: "Análise",
      recording: "Gravando...",
      processing: "Processando seu vídeo",
      analysisComplete: "Análise concluída!",
      errorUpload: "Erro no upload",
      errorAnalysis: "Erro de análise",
      retry: "Tentar novamente"
    }
  }
};

// Détection automatique de la langue
const detectLanguage = async () => {
  try {
    // 1. Vérifier la préférence sauvegardée
    const savedLang = localStorage.getItem('spotbulle-lang');
    if (savedLang && resources[savedLang]) return savedLang;

    // 2. Détection navigateur
    const browserLang = navigator.language.split('-')[0];
    if (resources[browserLang]) return browserLang;

    // 3. Fallback français
    return 'fr';
  } catch (error) {
    return 'fr';
  }
};

// Initialisation i18n
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr', // Langue par défaut
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    },
    react: {
      useSuspense: false
    }
  });

// Hook personnalisé pour la gestion des langues
export const useLanguage = () => {
  const changeLanguage = async (lng) => {
    try {
      await i18n.changeLanguage(lng);
      localStorage.setItem('spotbulle-lang', lng);
      
      // Mettre à jour la direction du document pour RTL
      document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lng;
      
      toast.success(i18n.t('language') + `: ${i18n.t(lng)}`);
    } catch (error) {
      console.error('Erreur changement langue:', error);
    }
  };

  const detectUserLanguage = async (userText = '') => {
    if (!userText) return i18n.language;

    try {
      // Logique de détection basique basée sur le texte
      const text = userText.toLowerCase();
      
      // Détection par mots-clés
      const languageScores = {
        'fr': (text.match(/\b(le|la|les|de|des|du|et|est|dans|pour)\b/g) || []).length,
        'ar': (text.match(/[\u0600-\u06FF]/g) || []).length, // Caractères arabes
        'en': (text.match(/\b(the|and|is|in|to|of|a|that|it|with)\b/g) || []).length,
        'es': (text.match(/\b(el|la|de|que|y|en|un|es|se|no)\b/g) || []).length,
        'de': (text.match(/\b(der|die|das|und|in|den|von|zu|ist|sich)\b/g) || []).length,
        'it': (text.match(/\b(il|la|di|e|in|che|non|per|un|una)\b/g) || []).length,
        'pt': (text.match(/\b(o|a|de|e|do|da|em|um|para|com)\b/g) || []).length
      };

      // Trouver la langue avec le score le plus élevé
      const detectedLang = Object.keys(languageScores).reduce((a, b) => 
        languageScores[a] > languageScores[b] ? a : b
      );

      // Changer seulement si la détection est fiable
      if (languageScores[detectedLang] > 2 && resources[detectedLang]) {
        await changeLanguage(detectedLang);
        return detectedLang;
      }
    } catch (error) {
      console.warn('Détection langue échouée, utilisation par défaut');
    }

    return i18n.language;
  };

  return {
    currentLanguage: i18n.language,
    changeLanguage,
    detectUserLanguage,
    isRTL: i18n.language === 'ar',
    t: i18n.t
  };
};

// Export des traductions pour usage externe
export const getTranslations = (lang = 'fr') => {
  return resources[lang]?.translation || resources.fr.translation;
};

export default i18n;
