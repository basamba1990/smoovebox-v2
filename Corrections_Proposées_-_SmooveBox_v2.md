# Corrections Proposées - SmooveBox v2

## Corrections pour les Fonctions Edge

### 1. Correction de la Fonction `analyze-transcription`

```typescript
// Correction des constantes de statut
const VIDEO_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  ANALYZING: 'analyzing',
  PUBLISHED: 'published',
  FAILED: 'failed'
} as const;

// Amélioration de la gestion d'erreurs
try {
  const analysis = await analyzeVideoContent(openai, transcriptionText, videoMetadata, userHistory || []);
  
  // Mise à jour atomique avec gestion d'erreur
  const { error: updateError } = await serviceClient
    .from('videos')
    .update({
      analysis: analysis,
      status: VIDEO_STATUS.PUBLISHED,
      updated_at: new Date().toISOString()
    })
    .eq('id', videoId);
    
  if (updateError) {
    throw new Error(`Erreur de mise à jour: ${updateError.message}`);
  }
} catch (error) {
  // Rollback en cas d'erreur
  await serviceClient
    .from('videos')
    .update({
      status: VIDEO_STATUS.FAILED,
      error_message: error.message,
      updated_at: new Date().toISOString()
    })
    .eq('id', videoId);
    
  throw error;
}
```

### 2. Optimisation de la Fonction `analyze-video-performance`

```typescript
// Utilisation de modèles plus économiques
const performanceResponse = await openai.chat.completions.create({
  model: "gpt-3.5-turbo", // Au lieu de gpt-4
  messages: [
    {
      role: "system",
      content: `Analyse cette transcription de manière concise...`
    },
    {
      role: "user",
      content: transcriptionText.substring(0, 8000) // Limiter la taille
    }
  ],
  max_tokens: 1000, // Limiter les tokens de sortie
  temperature: 0.3, // Réduire la créativité pour plus de cohérence
  response_format: { type: "json_object" }
});
```

### 3. Correction de la Fonction `creative-challenges`

```sql
-- Création des tables manquantes
CREATE TABLE IF NOT EXISTS public.challenge_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id uuid NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    submission_data jsonb NOT NULL,
    status text NOT NULL DEFAULT 'submitted',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.challenge_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    challenge_id uuid NOT NULL REFERENCES public.creative_challenges(id) ON DELETE CASCADE,
    progress_data jsonb,
    status text NOT NULL DEFAULT 'in_progress',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

-- Politiques RLS
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own submissions"
ON public.challenge_submissions 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own progress"
ON public.challenge_progress 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

## Corrections pour le Code Frontend

### 1. Amélioration de la Gestion d'État dans App.jsx

```jsx
// Utilisation de useCallback pour éviter les re-renders
const loadDashboardData = useCallback(async () => {
  if (!user) {
    setDashboardData(null);
    return;
  }
  
  try {
    setDashboardLoading(true);
    setDashboardError(null);
    
    const data = await retryOperation(async () => {
      return await fetchDashboardData(user.id);
    }, 2);
    
    setDashboardData(data);
  } catch (err) {
    setDashboardData(null);
    setDashboardError(err.message || 'Erreur lors de la récupération des données');
  } finally {
    setDashboardLoading(false);
  }
}, [user]);

// Nettoyage des effets
useEffect(() => {
  let mounted = true;
  let videosChannel = null;
  
  if (activeTab === 'dashboard' && user) {
    loadDashboardData();
    
    // Configuration du canal realtime avec nettoyage
    videosChannel = supabase
      .channel('videos_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'videos',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        if (mounted) {
          loadDashboardData();
        }
      })
      .subscribe();
  }

  return () => {
    mounted = false;
    if (videosChannel) {
      supabase.removeChannel(videosChannel);
    }
  };
}, [user, activeTab, loadDashboardData]);
```

### 2. Optimisation du Contexte d'Authentification

```jsx
// Mémorisation des valeurs du contexte
const contextValue = useMemo(() => ({
  user,
  profile,
  loading,
  error,
  connectionStatus,
  signIn,
  signUp,
  signOut,
  updateProfile
}), [user, profile, loading, error, connectionStatus]);

// Gestion d'erreur améliorée
const handleAuthError = useCallback((error) => {
  console.error('Erreur d\'authentification:', error);
  setError(error.message || 'Erreur d\'authentification');
  
  // Réinitialiser l'état en cas d'erreur critique
  if (error.message?.includes('Invalid token') || error.message?.includes('JWT expired')) {
    setUser(null);
    setProfile(null);
  }
}, []);
```

### 3. Amélioration de la Configuration Supabase

```javascript
// Configuration robuste avec retry et timeout
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: AUTH_STORAGE_KEY,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'smoovebox-v2'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    timeout: 30000 // Timeout de 30 secondes
  },
  db: {
    schema: 'public'
  }
});

