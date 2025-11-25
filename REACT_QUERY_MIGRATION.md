# Migration vers React Query (TanStack Query)

## 📋 Résumé de la tâche

Nous avons effectué une migration complète de la gestion d'état serveur vers React Query (TanStack Query) dans l'application SpotBulle. Cette migration améliore les performances, réduit la complexité du code et standardise la gestion des données serveur dans toute l'application.

## 🎯 Objectif

L'application utilisait auparavant une gestion manuelle de l'état serveur avec `useState`, `useEffect` et des fonctions de récupération personnalisées. Cette approche présentait plusieurs problèmes :
- **Duplication de code** : Chaque composant réimplémentait la même logique de chargement
- **Pas de cache** : Les mêmes données étaient récupérées plusieurs fois
- **Gestion d'erreur incohérente** : Chaque composant gérait les erreurs différemment
- **Pas de refetch automatique** : Les données ne se mettaient pas à jour automatiquement

L'objectif était de :
- **Centraliser la gestion des données serveur** avec React Query
- **Réduire la duplication de code** en créant des hooks réutilisables
- **Améliorer les performances** avec le cache automatique
- **Standardiser la gestion des erreurs** et des états de chargement

## 🔧 Ce qui a été fait

### 1. Installation et configuration de React Query

**Fichier modifié :** `src/App.jsx`

- Ajout de `@tanstack/react-query` dans les dépendances
- Création d'une instance `QueryClient` avec configuration par défaut
- Ajout du `QueryClientProvider` pour envelopper l'application

**Configuration :**
- **Stale time** : 5 minutes (les données restent fraîches pendant 5 min)
- **Cache time** : 10 minutes (les données restent en cache 10 min après utilisation)
- **Retry** : 3 tentatives avec backoff exponentiel
- **Refetch automatique** : sur focus de fenêtre, reconnexion, et montage

### 2. Création de hooks personnalisés

**4 nouveaux hooks créés :**

#### `src/hooks/useVideos.js`
- Hook pour récupérer les vidéos de l'utilisateur
- Utilisé par : Dashboard, VideoPicker, SimplifiedHome, App.jsx
- **Avant** : Chaque composant récupérait les vidéos séparément
- **Après** : Un seul hook partagé avec cache automatique

#### `src/hooks/useDirectory.js`
- `useDirectoryUsers()` : Récupère les utilisateurs avec filtres et recherche
- `useExistingConnections()` : Récupère les connexions existantes
- `useUserVideos()` : Récupère les vidéos utilisateur pour le répertoire
- Utilisé par : `directory.jsx`

#### `src/hooks/useVideoManagement.js`
- `useVideoManagementVideos()` : Récupère toutes les vidéos avec tous les champs
- `useVideoStats()` : Récupère les statistiques vidéo depuis l'Edge Function
- Utilisé par : `VideoManagement.jsx`

#### `src/hooks/useSeminars.js`
- `useSeminars()` : Récupère tous les séminaires
- `useUserSeminarInscriptions()` : Récupère les inscriptions de l'utilisateur
- Utilisé par : `SeminarsList.jsx`

### 3. Migration des composants

**7 composants migrés :**

#### ✅ Dashboard.jsx
- **Avant** : `useState` pour videos, loading, error + `fetchVideos()` + `useEffect`
- **Après** : `useVideos()` hook + `useQueryClient` pour invalidation
- **Code supprimé** : ~30 lignes de boilerplate

#### ✅ directory.jsx
- **Avant** : 3 fonctions de fetch séparées (`fetchUsers`, `fetchExistingConnections`, `fetchUserVideos`)
- **Après** : 3 hooks React Query (`useDirectoryUsers`, `useExistingConnections`, `useUserVideos`)
- **Code supprimé** : ~80 lignes de boilerplate

#### ✅ VideoManagement.jsx
- **Avant** : `fetchVideos()` et `fetchStats()` avec gestion manuelle
- **Après** : `useVideoManagementVideos()` et `useVideoStats()` hooks
- **Code supprimé** : ~100 lignes de boilerplate

#### ✅ SeminarsList.jsx
- **Avant** : `fetchSeminars()` et `fetchUserInscriptions()` avec `useEffect`
- **Après** : `useSeminars()` et `useUserSeminarInscriptions()` hooks
- **Code supprimé** : ~50 lignes de boilerplate

