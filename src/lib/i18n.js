// src/lib/i18n.js - Système multilingue simplifié
class I18n {
  constructor() {
    this.currentLanguage = 'fr';
    this.translations = {
      fr: {
        welcome: "Bienvenue sur SpotBulle",
        record: "Enregistrer une Vidéo",
        dashboard: "Tableau de Bord",
        profile: "Profil",
        community: "Communauté",
        analysis: "Analyse",
        recording: "Enregistrement en cours...",
        processing: "Traitement de votre vidéo",
        analysisComplete: "Analyse terminée !",
        uploading: "Téléchargement en cours...",
        compression: "Compression de la vidéo...",
        sentiment: "Sentiment",
        keyTopics: "Thèmes principaux",
        communicationTips: "Conseils de communication",
        toneAnalysis: "Analyse du ton",
        emotion: "Émotion",
        pace: "Débit",
        clarity: "Clarté",
        errorUpload: "Erreur lors de l'upload",
        errorAnalysis: "Erreur d'analyse",
        errorCamera: "Erreur d'accès à la caméra",
        retry: "Réessayer",
        tags: "Mots-clés",
        tagsPlaceholder: "Ajouter des mots-clés...",
        recordingTips: "Conseils d'enregistrement",
        useAvatar: "Utiliser un avatar virtuel",
        language: "Langue",
        autoDetect: "Détection automatique"
      },
      ar: {
        welcome: "مرحبا بكم في سبوتبول",
        record: "تسجيل فيديو",
        dashboard: "لوحة التحكم",
        profile: "الملف الشخصي",
        community: "community",
        analysis: "تحليل",
        recording: "جاري التسجيل...",
        processing: "جاري معالجة الفيديو",
        analysisComplete: "اكتمل التحليل!",
        uploading: "جاري التحميل...",
        compression: "جاري ضغط الفيديو...",
        sentiment: "المشاعر",
        keyTopics: "المواضيع الرئيسية",
        communicationTips: "نصائح التواصل",
        toneAnalysis: "تحليل النبرة",
        emotion: "المشاعر",
        pace: "السرعة",
        clarity: "الوضوح",
        errorUpload: "خطأ في رفع الفيديو",
        errorAnalysis: "خطأ في التحليل",
        errorCamera: "خطأ في الوصول للكاميرا",
        retry: "إعادة المحاولة",
        tags: "الكلمات المفتاحية",
        tagsPlaceholder: "إضافة كلمات مفتاحية...",
        recordingTips: "نصائح التسجيل",
        useAvatar: "استخدم الصورة الرمزية الافتراضية",
        language: "اللغة",
        autoDetect: "الكشف التلقائي"
      },
      en: {
        welcome: "Welcome to SpotBulle",
        record: "Record Video",
        dashboard: "Dashboard",
        profile: "Profile",
        community: "Community",
        analysis: "Analysis",
        recording: "Recording...",
        processing: "Processing your video",
        analysisComplete: "Analysis complete!",
        uploading: "Uploading...",
        compression: "Compressing video...",
        sentiment: "Sentiment",
        keyTopics: "Key topics",
        communicationTips: "Communication tips",
        toneAnalysis: "Tone analysis",
        emotion: "Emotion",
        pace: "Pace",
        clarity: "Clarity",
        errorUpload: "Upload error",
        errorAnalysis: "Analysis error",
        errorCamera: "Camera access error",
        retry: "Retry",
        tags: "Tags",
        tagsPlaceholder: "Add tags...",
        recordingTips: "Recording tips",
        useAvatar: "Use virtual avatar",
        language: "Language",
        autoDetect: "Auto detect"
      }
    };
    
    this.init();
  }

  init() {
    // Récupérer la langue sauvegardée ou détecter
    const savedLang = localStorage.getItem('spotbulle-lang');
    if (savedLang && this.translations[savedLang]) {
      this.currentLanguage = savedLang;
    } else {
      this.currentLanguage = this.detectBrowserLanguage();
    }
    
    this.applyLanguageDirection();
  }

  detectBrowserLanguage() {
    const browserLang = navigator.language.split('-')[0];
    return this.translations[browserLang] ? browserLang : 'fr';
  }

  applyLanguageDirection() {
    document.documentElement.dir = this.currentLanguage === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = this.currentLanguage;
  }

  t(key, params = {}) {
    let translation = this.translations[this.currentLanguage]?.[key] || 
                     this.translations['fr'][key] || 
                     key;

    // Remplacer les paramètres
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{{${param}}}`, params[param]);
    });

    return translation;
  }

  changeLanguage(lng) {
    if (this.translations[lng]) {
      this.currentLanguage = lng;
      localStorage.setItem('spotbulle-lang', lng);
      this.applyLanguageDirection();
      
      // Déclencher un événement pour notifier du changement
      window.dispatchEvent(new Event('languageChanged'));
      
      return true;
    }
    return false;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  isRTL() {
    return this.currentLanguage === 'ar';
  }

  // Détection de langue basée sur le texte
  detectLanguageFromText(text) {
    if (!text) return this.currentLanguage;

    const scores = {
      'fr': (text.match(/\b(le|la|les|de|des|du|et|est|dans|pour)\b/gi) || []).length,
      'ar': (text.match(/[\u0600-\u06FF]/g) || []).length,
      'en': (text.match(/\b(the|and|is|in|to|of|a|that|it|with)\b/gi) || []).length
    };

    const detectedLang = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );

    return scores[detectedLang] > 2 ? detectedLang : this.currentLanguage;
  }
}

// Instance singleton
export const i18n = new I18n();

// Hook React personnalisé
export const useTranslation = () => {
  const [_, forceUpdate] = React.useState(0);

  React.useEffect(() => {
    const handleLanguageChange = () => {
      forceUpdate(n => n + 1);
    };

    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, []);

  return {
    t: i18n.t.bind(i18n),
    i18n: i18n,
    ready: true
  };
};

export default i18n;
