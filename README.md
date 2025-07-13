# Smoovebox v2.0 - Plateforme de Pitch Vidéo Moderne

## 🎯 Vue d'ensemble

Smoovebox v2.0 est une plateforme moderne de pitch vidéo intégrant l'intelligence artificielle pour l'analyse et l'amélioration des présentations. Cette version repense complètement l'architecture avec des technologies modernes et des fonctionnalités avancées.

## ✨ Fonctionnalités Principales

### 📱 Upload Vidéo Mobile Optimisé
- **Compression automatique** avec FFmpeg
- **Validation stricte** : max 50 Mo, 2 minutes
- **Interface responsive** pour mobile et desktop
- **Progression en temps réel** de l'upload

### 🤖 Analyse IA Avancée
- **Transcription automatique** via OpenAI Whisper
- **Suggestions personnalisées** avec GPT-4
- **Analyse du sentiment** et métriques de performance
- **Timestamps précis** pour navigation

### 📊 Dashboard Complet
- **Statistiques détaillées** (vues, likes, followers)
- **Gestion des vidéos** avec statuts
- **Activité communautaire** en temps réel
- **Tendances** et recommandations

### 🌐 Réseau Social Intégré
- **Système de followers** et interactions
- **Commentaires et likes** sur les vidéos
- **Feed personnalisé** avec algorithme
- **Notifications temps réel**

## 🛠 Stack Technique

### Frontend
- **React 18** avec hooks modernes
- **Tailwind CSS** pour le styling
- **shadcn/ui** pour les composants
- **Lucide React** pour les icônes
- **Vite** comme bundler

### Backend (Prévu)
- **Supabase** (PostgreSQL, Auth, Storage)
- **Edge Functions** pour le traitement
- **Row Level Security** (RLS)
- **Realtime subscriptions**

### IA & APIs
- **OpenAI Whisper** pour la transcription
- **GPT-4** pour l'analyse et suggestions
- **FFmpeg** pour la compression vidéo

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+
- pnpm (recommandé)

### Installation
```bash
cd smoovebox-v2
pnpm install
```

### Développement
```bash
pnpm run dev
```
L'application sera accessible sur `http://localhost:5173`

### Build Production
```bash
pnpm run build
pnpm run preview
```

## 📁 Structure du Projet

```
smoovebox-v2/
├── src/
│   ├── components/           # Composants React
│   │   ├── ui/              # Composants UI (shadcn)
│   │   ├── UploadVideoMobile.jsx
│   │   ├── TranscriptionViewer.jsx
│   │   └── Dashboard.jsx
│   ├── lib/                 # Utilitaires
│   │   └── supabase.js      # Client Supabase
│   ├── App.jsx              # Composant principal
│   └── main.jsx             # Point d'entrée
├── public/                  # Assets statiques
└── package.json
```

## 🔧 Configuration

### Variables d'environnement
Créez un fichier `.env.local` :
```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_clé_anonyme
VITE_OPENAI_API_KEY=votre_clé_openai
```

### Supabase Setup
1. Créer un projet Supabase
2. Configurer les buckets de stockage
3. Activer RLS sur les tables
4. Déployer les Edge Functions

## 📋 Fonctionnalités Implémentées

### ✅ Complétées
- [x] Interface utilisateur moderne et responsive
- [x] Composant d'upload vidéo avec validation
- [x] Visualiseur de transcription avec timestamps
- [x] Dashboard avec statistiques
- [x] Système de tabs pour navigation
- [x] Intégration des composants shadcn/ui

### 🚧 En Cours
- [ ] Intégration Supabase réelle
- [ ] Compression vidéo avec FFmpeg
- [ ] API Whisper pour transcription
- [ ] Analyse GPT-4 en temps réel

### 📅 Roadmap
- [ ] Tests psychotechniques (4 couleurs)
- [ ] Système de notifications
- [ ] Mode sombre
- [ ] Application mobile React Native
- [ ] Analytics avancées

## 🎨 Design System

### Couleurs
- **Primary**: Bleu (#3B82F6)
- **Secondary**: Gris (#6B7280)
- **Success**: Vert (#10B981)
- **Warning**: Orange (#F59E0B)
- **Error**: Rouge (#EF4444)

### Composants
Utilisation de shadcn/ui pour la cohérence :
- `Button`, `Card`, `Badge`
- `Tabs`, `Progress`, `Input`
- Système de thème avec CSS variables

## 🔒 Sécurité

### Authentification
- JWT tokens via Supabase Auth
- Refresh tokens automatiques
- Protection des routes sensibles

### Upload Sécurisé
- Validation côté client et serveur
- Scan antivirus des fichiers
- Limitation de taille et format

### Données
- Chiffrement des transcriptions
- Politiques RLS strictes
- Audit trail des actions

## 📈 Performance

### Optimisations
- **Lazy loading** des composants
- **Compression d'images** automatique
- **CDN** pour les assets statiques
- **Mise en cache** intelligente

### Métriques
- **Core Web Vitals** optimisées
- **Bundle size** < 500KB
- **Time to Interactive** < 3s

## 🧪 Tests

### Tests Unitaires
```bash
pnpm run test
```

### Tests E2E
```bash
pnpm run test:e2e
```

### Couverture
```bash
pnpm run test:coverage
```

## 🚀 Déploiement

### Vercel (Recommandé)
```bash
vercel --prod
```

### Netlify
```bash
netlify deploy --prod
```

### Docker
```bash
docker build -t smoovebox-v2 .
docker run -p 3000:3000 smoovebox-v2
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

- **Email**: support@smoovebox.com
- **Documentation**: [docs.smoovebox.com](https://docs.smoovebox.com)
- **Issues**: [GitHub Issues](https://github.com/smoovebox/smoovebox-v2/issues)

---

**Smoovebox v2.0** - Révolutionnez vos pitchs avec l'IA 🚀