#### ✅ VideoPicker.jsx
- **Avant** : `fetchVideos()` avec `useEffect`
- **Après** : Réutilise `useVideos()` hook (partage le cache avec Dashboard)
- **Code supprimé** : ~40 lignes de boilerplate

#### ✅ SimplifiedHome.jsx
- **Avant** : `loadUserStats()` qui récupérait les vidéos et calculait les stats
- **Après** : `useVideos()` hook + `useMemo` pour calculer les stats
- **Code supprimé** : ~35 lignes de boilerplate

#### ✅ App.jsx
- **Avant** : `loadDashboardData()` qui récupérait les vidéos et calculait les stats
- **Après** : `useVideos()` hook + `useMemo` pour calculer les stats
- **Code supprimé** : ~60 lignes de boilerplate

## 📊 Résultats

### Avant
- **7 composants** avec gestion manuelle de l'état
- **~350+ lignes** de code boilerplate (useState, useEffect, fetch functions)
- **Pas de cache** : Données récupérées plusieurs fois
- **Gestion d'erreur incohérente** : Chaque composant gérait différemment
- **Pas de refetch automatique** : Données obsolètes

### Après
- **7 composants** utilisant React Query
- **4 hooks personnalisés** réutilisables
- **Cache automatique** : Données partagées entre composants
- **Gestion d'erreur standardisée** : Même pattern partout
- **Refetch automatique** : Données toujours à jour
- **~350 lignes de code supprimées**

## ✅ Avantages

1. **Performance améliorée**
   - Cache automatique : pas de requêtes dupliquées
   - Déduplication : plusieurs composants utilisant les mêmes données = 1 seule requête
   - Refetch en arrière-plan : données toujours fraîches

2. **Code plus simple**
   - Moins de boilerplate : pas besoin de useState, useEffect, fetch functions
   - Hooks réutilisables : logique centralisée
   - Moins de bugs : gestion d'erreur et loading states automatiques

3. **Meilleure expérience utilisateur**
   - Données instantanées depuis le cache
   - Mise à jour automatique en arrière-plan
   - États de chargement cohérents

4. **Maintenance facilitée**
   - Logique centralisée dans les hooks
   - Facile d'ajouter de nouveaux composants
   - Tests plus simples (hooks isolés)

## 🔍 Structure des fichiers

```
src/
├── App.jsx                    # QueryClientProvider wrapper
├── hooks/
│   ├── useVideos.js          # Hook pour les vidéos (partagé)
│   ├── useDirectory.js      # Hooks pour le répertoire
│   ├── useVideoManagement.js # Hooks pour la gestion vidéo
│   └── useSeminars.js        # Hooks pour les séminaires
├── components/
│   ├── Dashboard.jsx         # ✅ Migré
│   ├── SeminarsList.jsx      # ✅ Migré
│   └── VideoPicker.jsx       # ✅ Migré
└── pages/
    ├── directory.jsx         # ✅ Migré
    ├── VideoManagement.jsx   # ✅ Migré
    ├── SimplifiedHome.jsx    # ✅ Migré
    └── App.jsx               # ✅ Migré
```

## 📝 Notes techniques

- **Aucune fonctionnalité perdue** : Toutes les fonctionnalités fonctionnent exactement comme avant
- **Compatibilité** : Aucun changement dans le comportement de l'application
- **Performance** : Cache partagé entre composants = moins de requêtes réseau
- **Invalidation** : Utilisation de `queryClient.invalidateQueries()` pour forcer le refetch après mutations

## 🚀 Exemple d'utilisation

### Avant (gestion manuelle)
```jsx
const [videos, setVideos] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      setVideos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  fetchVideos();
}, [user]);
```

### Après (React Query)
```jsx
const { data: videos = [], isLoading: loading, error } = useVideos();
```

**Résultat** : 15 lignes → 1 ligne ! 🎉

## 📌 Commit

**Commits :** 
- `9ee7a16` - "Migrate components to React Query (keep App.jsx unchanged)"
- `92f1ee0` - "Migrate App.jsx to React Query"

---

*Cette migration fait partie de l'amélioration de l'architecture globale de l'application et ouvre la voie à d'autres optimisations (mutations, optimistic updates, etc.).*

