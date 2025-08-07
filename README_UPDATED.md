# SpotBulle - Plateforme de Pitch Vidéo avec Analyse IA

## 🎯 Vue d'ensemble

SpotBulle est une plateforme moderne d'analyse de pitchs vidéo intégrant l'intelligence artificielle. Cette version repensée met l'accent sur la sécurité, la robustesse et l'expérience utilisateur professionnelle.

## ✨ Fonctionnalités Principales

### 🔒 Sécurité Renforcée
- **Gestion sécurisée des clés API** via les Edge Functions Supabase
- **Authentification robuste** avec JWT et refresh tokens
- **Validation côté serveur** pour toutes les opérations sensibles
- **Suppression du mode démo** côté client pour éviter les fausses données

### 🎨 Interface Professionnelle
- **Design system cohérent** avec palette de couleurs définie
- **Composants UI modernes** utilisant shadcn/ui
- **États de chargement élégants** avec skeletons et animations
- **Gestion d'erreurs intuitive** avec messages clairs et actions de récupération

### 🤖 Analyse IA Avancée
- **Transcription sécurisée** via OpenAI Whisper dans les Edge Functions
- **Analyse en temps réel** du contenu vidéo
- **Métriques de performance** et suggestions d'amélioration
- **Support multilingue** avec détection automatique

### 📊 Dashboard Intelligent
- **Statistiques en temps réel** sans données factices
- **Visualisations interactives** des performances
- **États vides informatifs** guidant l'utilisateur
- **Synchronisation automatique** des données

## 🛠 Stack Technique

### Frontend
- **React 18** avec hooks modernes et Context API
- **Tailwind CSS** pour le styling responsive
- **shadcn/ui** pour les composants UI professionnels
- **Framer Motion** pour les animations fluides
- **Vite** comme bundler optimisé

### Backend
- **Supabase** (PostgreSQL, Auth, Storage, Edge Functions)
- **Row Level Security (RLS)** pour la sécurité des données
- **Realtime subscriptions** pour les mises à jour en temps réel
- **Edge Functions** pour la logique métier sécurisée

### IA & APIs
- **OpenAI Whisper** pour la transcription (côté serveur uniquement)
- **GPT-4** pour l'analyse et suggestions (côté serveur uniquement)
- **Gestion sécurisée des clés** via les variables d'environnement

## 🚀 Installation et Configuration

### Prérequis
- Node.js 18+
- pnpm (recommandé)
- Compte Supabase
- Clés API OpenAI

### Installation
```bash
git clone https://github.com/basamba1990/smoovebox-v2.git
cd smoovebox-v2
pnpm install
```

### Configuration des Variables d'Environnement

#### 1. Variables Publiques (Frontend)
Créer un fichier `.env.local` :
```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_clé_anonyme_supabase
VITE_APP_NAME=SpotBulle
VITE_APP_VERSION=2.0.0
VITE_ENABLE_DEMO_MODE=false
```

#### 2. Variables Secrètes (Edge Functions)
Configurer dans Supabase CLI ou Dashboard :
```bash
supabase secrets set OPENAI_API_KEY=votre_clé_openai
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=votre_clé_service_role
```

### Déploiement des Edge Functions
```bash
supabase functions deploy transcribe-video-secure
```

### Développement
```bash
pnpm run dev
```

### Build Production
```bash
pnpm run build
```

## 📁 Structure du Projet Améliorée

```
smoovebox-v2/
├── src/
│   ├── components/
│   │   ├── ui/                    # Composants shadcn/ui
│   │   ├── EmptyState.jsx         # États vides informatifs
│   │   ├── ProfessionalHeader.jsx # Header moderne
│   │   ├── ModernTabs.jsx         # Navigation améliorée
│   │   └── ...
│   ├── lib/
│   │   └── supabase.js           # Client Supabase sécurisé
│   ├── context/
│   │   └── AuthContext.jsx       # Gestion d'authentification
│   └── App.jsx                   # Application principale
├── supabase/
│   ├── functions/
│   │   └── transcribe-video-secure/ # Transcription sécurisée
│   └── migrations/               # Schéma de base de données
├── .env.production              # Configuration de production
└── README_UPDATED.md           # Cette documentation
```

## 🔧 Améliorations Apportées

### 1. Sécurité
- ✅ Suppression de toutes les clés API du code frontend
- ✅ Migration des appels OpenAI vers les Edge Functions
- ✅ Validation d'authentification pour toutes les opérations sensibles
- ✅ Gestion sécurisée des fichiers via URLs signées

### 2. Robustesse
- ✅ Suppression du mode démo côté client
- ✅ Gestion d'erreurs complète avec retry automatique
- ✅ États de chargement et d'erreur informatifs
- ✅ Timeouts et fallbacks pour éviter les blocages

### 3. Expérience Utilisateur
- ✅ Interface moderne et professionnelle
- ✅ Navigation intuitive avec tabs améliorées
- ✅ États vides guidant l'utilisateur
- ✅ Animations et transitions fluides

### 4. Performance
- ✅ Optimisation des requêtes avec retry et cache
- ✅ Lazy loading des composants
- ✅ Bundle size optimisé
- ✅ Realtime updates efficaces

## 🔒 Sécurité et Bonnes Pratiques

### Gestion des Clés API
- **Frontend** : Seules les clés publiques (Supabase URL et Anon Key)
- **Backend** : Toutes les clés sensibles dans les Edge Functions
- **Environnement** : Variables d'environnement sécurisées

### Authentification
- **JWT tokens** avec refresh automatique
- **Row Level Security** sur toutes les tables
- **Validation côté serveur** pour toutes les opérations

### Données
- **Pas de données factices** en production
- **Validation stricte** des entrées utilisateur
- **Audit trail** des actions importantes

## 📈 Déploiement

### Vercel (Recommandé)
1. Connecter le repository GitHub à Vercel
2. Configurer les variables d'environnement dans Vercel Dashboard
3. Déployer automatiquement

### Variables d'Environnement Vercel
```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anonyme
VITE_APP_NAME=SpotBulle
VITE_APP_VERSION=2.0.0
VITE_ENABLE_DEMO_MODE=false
```

## 🧪 Tests et Qualité

### Tests Recommandés
- Tests unitaires des composants React
- Tests d'intégration des Edge Functions
- Tests E2E du parcours utilisateur
- Tests de sécurité des APIs

### Métriques de Qualité
- **Performance** : Core Web Vitals optimisées
- **Accessibilité** : WCAG 2.1 AA compliance
- **SEO** : Meta tags et structure optimisées
- **Sécurité** : Audit de sécurité régulier

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

- **Email** : support@spotbulle.fr
- **Documentation** : [docs.spotbulle.fr](https://docs.spotbulle.fr)
- **Issues** : [GitHub Issues](https://github.com/basamba1990/smoovebox-v2/issues)

---

**SpotBulle** - Révolutionnez vos pitchs avec l'IA 🚀

*Version 2.0.0 - Sécurisée et Professionnelle*