// Fonction de retry améliorée avec backoff exponentiel
export const retryOperation = async (operation, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        )
      ]);
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};
```

## Corrections de Base de Données

### 1. Schéma Complet pour les Nouvelles Fonctionnalités

```sql
-- Table pour la gamification des utilisateurs
CREATE TABLE IF NOT EXISTS public.user_gamification (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level integer DEFAULT 1,
    points integer DEFAULT 0,
    badges jsonb DEFAULT '[]'::jsonb,
    achievements jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id)
);

-- Table pour les métriques vidéo
CREATE TABLE IF NOT EXISTS public.video_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    view_count integer DEFAULT 0,
    like_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    share_count integer DEFAULT 0,
    engagement_rate decimal(5,2) DEFAULT 0.00,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(video_id)
);

-- Table pour les prédictions d'engagement
CREATE TABLE IF NOT EXISTS public.engagement_predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    predictions jsonb NOT NULL,
    accuracy_score decimal(3,2),
    created_at timestamp with time zone DEFAULT now()
);

-- Table pour les analyses vidéo détaillées
CREATE TABLE IF NOT EXISTS public.video_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    performance_analysis jsonb,
    content_insights jsonb,
    audience_analysis jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(video_id)
);

-- Politiques RLS pour toutes les nouvelles tables
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_analytics ENABLE ROW LEVEL SECURITY;

-- Politiques pour user_gamification
CREATE POLICY "Users can view and update their own gamification data"
ON public.user_gamification 
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Politiques pour video_metrics
CREATE POLICY "Users can view metrics for their own videos"
ON public.video_metrics 
FOR SELECT 
TO authenticated
USING (
  video_id IN (
    SELECT id FROM public.videos WHERE user_id = auth.uid()
  )
);

-- Politiques pour engagement_predictions
CREATE POLICY "Users can view their own predictions"
ON public.engagement_predictions 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Politiques pour video_analytics
CREATE POLICY "Users can view analytics for their own videos"
ON public.video_analytics 
FOR SELECT 
TO authenticated
USING (
  video_id IN (
    SELECT id FROM public.videos WHERE user_id = auth.uid()
  )
);
```

### 2. Index pour Optimiser les Performances

```sql
-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_videos_user_id_created_at 
ON public.videos(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcriptions_video_id 
ON public.transcriptions(video_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id 
ON public.user_badges(user_id);

CREATE INDEX IF NOT EXISTS idx_creative_challenges_active 
ON public.creative_challenges(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user_challenge 
ON public.challenge_submissions(user_id, challenge_id);

CREATE INDEX IF NOT EXISTS idx_video_metrics_video_id 
ON public.video_metrics(video_id);

CREATE INDEX IF NOT EXISTS idx_engagement_predictions_user_video 
ON public.engagement_predictions(user_id, video_id);
```

## Corrections de Sécurité

### 1. Validation Renforcée des Tokens

```typescript
// Fonction de validation de token améliorée
async function validateAuthToken(req: Request): Promise<{ user: any; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Token d\'authentification manquant' };
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Validation du format du token
  if (!token || token.length < 10) {
    return { user: null, error: 'Format de token invalide' };
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { user: null, error: 'Token invalide ou expiré' };
    }
    
    // Vérification supplémentaire de l'état du compte
    if (!user.email_confirmed_at) {
      return { user: null, error: 'Email non confirmé' };
    }
    
    return { user };
  } catch (error) {
    return { user: null, error: 'Erreur de validation du token' };
  }
}
```

### 2. Sanitisation des Données

```typescript
// Fonction de sanitisation des données d'entrée
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Supprimer les caractères dangereux
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}
```

## Tests et Validation

### 1. Tests pour les Fonctions Edge

```typescript
// Test unitaire pour analyze-transcription
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("analyze-transcription should handle valid input", async () => {
  const mockRequest = new Request("http://localhost", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer valid-token"
    },
    body: JSON.stringify({
      videoId: "test-video-id",
      transcription: "Test transcription content"
    })
  });
  
  // Test de la fonction
  // ... logique de test
});
```

### 2. Tests Frontend avec Jest

```javascript
// Test pour le composant Dashboard
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import Dashboard from '../components/Dashboard';

test('Dashboard loads and displays videos', async () => {
  render(
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
  
  await waitFor(() => {
    expect(screen.getByText('Mes Vidéos')).toBeInTheDocument();
  });
});
```

